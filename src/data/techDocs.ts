export interface BackendCodeFile {
  path: string;
  filename: string;
  category: 'database' | 'services' | 'webhooks' | 'worker' | 'cron' | 'env';
  description: string;
  language: string;
  code: string;
}

export const BACKEND_DIRECTORY_STRUCTURE = `
backend/
├── prisma/
│   └── schema.prisma                # Modelo Prisma ORM da tabela agendamentos
├── sql/
│   └── init.sql                     # Schema PostgreSQL puro (UUID, ENUM, Triggers e Índices)
├── src/
│   ├── types/
│   │   └── index.ts                 # Interfaces TypeScript e Tipos de Domínio
│   ├── db/
│   │   ├── database.ts              # Camada de Repositório e Conexão de Dados
│   │   └── drizzle.schema.ts        # Schema alternativo em Drizzle ORM
│   ├── services/
│   │   ├── calcom.service.ts        # Integração Cal.com (acceptBooking, cancelBooking)
│   │   ├── asaas.service.ts         # Integração Asaas (findOrCreateCustomer, createPixCharge, deleteCharge)
│   │   └── zapi.service.ts          # Integração Z-API WhatsApp (sendPixMessage, sendConfirmation, sendExpiration)
│   ├── middlewares/
│   │   └── webhookAuth.middleware.ts# Validação HMAC SHA-256 (Cal.com) e asaas-access-token (Asaas)
│   ├── queue/
│   │   └── booking.worker.ts        # Worker assíncrono com idempotência ("Responda rápido, processe depois")
│   ├── controllers/
│   │   ├── calcom.webhook.ts        # POST /api/webhooks/calcom (BOOKING_CREATED -> 200 OK + fila)
│   │   └── asaas.webhook.ts         # POST /api/webhooks/asaas (PAYMENT_RECEIVED -> 200 OK + fila)
│   ├── jobs/
│   │   └── cleanupExpiredBookings.cron.ts # Cron a cada 1 min para cancelar PENDING > 15 min
│   ├── routes.ts                    # Agrupador de rotas Express
│   └── server.ts                    # Ponto de entrada do servidor Node.js/TypeScript
└── .env.example                     # Variáveis de ambiente completas e documentadas
`.trim();

export const BACKEND_CODE_FILES: BackendCodeFile[] = [
  {
    path: 'prisma/schema.prisma',
    filename: 'schema.prisma',
    category: 'database',
    description: 'Modelo de Banco de Dados com Prisma ORM para a tabela Agendamentos com UUID, Unique e Enum.',
    language: 'prisma',
    code: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum BookingStatus {
  PENDING
  PAID
  CANCELED
}

model Agendamentos {
  id                String        @id @default(uuid()) @db.Uuid
  calcom_booking_id String        @unique @db.VarChar(255)
  asaas_payment_id  String?       @unique @db.VarChar(255)
  status            BookingStatus @default(PENDING)
  customer_name     String        @db.VarChar(255)
  customer_email    String        @db.VarChar(255)
  customer_phone    String        @db.VarChar(50)
  created_at        DateTime      @default(now()) @db.Timestamptz(6)
  updated_at        DateTime      @updatedAt @db.Timestamptz(6)

  @@index([status, created_at], name: "idx_agendamentos_status_created")
  @@index([asaas_payment_id], name: "idx_agendamentos_asaas_payment")
  @@map("agendamentos")
}`,
  },
  {
    path: 'sql/init.sql',
    filename: 'init.sql (PostgreSQL Puro)',
    category: 'database',
    description: 'Script DDL nativo para PostgreSQL com extensão UUID, tipo ENUM, índices compostos e trigger de auto-update.',
    language: 'sql',
    code: `-- Habilitar extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tipo ENUM para status do agendamento
DO $$ BEGIN
    CREATE TYPE booking_status_enum AS ENUM ('PENDING', 'PAID', 'CANCELED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela 'agendamentos'
CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calcom_booking_id VARCHAR(255) NOT NULL UNIQUE,
    asaas_payment_id VARCHAR(255) UNIQUE,
    status booking_status_enum NOT NULL DEFAULT 'PENDING',
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índices para busca ultrarrápida
CREATE INDEX IF NOT EXISTS idx_agendamentos_asaas_payment 
ON agendamentos(asaas_payment_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_cleanup 
ON agendamentos(status, created_at) 
WHERE status = 'PENDING';

-- Trigger automático para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_agendamentos_updated_at ON agendamentos;
CREATE TRIGGER trigger_agendamentos_updated_at
    BEFORE UPDATE ON agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();`,
  },
  {
    path: 'src/services/calcom.service.ts',
    filename: 'calcom.service.ts',
    category: 'services',
    description: 'Serviço para interagir com a API do Cal.com: confirma reservas (ACCEPTED) ou cancela para liberar horários.',
    language: 'typescript',
    code: `export class CalcomService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CALCOM_API_KEY || '';
    this.baseUrl = process.env.CALCOM_BASE_URL || 'https://api.cal.com/v2';
  }

  /**
   * Altera o status do agendamento de PENDING para ACCEPTED após compensação do PIX (Cal.com API v2).
   */
  async acceptBooking(bookingId: string | number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(\`[CalcomService:v2] Confirmando agendamento Cal.com ID: \${bookingId}...\`);

      if (!this.apiKey) {
        console.warn('[CalcomService:v2] CALCOM_API_KEY não configurada. Simulando confirmação.');
        return { success: true, data: { status: 'ACCEPTED', simulated: true, id: bookingId } };
      }

      const response = await fetch(\`\${this.baseUrl}/bookings/\${bookingId}\`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${this.apiKey}\`,
          'cal-api-version': '2024-08-13',
        },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(\`Falha na API Cal.com (Status \${response.status}): \${errText}\`);
      }

      const data = await response.json();
      console.log(\`[CalcomService] Agendamento \${bookingId} aceito com sucesso.\`);
      return { success: true, data };
    } catch (error: any) {
      console.error(\`[CalcomService:ERROR] Erro ao aceitar agendamento \${bookingId}:\`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancela o agendamento no Cal.com liberando o horário na agenda pública da Dra. Sabrina.
   */
  async cancelBooking(
    bookingId: string | number,
    cancellationReason: string = 'Cancelado por falta de pagamento PIX no prazo limite de 15 minutos.'
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(\`[CalcomService] Cancelando agendamento Cal.com ID: \${bookingId}...\`);

      if (!this.apiKey) {
        return { success: true, data: { status: 'CANCELLED', simulated: true, id: bookingId } };
      }

      const response = await fetch(\`\${this.baseUrl}/bookings/\${bookingId}/cancel\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${this.apiKey}\`,
          'cal-api-version': '2024-08-13',
        },
        body: JSON.stringify({ cancellationReason }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(\`Falha ao cancelar no Cal.com (Status \${response.status}): \${errText}\`);
      }

      const data = await response.json();
      console.log(\`[CalcomService] Agendamento \${bookingId} cancelado e horário liberado com sucesso.\`);
      return { success: true, data };
    } catch (error: any) {
      console.error(\`[CalcomService:ERROR] Erro ao cancelar agendamento \${bookingId}:\`, error.message);
      return { success: false, error: error.message };
    }
  }
}

export const calcomService = new CalcomService();`,
  },
  {
    path: 'src/services/asaas.service.ts',
    filename: 'asaas.service.ts',
    category: 'services',
    description: 'Serviço para gerenciar cobranças PIX, clientes e expiração na API do Asaas.',
    language: 'typescript',
    code: `export interface CreateCustomerDTO {
  name: string;
  email: string;
  phone: string;
}

export interface CreatePixChargeDTO {
  customerId: string;
  value: number;
  description: string;
  externalReference?: string;
  expiresInMinutes?: number;
}

export class AsaasService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ASAAS_API_KEY || '';
    const env = process.env.ASAAS_ENVIRONMENT || 'production';
    this.baseUrl = env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'access_token': this.apiKey,
    };
  }

  async findOrCreateCustomer(data: CreateCustomerDTO): Promise<string> {
    try {
      console.log(\`[AsaasService] Localizando/Criando cliente: \${data.name} (\${data.email})...\`);

      if (!this.apiKey) {
        return \`cus_mock_\${Math.random().toString(36).substring(2, 9)}\`;
      }

      // 1. Busca por e-mail existente
      const searchRes = await fetch(\`\${this.baseUrl}/customers?email=\${encodeURIComponent(data.email)}\`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
          return searchData.data[0].id;
        }
      }

      // 2. Cria novo cliente se não localizado
      const cleanPhone = data.phone.replace(/\\D/g, '');
      const createRes = await fetch(\`\${this.baseUrl}/customers\`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          mobilePhone: cleanPhone,
          notificationDisabled: false,
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(\`Falha ao criar cliente no Asaas (Status \${createRes.status}): \${errText}\`);
      }

      const created = await createRes.json();
      return created.id;
    } catch (error: any) {
      console.error('[AsaasService:ERROR] Erro ao buscar/criar cliente:', error.message);
      throw error;
    }
  }

  async createPixCharge(params: CreatePixChargeDTO): Promise<{
    paymentId: string;
    pixPayload: string;
    qrCodeImage: string;
    expirationDate: string;
  }> {
    try {
      console.log(\`[AsaasService] Gerando cobrança PIX de R$ \${params.value.toFixed(2)}...\`);

      const now = new Date();
      const dueDate = now.toISOString().split('T')[0];
      const expiresInMin = params.expiresInMinutes || 15;
      const expirationDate = new Date(now.getTime() + expiresInMin * 60 * 1000).toISOString();

      if (!this.apiKey) {
        const mockPayId = \`pay_mock_\${Math.random().toString(36).substring(2, 9)}\`;
        const simPix = \`00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/\${mockPayId}5204000053039865405\${params.value.toFixed(2)}5802BR5920Dra Sabrina Vidal6009Sao Paulo62070503***6304ABCD\`;
        return {
          paymentId: mockPayId,
          pixPayload: simPix,
          qrCodeImage: \`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=\${encodeURIComponent(simPix)}\`,
          expirationDate,
        };
      }

      // Criação da cobrança
      const res = await fetch(\`\${this.baseUrl}/payments\`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          customer: params.customerId,
          billingType: 'PIX',
          value: params.value,
          dueDate: dueDate,
          description: params.description,
          externalReference: params.externalReference,
          postalService: false,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(\`Falha ao registrar cobrança no Asaas (Status \${res.status}): \${errText}\`);
      }

      const payment = await res.json();
      const paymentId = payment.id;

      // Obtenção do Copia e Cola + QR Code oficial
      const qrRes = await fetch(\`\${this.baseUrl}/payments/\${paymentId}/pixQrCode\`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      let pixPayload = '';
      let qrCodeImage = '';

      if (qrRes.ok) {
        const qrData = await qrRes.json();
        pixPayload = qrData.payload || '';
        qrCodeImage = qrData.encodedImage ? \`data:image/png;base64,\${qrData.encodedImage}\` : '';
      }

      return { paymentId, pixPayload, qrCodeImage, expirationDate };
    } catch (error: any) {
      console.error('[AsaasService:ERROR] Erro ao criar cobrança PIX:', error.message);
      throw error;
    }
  }

  async deleteCharge(paymentId: string): Promise<boolean> {
    try {
      console.log(\`[AsaasService] Cancelando cobrança Asaas ID: \${paymentId}...\`);
      if (!this.apiKey) return true;

      const res = await fetch(\`\${this.baseUrl}/payments/\${paymentId}\`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      return res.ok;
    } catch (error: any) {
      console.error('[AsaasService:ERROR] Erro ao excluir cobrança:', error.message);
      return false;
    }
  }
}

export const asaasService = new AsaasService();`,
  },
  {
    path: 'src/services/zapi.service.ts',
    filename: 'zapi.service.ts',
    category: 'services',
    description: 'Serviço para envio transacional de mensagens no WhatsApp via Z-API (PIX com prazo, Confirmação com Meet e Aviso de Expiração).',
    language: 'typescript',
    code: `export class ZApiService {
  private instanceId: string;
  private token: string;
  private clientToken: string;
  private baseUrl: string;

  constructor() {
    this.instanceId = process.env.ZAPI_INSTANCE_ID || '';
    this.token = process.env.ZAPI_TOKEN || '';
    this.clientToken = process.env.ZAPI_CLIENT_TOKEN || '';
    this.baseUrl = process.env.ZAPI_BASE_URL || 'https://api.z-api.io';
  }

  private formatPhoneNumber(rawPhone: string): string {
    let clean = rawPhone.replace(/\\D/g, '');
    if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
      clean = \`55\${clean}\`;
    }
    return clean;
  }

  async sendTextMessage(rawPhone: string, message: string): Promise<boolean> {
    const phone = this.formatPhoneNumber(rawPhone);
    try {
      console.log(\`[ZApiService] Enviando WhatsApp para \${phone}...\`);

      if (!this.instanceId || !this.token) {
        console.warn(\`[ZApiService SIMULADO para \${phone}]:\\n\${message}\\n---\`);
        return true;
      }

      const url = \`\${this.baseUrl}/instances/\${this.instanceId}/token/\${this.token}/send-text\`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.clientToken) headers['Client-Token'] = this.clientToken;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, message }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(\`Falha Z-API (Status \${response.status}): \${errText}\`);
      }

      console.log(\`[ZApiService] Mensagem entregue com sucesso para \${phone}.\`);
      return true;
    } catch (error: any) {
      console.error(\`[ZApiService:ERROR] Falha ao enviar WhatsApp para \${phone}:\`, error.message);
      return false;
    }
  }

  async sendPixMessage(params: {
    phone: string;
    customerName: string;
    pixPayload: string;
    qrCodeUrl?: string;
    minutesLeft?: number;
  }): Promise<boolean> {
    const minutes = params.minutesLeft || 15;
    const firstName = params.customerName.split(' ')[0];

    const message = \`🌿 Olá, *\${firstName}*! Tudo bem?\\n\\n\` +
      \`Recebemos sua reserva para a *Consulta de Nutrição Social com a Dra. Sabrina Vidal*! 🥑\\n\\n\` +
      \`Seu horário está *pré-reservado por \${minutes} minutos*. Para garantir sua vaga definitiva, pague via PIX:\\n\\n\` +
      \`📋 *Código PIX Copia e Cola:*\\n\` +
      \`\`\`\${params.pixPayload}\`\`\`\\n\\n\` +
      (params.qrCodeUrl ? \`🔗 *Link do QR Code para escanear:*\\n\${params.qrCodeUrl}\\n\\n\` : '') +
      \`⏱️ *Atenção:* Se o pagamento não for identificado em *\${minutes} minutos*, o horário será liberado automaticamente.\\n\\n\` +
      \`Assim que o PIX for compensado, você receberá a confirmação com o link da sala no Google Meet! ✨\`;

    return this.sendTextMessage(params.phone, message);
  }

  async sendConfirmationMessage(params: {
    phone: string;
    customerName: string;
    meetingUrl?: string;
  }): Promise<boolean> {
    const firstName = params.customerName.split(' ')[0];
    const meetLink = params.meetingUrl || 'https://meet.google.com/social-sabrina';

    const message = \`🎉 *PAGAMENTO CONFIRMADO COM SUCESSO!* 💚\\n\\n\` +
      \`Olá, *\${firstName}*! Seu pagamento PIX foi compensado e sua consulta está *100% CONFIRMADA* na agenda da Dra. Sabrina Vidal!\\n\\n\` +
      \`📹 *Link da Sala Online (Google Meet):*\\n\${meetLink}\\n\\n\` +
      \`📝 *Orientações importantes:*\\n\` +
      \`• Conecte-se com 5 minutos de antecedência.\\n\` +
      \`• Tenha em mãos seus exames laboratoriais recentes se possuir.\\n\` +
      \`• Separe um caderno para suas anotações nutricionais.\\n\\n\` +
      \`Te esperamos na consulta! Qualquer dúvida, pode responder aqui. ✨\`;

    return this.sendTextMessage(params.phone, message);
  }

  async sendExpirationMessage(params: { phone: string; customerName: string }): Promise<boolean> {
    const firstName = params.customerName.split(' ')[0];

    const message = \`⏰ *Reserva expirada - Horário Liberado*\\n\\n\` +
      \`Olá, *\${firstName}*. Notamos que o pagamento PIX da consulta não foi compensado dentro do limite de 15 minutos.\\n\\n\` +
      \`O horário foi *liberado automaticamente* na agenda da nutricionista.\\n\\n\` +
      \`Caso deseje realizar seu atendimento, basta acessar nosso site e selecionar um novo horário disponível! 😊\`;

    return this.sendTextMessage(params.phone, message);
  }
}

export const zapiService = new ZApiService();`,
  },
  {
    path: 'src/middlewares/webhookAuth.middleware.ts',
    filename: 'webhookAuth.middleware.ts',
    category: 'webhooks',
    description: 'Middlewares de segurança para validar assinatura HMAC SHA-256 do Cal.com e cabeçalho asaas-access-token do Asaas.',
    language: 'typescript',
    code: `import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Validação de assinatura HMAC SHA-256 do Cal.com
 */
export const validateCalcomSignature = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const secret = process.env.CALCOM_WEBHOOK_SECRET;
    if (!secret) {
      console.warn('[WebhookAuth] CALCOM_WEBHOOK_SECRET não configurado. Ignorando checagem.');
      return next();
    }

    const signature = req.headers['x-cal-signature-256'] as string;
    if (!signature) {
      res.status(401).json({ error: 'Cabeçalho x-cal-signature-256 ausente.' });
      return;
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const isValid = crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
    if (!isValid) {
      res.status(403).json({ error: 'Assinatura inválida do Cal.com.' });
      return;
    }

    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao validar assinatura Cal.com', details: error.message });
  }
};

/**
 * Validação do Token de Acesso do Asaas (asaas-access-token)
 */
export const validateAsaasToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_WEBHOOK_SECRET;
    if (!expectedToken) {
      console.warn('[WebhookAuth] ASAAS_WEBHOOK_TOKEN não configurado. Ignorando checagem.');
      return next();
    }

    const receivedToken = (req.headers['asaas-access-token'] || req.headers['authorization']) as string;
    if (!receivedToken) {
      res.status(401).json({ error: 'Cabeçalho asaas-access-token ausente.' });
      return;
    }

    const cleanToken = receivedToken.replace(/^Bearer\\s+/i, '').trim();
    if (cleanToken !== expectedToken.trim()) {
      res.status(403).json({ error: 'Token de autenticação do Asaas inválido.' });
      return;
    }

    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao validar token do Asaas', details: error.message });
  }
};`,
  },
  {
    path: 'src/controllers/calcom.webhook.ts',
    filename: 'calcom.webhook.ts',
    category: 'webhooks',
    description: 'ENDPOINT 1: Webhook do Cal.com (POST /api/webhooks/calcom) - Salva PENDING no banco, retorna 200 OK e aciona worker assíncrono.',
    language: 'typescript',
    code: `import { Request, Response } from 'express';
import { dbRepository } from '../db/database';
import { bookingWorker } from '../queue/booking.worker';

/**
 * ENDPOINT 1: Webhook Cal.com (POST /api/webhooks/calcom)
 * Gatilho: BOOKING_CREATED (Status PENDING)
 * Padrão: "Responda rápido, processe depois"
 */
export const handleCalcomWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { triggerEvent, payload } = req.body;

    // Filtra apenas o evento BOOKING_CREATED
    if (triggerEvent && triggerEvent !== 'BOOKING_CREATED') {
      res.status(200).json({ received: true, ignored: true, reason: 'Evento não relevante' });
      return;
    }

    if (!payload?.id) {
      res.status(400).json({ error: 'Payload incompleto. Falta payload.id.' });
      return;
    }

    const calcomBookingId = String(payload.id);
    const attendee = payload.attendees?.[0];
    const customerName = attendee?.name || payload.responses?.name?.value || 'Paciente';
    const customerEmail = attendee?.email || payload.responses?.email?.value || 'paciente@email.com';
    const customerPhone = String(payload.responses?.phone?.value || '5511999999999');

    // 1. Salva rapidamente no banco com status PENDING
    const record = await dbRepository.createPendingBooking({
      calcomBookingId,
      customerName,
      customerEmail,
      customerPhone,
      metadata: {
        startTime: payload.startTime,
        endTime: payload.endTime,
        title: payload.title,
      },
    });

    console.log(\`[CalcomWebhook] Salvo no banco: ID \${record.id} com status PENDING.\`);

    // 2. Enfileira para processamento assíncrono no Worker (Asaas PIX + Z-API WhatsApp)
    const jobId = bookingWorker.enqueue('PROCESS_CALCOM_BOOKING', {
      bookingId: calcomBookingId,
      customerName,
      customerEmail,
      customerPhone,
      rawPayload: payload,
    });

    // 3. Retorna 200 OK imediatamente para o Cal.com
    res.status(200).json({
      success: true,
      message: 'Agendamento registrado. Cobrança PIX e WhatsApp em processamento.',
      bookingId: calcomBookingId,
      jobId,
      status: 'PENDING',
    });
  } catch (error: any) {
    console.error('[CalcomWebhook:ERROR]', error.message);
    res.status(500).json({ error: 'Erro interno ao processar webhook Cal.com' });
  }
};`,
  },
  {
    path: 'src/controllers/asaas.webhook.ts',
    filename: 'asaas.webhook.ts',
    category: 'webhooks',
    description: 'ENDPOINT 2: Webhook do Asaas (POST /api/webhooks/asaas) - Retorna 200 OK imediatamente e enfileira verificação com idempotência.',
    language: 'typescript',
    code: `import { Request, Response } from 'express';
import { bookingWorker } from '../queue/booking.worker';

/**
 * ENDPOINT 2: Webhook Asaas (POST /api/webhooks/asaas)
 * Gatilho: PAYMENT_RECEIVED
 * Padrão: "Responda rápido, processe depois" com garantia de idempotência
 */
export const handleAsaasWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { event, payment } = req.body;

    if (event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED') {
      res.status(200).json({ received: true, ignored: true, event });
      return;
    }

    if (!payment?.id) {
      res.status(400).json({ error: 'Payload incompleto. Falta payment.id.' });
      return;
    }

    const paymentId = payment.id;
    console.log(\`[AsaasWebhook] Pagamento recebido: \${paymentId}. Enfileirando worker...\`);

    // 1. Enfileira para processamento assíncrono (Idempotência + Cal.com ACCEPTED + Z-API WhatsApp)
    const jobId = bookingWorker.enqueue('PROCESS_ASAAS_PAYMENT', req.body);

    // 2. Retorna 200 OK IMEDIATAMENTE para o Asaas
    res.status(200).json({
      success: true,
      message: 'Notificação de pagamento recebida. Processamento assíncrono disparado.',
      paymentId,
      jobId,
    });
  } catch (error: any) {
    console.error('[AsaasWebhook:ERROR]', error.message);
    res.status(500).json({ error: 'Erro interno no webhook Asaas' });
  }
};`,
  },
  {
    path: 'src/queue/booking.worker.ts',
    filename: 'booking.worker.ts',
    category: 'worker',
    description: 'Fila e Worker assíncrono fail-proof com checagem rigorosa de idempotência para evitar mensagens duplicadas.',
    language: 'typescript',
    code: `import { dbRepository } from '../db/database';
import { asaasService } from '../services/asaas.service';
import { calcomService } from '../services/calcom.service';
import { zapiService } from '../services/zapi.service';

export class BookingWorker {
  private queue: Array<{ id: string; type: string; payload: any }> = [];
  private isProcessing = false;

  enqueue(type: 'PROCESS_CALCOM_BOOKING' | 'PROCESS_ASAAS_PAYMENT', payload: any): string {
    const jobId = \`job_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`;
    this.queue.push({ id: jobId, type, payload });

    setImmediate(() => this.processNext());
    return jobId;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const job = this.queue.shift();
    if (!job) {
      this.isProcessing = false;
      return;
    }

    try {
      if (job.type === 'PROCESS_CALCOM_BOOKING') {
        await this.handleCalcomJob(job.payload);
      } else if (job.type === 'PROCESS_ASAAS_PAYMENT') {
        await this.handleAsaasJob(job.payload);
      }
    } catch (err: any) {
      console.error(\`[Worker:ERROR] Falha no Job \${job.id}:\`, err.message);
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) setImmediate(() => this.processNext());
    }
  }

  // 1. Assíncrono do Cal.com: Asaas Customer + PIX + DB Update + Z-API WhatsApp (15 min)
  private async handleCalcomJob(data: any): Promise<void> {
    const { bookingId, customerName, customerEmail, customerPhone } = data;

    // a) Cria/Localiza cliente no Asaas e gera PIX de 15 min
    const customerId = await asaasService.findOrCreateCustomer({
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    });

    const pixCharge = await asaasService.createPixCharge({
      customerId,
      value: Number(process.env.CONSULTATION_PRICE_BRL) || 79.0,
      description: \`Consulta Dra. Sabrina Vidal (Reserva #\${bookingId})\`,
      externalReference: bookingId,
      expiresInMinutes: 15,
    });

    // b) Atualiza banco de dados com o asaas_payment_id
    await dbRepository.updateAsaasPaymentId(bookingId, pixCharge.paymentId);

    // c) Chama Z-API enviando WhatsApp com Copia e Cola + link do QR Code (15 min)
    await zapiService.sendPixMessage({
      phone: customerPhone,
      customerName,
      pixPayload: pixCharge.pixPayload,
      qrCodeUrl: pixCharge.qrCodeImage,
      minutesLeft: 15,
    });
  }

  // 2. Assíncrono do Asaas: Idempotência + DB PAID + Cal.com ACCEPTED + Z-API Confirmação
  private async handleAsaasJob(payload: any): Promise<void> {
    const paymentId = payload.payment.id;

    // a) VERIFICAÇÃO DE IDEMPOTÊNCIA: Checa se já está PAID
    const existing = await dbRepository.findByAsaasPaymentId(paymentId);
    if (existing && existing.status === 'PAID') {
      console.log(\`[Worker:IDEMPOTENCY] Pagamento \${paymentId} já processado anteriormente. Ignorando.\`);
      return;
    }

    // b) Atualiza banco para status PAID
    const updated = await dbRepository.updateStatus(paymentId, 'PAID');
    const calcomBookingId = updated?.calcom_booking_id || payload.payment.externalReference;

    // c) Chama API do Cal.com alterando status de PENDING para ACCEPTED
    let meetingUrl = 'https://meet.google.com/social-sabrina';
    if (calcomBookingId) {
      const calRes = await calcomService.acceptBooking(calcomBookingId);
      if (calRes.data?.meetingUrl || calRes.data?.videoCallUrl) {
        meetingUrl = calRes.data.meetingUrl || calRes.data.videoCallUrl;
      }
    }

    // d) Chama Z-API enviando mensagem final de confirmação com link da reunião
    if (updated?.customer_phone) {
      await zapiService.sendConfirmationMessage({
        phone: updated.customer_phone,
        customerName: updated.customer_name,
        meetingUrl,
      });
    }
  }
}

export const bookingWorker = new BookingWorker();`,
  },
  {
    path: 'src/jobs/cleanupExpiredBookings.cron.ts',
    filename: 'cleanupExpiredBookings.cron.ts',
    category: 'cron',
    description: 'ROTINA DE LIMPEZA (Cron Job): Executa a cada 1 minuto, busca PENDING > 15 minutos, cancela Cal.com, Asaas, atualiza CANCELED e notifica Z-API.',
    language: 'typescript',
    code: `import { dbRepository } from '../db/database';
import { calcomService } from '../services/calcom.service';
import { asaasService } from '../services/asaas.service';
import { zapiService } from '../services/zapi.service';

/**
 * Cron Job executado a cada 1 minuto
 * Busca agendamentos PENDING criados há mais de 15 minutos e libera o carrinho.
 */
export class CleanupExpiredBookingsJob {
  private timer: NodeJS.Timeout | null = null;

  async runCleanupCycle(): Promise<{ canceled: number; details: string[] }> {
    console.log('[Cron:Cleanup] Buscando agendamentos PENDING com mais de 15 minutos...');
    const details: string[] = [];

    // Busca no banco onde created_at < (AGORA - 15 minutos)
    const expired = await dbRepository.findExpiredPendingBookings(15);
    console.log(\`[Cron:Cleanup] \${expired.length} agendamentos expirados encontrados.\`);

    for (const booking of expired) {
      // a) Cancela agendamento na API do Cal.com (liberando a agenda)
      if (booking.calcom_booking_id) {
        await calcomService.cancelBooking(booking.calcom_booking_id);
      }

      // b) Cancela cobrança na API do Asaas
      if (booking.asaas_payment_id) {
        await asaasService.deleteCharge(booking.asaas_payment_id);
      }

      // c) Atualiza banco para status CANCELED
      await dbRepository.updateStatus(booking.id, 'CANCELED');

      // d) Chama Z-API informando ao cliente que o tempo expirou e o horário foi liberado
      if (booking.customer_phone) {
        await zapiService.sendExpirationMessage({
          phone: booking.customer_phone,
          customerName: booking.customer_name,
        });
      }

      details.push(\`Agendamento \${booking.calcom_booking_id} de \${booking.customer_name} cancelado.\`);
    }

    return { canceled: expired.length, details };
  }

  startCron(intervalMs: number = 60000): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.runCleanupCycle(), intervalMs);
    console.log('[Cron:Cleanup] Rotina de limpeza ativa a cada 1 minuto.');
  }

  stopCron(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const cleanupCronJob = new CleanupExpiredBookingsJob();`,
  },
  {
    path: '.env.example',
    filename: '.env.example',
    category: 'env',
    description: 'Guia completo de variáveis de ambiente obrigatórias com explicações de como obter cada token.',
    language: 'bash',
    code: `# BANCO DE DADOS (PostgreSQL)
DATABASE_URL="postgresql://postgres:senha@localhost:5432/agendamentos_db?schema=public"

# CAL.COM (API v2)
CALCOM_API_KEY="cal_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
CALCOM_WEBHOOK_SECRET="whsec_calcom_segredo_de_assinatura"
CALCOM_BASE_URL="https://api.cal.com/v2"

# ASAAS
ASAAS_API_KEY="$aact_YTU5YTE0M2M6N2ZkMS00MzJmLTg1YTctxxxxxxxxxxxxxxxxxxxxxx"
ASAAS_ENVIRONMENT="production" # ou "sandbox"
ASAAS_WEBHOOK_TOKEN="whsec_8RvJb3lvYWcwIE2pByN073lTotEFzN-BGFaehqMTzGI"

# Z-API (WhatsApp)
ZAPI_INSTANCE_ID="3Cxxxxxxxxxxxxxxxxxxxxxx"
ZAPI_TOKEN="B8xxxxxxxxxxxxxxxxxxxxxx"
ZAPI_CLIENT_TOKEN="Fxxxxxxxxxxxxxxxxxxxxxxxx" # Opcional
ZAPI_BASE_URL="https://api.z-api.io"

# CONFIGURAÇÕES GERAIS
PORT=3000
CONSULTATION_PRICE_BRL=79.00
PIX_EXPIRATION_MINUTES=15
APP_URL="https://meu-backend.com"`,
  },
];
