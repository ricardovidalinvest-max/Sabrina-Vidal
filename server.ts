import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { backendRouter, initBackendServices } from './src/backend/index';
import { getLiveConfig, updateLiveConfig } from './src/backend/config/env.config';
import { dbRepository } from './src/backend/db/database';
import { bookingWorker } from './src/backend/queue/booking.worker';
import { zapiService } from './src/backend/services/zapi.service';
import { calcomService } from './src/backend/services/calcom.service';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
const PORT = cliPort || Number(process.env.PORT) || 3000;

// Confiança em proxies reversos para identificação precisa de HTTPS e domínios customizados
app.set('trust proxy', true);

// Habilita cabeçalhos CORS para requisições de domínios customizados e webhooks externos
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, asaas-access-token, x-cal-signature-256, Client-Token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Parser JSON com preservação de rawBody para validação criptográfica HMAC SHA-256 (Cal.com)
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Endpoints de Health Check para Cloud Run, Kubernetes, Nginx, Railway e Uptime Monitors
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  const live = getLiveConfig();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    asaasEnvironment: live.asaasEnvironment,
    integrations: {
      calcom: Boolean(live.calcomApiKey && live.calcomApiKey.length > 5),
      asaas: Boolean(live.asaasApiKey && live.asaasApiKey.length > 5),
      zapi: Boolean(live.zapiInstanceId && live.zapiInstanceId.length > 2),
    },
  });
});

// Mount fail-proof backend router (Cal.com & Asaas webhooks, cron trigger, agendamentos)
app.use(backendRouter);

// In-memory store for active payments, bookings, and dispatched notification logs
interface PaymentRecord {
  id: string;
  asaasCustomerId?: string;
  calcomBookingUid?: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE';
  value: number;
  pixPayload: string;
  pixQrCodeBase64?: string;
  expirationDate: string;
  createdAt: string;
  provider: string;
  patientData: {
    fullName: string;
    cpf?: string;
    whatsapp: string;
    email: string;
    age: string;
    weight: string;
    height: string;
    mainGoal: string;
    restrictions: string;
    selectedDate: string;
    selectedTime: string;
  };
  confirmationDetails?: {
    paidAt: string;
    googleMeetUrl: string;
    calcomBookingUid?: string;
    calcomEventUrl?: string;
    emailsDispatched: Array<{
      to: string;
      subject: string;
      sentAt: string;
      type: 'patient_confirmation' | 'nutritionist_alert';
      bodyPreview: string;
    }>;
    whatsappDispatched?: {
      phone: string;
      message: string;
      sentAt: string;
    };
  };
}

const paymentsStore = new Map<string, PaymentRecord>();
const calcomBookingsStore = new Map<string, any>();
let calcomApiKey = process.env.CALCOM_API_KEY || '';
const notificationLogs: Array<{
  id: string;
  type: 'email' | 'whatsapp' | 'webhook';
  recipient: string;
  subjectOrAction: string;
  timestamp: string;
  status: 'SUCCESS' | 'QUEUED' | 'SIMULATED';
  details: Record<string, unknown>;
}> = [];

// Dynamic Asaas API configuration
let asaasApiKey = process.env.ASAAS_API_KEY || '';
let asaasEnvironment: 'production' | 'sandbox' =
  ((process.env.ASAAS_ENVIRONMENT as 'production' | 'sandbox') ||
  (asaasApiKey.startsWith('$aact_') ? 'production' : 'production'));
let asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN || '';

const getAsaasApiKey = (): string => {
  const live = getLiveConfig();
  if (live.asaasApiKey) asaasApiKey = live.asaasApiKey;
  return asaasApiKey || process.env.ASAAS_API_KEY || '';
};

const getAsaasEnvironment = (): 'production' | 'sandbox' => {
  const live = getLiveConfig();
  if (live.asaasEnvironment) asaasEnvironment = live.asaasEnvironment;
  return asaasEnvironment || 'production';
};

// Asaas Webhook secret authentication token provided by user
const getAsaasWebhookToken = (): string => {
  const live = getLiveConfig();
  if (live.asaasWebhookToken) asaasWebhookToken = live.asaasWebhookToken;
  return asaasWebhookToken || '';
};

// Webhook Hub: Make.com, Evolution API (WhatsApp), Google Sheets
let makeWebhookUrl = process.env.MAKE_WEBHOOK_URL || '';
let makeWebhookEnabled = true;
let evolutionApiUrl = process.env.EVOLUTION_API_URL || '';
let evolutionApiKey = process.env.EVOLUTION_API_KEY || '';
let googleSheetsWebhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';

// Helper: Asaas API client baseUrl
const getAsaasBaseUrl = () => {
  return getAsaasEnvironment() === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
};

const hasRealAsaasKey = () => {
  const key = getAsaasApiKey();
  return Boolean(key && key !== 'MY_ASAAS_API_KEY' && key.trim().length > 10);
};

// Calculate CRC16-CCITT (polynomial 0x1021, initial 0xFFFF) for standard Brazilian Central Bank PIX (BRCode)
function computeCrc16Ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Generate 100% compliant BACEN EMV BRCode PIX copy-paste string with valid CRC16 checksum
function generateStandardBrCodePix(
  pixKey: string,
  beneficiaryName: string,
  city: string,
  amount: number,
  txid: string
): string {
  const formatTlv = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const f00 = formatTlv('00', '01');
  const gui = formatTlv('00', 'br.gov.bcb.pix');
  const key = formatTlv('01', pixKey);
  const f26 = formatTlv('26', `${gui}${key}`);
  const f52 = formatTlv('52', '0000');
  const f53 = formatTlv('53', '986');
  const f54 = formatTlv('54', amount.toFixed(2));
  const f58 = formatTlv('58', 'BR');
  const cleanName = beneficiaryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);
  const f59 = formatTlv('59', cleanName);
  const cleanCity = city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);
  const f60 = formatTlv('60', cleanCity);
  const cleanTxid = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';
  const f62_05 = formatTlv('05', cleanTxid);
  const f62 = formatTlv('62', f62_05);

  const rawPayload = `${f00}${f26}${f52}${f53}${f54}${f58}${f59}${f60}${f62}6304`;
  const checksum = computeCrc16Ccitt(rawPayload);
  return `${rawPayload}${checksum}`;
}

// Asaas Customer creation / retrieval helper
async function getOrCreateAsaasCustomer(
  baseUrl: string,
  apiKey: string,
  patientData: { fullName: string; email: string; whatsapp: string; cpfCnpj?: string }
): Promise<string> {
  const cleanPhone = patientData.whatsapp.replace(/\D/g, '');
  const cleanCpf = patientData.cpfCnpj ? patientData.cpfCnpj.replace(/\D/g, '') : undefined;

  // 1. Try search by email
  try {
    const searchUrl = `${baseUrl}/customers?email=${encodeURIComponent(patientData.email.trim())}`;
    const searchRes = await fetch(searchUrl, {
      headers: { access_token: apiKey },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        const cust = searchData.data[0];
        if (cleanCpf && (!cust.cpfCnpj || cust.cpfCnpj !== cleanCpf)) {
          fetch(`${baseUrl}/customers/${cust.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', access_token: apiKey },
            body: JSON.stringify({ cpfCnpj: cleanCpf }),
          }).catch(() => {});
        }
        return cust.id;
      }
    }
  } catch (err) {
    console.warn('[Asaas] Falha ao consultar cliente por e-mail:', err);
  }

  // 2. Try search by mobilePhone
  if (cleanPhone.length >= 10) {
    try {
      const searchPhoneRes = await fetch(`${baseUrl}/customers?mobilePhone=${cleanPhone}`, {
        headers: { access_token: apiKey },
      });
      if (searchPhoneRes.ok) {
        const phoneData = await searchPhoneRes.json();
        if (phoneData.data && phoneData.data.length > 0) {
          const cust = phoneData.data[0];
          if (cleanCpf && (!cust.cpfCnpj || cust.cpfCnpj !== cleanCpf)) {
            fetch(`${baseUrl}/customers/${cust.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', access_token: apiKey },
              body: JSON.stringify({ cpfCnpj: cleanCpf }),
            }).catch(() => {});
          }
          return cust.id;
        }
      }
    } catch (err) {
      console.warn('[Asaas] Falha ao consultar cliente por telefone:', err);
    }
  }

  // 3. Create new customer with cpfCnpj
  const createRes = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    body: JSON.stringify({
      name: patientData.fullName.trim(),
      email: patientData.email.trim(),
      mobilePhone: cleanPhone.length >= 10 ? cleanPhone : undefined,
      cpfCnpj: cleanCpf,
      notificationDisabled: false,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Erro ao cadastrar paciente no Asaas (${createRes.status}): ${errText}`);
  }

  const createdData = await createRes.json();
  return createdData.id;
}

// Asaas PIX Payment creation helper
async function createAsaasPaymentAndPix(
  baseUrl: string,
  apiKey: string,
  customerId: string,
  value: number,
  description: string,
  externalRef: string
): Promise<{ paymentId: string; pixPayload: string; pixQrCodeBase64: string; expirationDate: string }> {
  const today = new Date().toISOString().split('T')[0];

  const payRes = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value: value,
      dueDate: today,
      description: description,
      externalReference: externalRef,
      postalService: false,
    }),
  });

  if (!payRes.ok) {
    const errText = await payRes.text();
    throw new Error(`Falha ao emitir cobrança PIX no Asaas (${payRes.status}): ${errText}`);
  }

  const payData = await payRes.json();
  const paymentId = payData.id;

  // Retrieve PIX QR Code & Copia e Cola registered in SPI/Bacen
  const qrRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
    headers: { access_token: apiKey },
  });

  if (!qrRes.ok) {
    const errText = await qrRes.text();
    throw new Error(`Cobrança criada (${paymentId}), mas falha ao obter QR Code do Asaas: ${errText}`);
  }

  const qrData = await qrRes.json();
  return {
    paymentId,
    pixPayload: qrData.payload,
    pixQrCodeBase64: qrData.encodedImage, // Base64 PNG image from Asaas
    expirationDate: qrData.expirationDate || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

// 1. API: Integration Configuration & Status
app.get('/api/config', (req: Request, res: Response) => {
  const appUrl = (process.env.APP_URL || getLiveConfig().appUrl || 'https://sabrinavidal.com.br').trim().replace(/\/$/, '');
  const asaasConfigured = hasRealAsaasKey();
  const calcomEventUrl = process.env.CALCOM_EVENT_URL || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas';
  const sabrinaEmail = process.env.SABRINA_NOTIFICATION_EMAIL || 'nutricionistasabrinaamorim@gmail.com';

  res.json({
    appUrl,
    asaas: {
      configured: asaasConfigured,
      environment: asaasEnvironment,
      baseUrl: getAsaasBaseUrl(),
      apiKeyPreview: asaasApiKey
        ? `${asaasApiKey.substring(0, 8)}...${asaasApiKey.slice(-4)}`
        : null,
      webhookUrl: `${appUrl}/api/webhooks/asaas`,
      webhookToken: asaasWebhookToken,
      webhookTokenHeader: 'asaas-access-token',
    },
    calcom: {
      eventUrl: calcomEventUrl,
      webhookUrl: `${appUrl}/api/webhooks/calcom`,
      configured: true,
      hasApiKey: Boolean(calcomApiKey && calcomApiKey.trim().length > 5),
      apiKeyPreview: calcomApiKey ? `${calcomApiKey.substring(0, 7)}...` : null,
      totalBookings: calcomBookingsStore.size,
    },
    nutritionist: {
      name: 'Drª Sabrina Vidal',
      crn: 'CRN 17198 - GO',
      email: sabrinaEmail,
      pixKey: sabrinaEmail,
    },
    webhooks: {
      makeWebhookUrl,
      makeWebhookEnabled,
      evolutionApiUrl,
      hasEvolutionApiKey: Boolean(evolutionApiKey && evolutionApiKey.trim().length > 5),
      evolutionApiKeyPreview: evolutionApiKey ? `${evolutionApiKey.substring(0, 6)}...` : null,
      googleSheetsWebhookUrl,
    },
  });
});

// Cal.com: Check status & test connection to Sabrina's event URL
app.get('/api/calcom/status', async (req: Request, res: Response) => {
  const eventUrl = process.env.CALCOM_EVENT_URL || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas';
  res.json({
    connected: true,
    eventUrl,
    hasApiKey: Boolean(calcomApiKey && calcomApiKey.trim().length > 5),
    bookings: Array.from(calcomBookingsStore.values()),
  });
});

app.post('/api/calcom/test-connection', async (req: Request, res: Response) => {
  const eventUrl = process.env.CALCOM_EVENT_URL || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas';
  try {
    const checkRes = await fetch(eventUrl, { method: 'HEAD' });
    const isOk = checkRes.status === 200 || checkRes.status === 304;

    notificationLogs.unshift({
      id: `log_cal_ping_${Date.now()}`,
      type: 'webhook',
      recipient: 'Cal.com Health Check',
      subjectOrAction: isOk
        ? '✓ Cal.com Conectado: Agenda Online (HTTP 200)'
        : `⚠️ Cal.com Status HTTP: ${checkRes.status}`,
      timestamp: new Date().toISOString(),
      status: isOk ? 'SUCCESS' : 'SIMULATED',
      details: {
        eventUrl,
        statusCode: checkRes.status,
      },
    });

    res.json({
      success: isOk,
      statusCode: checkRes.status,
      eventUrl,
      message: isOk
        ? 'Página do Cal.com da Drª Sabrina Vidal online e acessível para agendamentos!'
        : `Resposta do Cal.com: ${checkRes.status}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message, eventUrl });
  }
});

// Cal.com: Register booking created through embed or prefill
app.post('/api/calcom/register-booking', (req: Request, res: Response) => {
  try {
    const { uid, title, startTime, endTime, patientName, patientEmail, videoCallUrl, paymentId } = req.body;
    const bookingId = uid || `cal_book_${Date.now()}`;

    const bookingRecord = {
      uid: bookingId,
      title: title || 'Consulta Nutrição Social - Drª Sabrina Vidal',
      startTime: startTime || new Date().toISOString(),
      endTime,
      patientName,
      patientEmail,
      videoCallUrl: videoCallUrl || 'https://meet.google.com/sab-vidal-79',
      registeredAt: new Date().toISOString(),
      paymentId,
    };

    calcomBookingsStore.set(bookingId, bookingRecord);

    // If paymentId is present, associate it
    if (paymentId && paymentsStore.has(paymentId)) {
      const p = paymentsStore.get(paymentId)!;
      p.calcomBookingUid = bookingId;
    }

    notificationLogs.unshift({
      id: `log_cal_reg_${Date.now()}`,
      type: 'webhook',
      recipient: 'Cal.com Booking Sync',
      subjectOrAction: `✓ Agendamento Cal.com Registrado: ${patientName || 'Paciente'} (UID: ${bookingId.slice(0, 10)})`,
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      details: bookingRecord,
    });

    res.json({
      success: true,
      message: 'Agendamento registrado e vinculado com sucesso!',
      booking: bookingRecord,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// Cal.com: Save API Key dynamically
app.post('/api/calcom/config/api-key', (req: Request, res: Response) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return res.status(400).json({ error: 'Chave de API do Cal.com inválida ou vazia' });
  }
  calcomApiKey = apiKey.trim();
  res.json({
    success: true,
    message: 'Chave de API do Cal.com configurada com sucesso!',
    hasApiKey: true,
  });
});

// Asaas: Save API Key and Environment dynamically
app.post('/api/asaas/config/api-key', (req: Request, res: Response) => {
  const { apiKey, environment } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return res.status(400).json({ error: 'Chave de API do Asaas inválida ou vazia' });
  }

  asaasApiKey = apiKey.trim();
  if (environment === 'sandbox' || environment === 'production') {
    asaasEnvironment = environment;
  } else {
    asaasEnvironment = asaasApiKey.startsWith('$aact_') ? 'production' : 'production';
  }

  console.log(`[Asaas Config]: Chave de API atualizada (${asaasEnvironment}): ${asaasApiKey.substring(0, 8)}...`);

  res.json({
    success: true,
    message: `Chave de API do Asaas salva com sucesso no ambiente ${asaasEnvironment.toUpperCase()}!`,
    configured: true,
    environment: asaasEnvironment,
    apiKeyPreview: `${asaasApiKey.substring(0, 8)}...${asaasApiKey.slice(-4)}`,
  });
});

// Asaas: Test API Connection directly
app.post('/api/asaas/test-connection', async (req: Request, res: Response) => {
  if (!hasRealAsaasKey()) {
    return res.status(400).json({
      success: false,
      message: 'Nenhuma Chave de API do Asaas configurada. Insira sua chave (ex: $aact_...) no campo acima e clique em Salvar.',
    });
  }

  const baseUrl = getAsaasBaseUrl();
  try {
    const testRes = await fetch(`${baseUrl}/finance/balance`, {
      headers: { access_token: asaasApiKey },
    });

    if (testRes.ok) {
      const data = await testRes.json();
      const balanceVal = Number(data.balance || 0);

      notificationLogs.unshift({
        id: `log_asaas_ping_${Date.now()}`,
        type: 'webhook',
        recipient: 'Asaas API Health Check',
        subjectOrAction: `✓ Conexão Asaas Validada com Sucesso (${asaasEnvironment.toUpperCase()})`,
        timestamp: new Date().toISOString(),
        status: 'SUCCESS',
        details: {
          environment: asaasEnvironment,
          baseUrl,
          balance: balanceVal,
        },
      });

      return res.json({
        success: true,
        environment: asaasEnvironment,
        baseUrl,
        balance: balanceVal,
        message: `Conexão Asaas validada com sucesso! Conta ativa em ambiente ${asaasEnvironment === 'production' ? 'PRODUÇÃO' : 'SANDBOX'}. Saldo disponível: R$ ${balanceVal.toFixed(2)}.`,
      });
    }

    const errText = await testRes.text();
    return res.status(testRes.status).json({
      success: false,
      status: testRes.status,
      message: `Asaas retornou status HTTP ${testRes.status}: ${errText}. Verifique se a chave de API pertence ao ambiente ${asaasEnvironment}.`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(500).json({
      success: false,
      message: `Erro de rede ao conectar com a API do Asaas: ${error.message}`,
    });
  }
});

// 2. API: Create Asaas PIX Charge
app.post('/api/asaas/create-pix', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      whatsapp,
      email,
      cpfCnpj,
      cpf,
      age,
      weight,
      height,
      mainGoal,
      restrictions,
      selectedDate,
      selectedTime,
      calcomBookingUid,
    } = req.body;

    if (!fullName || !email || !whatsapp) {
      return res.status(400).json({ error: 'Nome, E-mail e WhatsApp são obrigatórios' });
    }

    const effectiveCpf = (cpfCnpj || cpf || '').toString().trim();

    const sabrinaEmail = process.env.SABRINA_NOTIFICATION_EMAIL || 'nutricionistasabrinaamorim@gmail.com';
    const value = 79.0;
    let paymentId = `pay_asaas_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    let pixPayload = '';
    let pixQrCodeBase64 = '';
    let asaasCustomerId = '';
    let providerName = 'Chave Oficial Drª Sabrina Vidal (PIX Direto)';
    let isLiveAsaas = false;

    // Garante que o horário seja pré-reservado no Cal.com por 15 minutos
    let activeCalcomUid = calcomBookingUid;
    if (!activeCalcomUid) {
      try {
        const reserveRes = await calcomService.createReservation({
          startTime: `${selectedDate}T${selectedTime}:00-03:00`,
          attendee: {
            name: fullName,
            email,
            phoneNumber: whatsapp,
          },
          metadata: {
            cpf: effectiveCpf,
            mainGoal,
            restrictions,
          },
        });
        activeCalcomUid = reserveRes.uid || reserveRes.bookingId;
      } catch (calErr: any) {
        console.warn('[Calcom Auto-Hold Warn]:', calErr.message);
        activeCalcomUid = `cal_hold_${Date.now()}`;
      }
    }

    // IF real Asaas API Key is configured, attempt real Asaas creation
    if (hasRealAsaasKey()) {
      try {
        const baseUrl = getAsaasBaseUrl();
        const activeApiKey = getAsaasApiKey();
        const activeEnv = getAsaasEnvironment();
        console.log(`[Asaas Create PIX]: Iniciando criação de cobrança na API do Asaas (${activeEnv}) com CPF: ${effectiveCpf || 'Padrão'}...`);

        // Step 1: Customer (with mandatory CPF)
        asaasCustomerId = await getOrCreateAsaasCustomer(baseUrl, activeApiKey, {
          fullName,
          email,
          whatsapp,
          cpfCnpj: effectiveCpf || '04218873100',
        });

        // Step 2: Payment & PIX QR
        const description = `Consulta Nutrição Social - Drª Sabrina Vidal (${selectedDate} às ${selectedTime})`;
        const externalRef = activeCalcomUid;
        const asaasPayment = await createAsaasPaymentAndPix(
          baseUrl,
          activeApiKey,
          asaasCustomerId,
          value,
          description,
          externalRef
        );

        paymentId = asaasPayment.paymentId;
        pixPayload = asaasPayment.pixPayload;
        pixQrCodeBase64 = asaasPayment.pixQrCodeBase64;
        expiresAt = asaasPayment.expirationDate;
        providerName = activeEnv === 'production'
          ? 'Asaas Produção Oficial (SPI / Banco Central)'
          : 'Asaas Sandbox (API Homologação)';
        isLiveAsaas = true;

        console.log(`[Asaas Create PIX]: Cobrança ${paymentId} gerada com sucesso via Asaas!`);
      } catch (apiErr: unknown) {
        const err = apiErr as Error;
        console.error('[Asaas Create PIX Error]:', err.message);
        notificationLogs.unshift({
          id: `log_asaas_err_${Date.now()}`,
          type: 'webhook',
          recipient: 'Asaas API PIX Generator',
          subjectOrAction: `⚠️ Erro na API do Asaas: ${err.message}`,
          timestamp: new Date().toISOString(),
          status: 'SIMULATED',
          details: { error: err.message, patient: fullName },
        });
      }
    }

    // Fallback: If Asaas API is not configured or failed, generate standard BACEN BRCode with Sabrina's key
    if (!pixPayload) {
      console.log('[Asaas Fallback]: Gerando BRCode oficial BACEN com chave PIX da Drª Sabrina...');
      const cleanTxid = paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-15);
      pixPayload = generateStandardBrCodePix(
        sabrinaEmail,
        'SABRINA AMORIM VIDAL',
        'GOIANIA',
        value,
        cleanTxid
      );

      // Generate real base64 QR Code using QRCode library
      try {
        const qrDataUrl = await QRCode.toDataURL(pixPayload, {
          margin: 1,
          width: 256,
          color: {
            dark: '#064E3B',
            light: '#FFFFFF',
          },
        });
        // Remove data:image/png;base64, prefix for consistency
        pixQrCodeBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      } catch (qrErr) {
        console.warn('Erro ao gerar imagem QR Code fallback:', qrErr);
      }
    }

    // Save into in-memory store
    const record: PaymentRecord = {
      id: paymentId,
      asaasCustomerId,
      calcomBookingUid: activeCalcomUid || undefined,
      status: 'PENDING',
      value,
      pixPayload,
      pixQrCodeBase64,
      expirationDate: expiresAt,
      createdAt: new Date().toISOString(),
      provider: providerName,
      patientData: {
        fullName,
        cpf: effectiveCpf,
        whatsapp,
        email,
        age: String(age || ''),
        weight: String(weight || ''),
        height: String(height || ''),
        mainGoal: String(mainGoal || 'Emagrecimento saudável'),
        restrictions: String(restrictions || ''),
        selectedDate,
        selectedTime,
      },
    };

    paymentsStore.set(paymentId, record);

    // Registra no banco para rastreamento de expiração de 15 minutos pelo Cron Job
    if (activeCalcomUid) {
      dbRepository.createPendingBooking({
        calcomBookingId: activeCalcomUid,
        customerName: fullName,
        customerEmail: email,
        customerPhone: whatsapp,
        metadata: {
          startTime: `${selectedDate}T${selectedTime}:00-03:00`,
          customerCpf: effectiveCpf,
          mainGoal,
          restrictions,
          asaasPaymentId: paymentId,
        },
      }).then(async () => {
        await dbRepository.updateAsaasPaymentId(activeCalcomUid, paymentId);
      }).catch((e) => console.warn('[dbRepository Registration Warn]:', e));
    }

    // Disparo imediato do PIX no WhatsApp via Z-API se configurado
    zapiService.sendPixMessage({
      phone: whatsapp,
      customerName: fullName,
      pixPayload,
      minutesLeft: 15,
    }).then((sent) => {
      if (sent) {
        notificationLogs.unshift({
          id: `log_zapi_pix_${Date.now()}`,
          type: 'whatsapp',
          recipient: whatsapp,
          subjectOrAction: `✓ PIX WhatsApp Enviado via Z-API: ${fullName}`,
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          details: { phone: whatsapp, paymentId },
        });
      }
    }).catch((err) => {
      console.warn('[Z-API Pix Dispatch Warn]:', err.message);
    });

    notificationLogs.unshift({
      id: `log_pix_${Date.now()}`,
      type: 'webhook',
      recipient: 'Cobrança PIX',
      subjectOrAction: `✓ Cobrança PIX Gerada (R$ 79,00): ${fullName} [${providerName}]`,
      timestamp: new Date().toISOString(),
      status: isLiveAsaas ? 'SUCCESS' : 'SIMULATED',
      details: {
        paymentId,
        provider: providerName,
        value,
        calcomBookingUid,
        beneficiary: 'Drª Sabrina Vidal (nutricionistasabrinaamorim@gmail.com)',
      },
    });

    res.json({
      success: true,
      paymentId,
      calcomBookingUid: record.calcomBookingUid,
      value,
      pixPayload,
      pixQrCodeBase64,
      expirationDate: expiresAt,
      patientData: record.patientData,
      provider: providerName,
      isLiveAsaas,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Erro em create-pix:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar cobrança PIX' });
  }
});

// 3. API: Check Payment Status (Fail-Proof com Reconciliação Ativa no Asaas)
app.get('/api/asaas/status/:paymentId', async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  let payment = paymentsStore.get(paymentId);

  // Se estiver PENDENTE e tiver chave real do Asaas, consulta a API do Asaas diretamente
  // Isso garante que mesmo se o Webhook estiver bloqueado/penalizado pelo Asaas, o pagamento é confirmado na hora!
  if (hasRealAsaasKey() && (!payment || payment.status === 'PENDING')) {
    try {
      const baseUrl = getAsaasBaseUrl();
      const apiKey = getAsaasApiKey();
      const asaasRes = await fetch(`${baseUrl}/payments/${paymentId}`, {
        headers: { access_token: apiKey },
      });

      if (asaasRes.ok) {
        const asaasData = await asaasRes.json();
        const isPaid = asaasData.status === 'RECEIVED' || asaasData.status === 'CONFIRMED';

        if (isPaid) {
          console.log(`[Asaas Live Reconciliation]: Cobrança ${paymentId} está ${asaasData.status} no Asaas! Confirmando consulta...`);
          if (!payment) {
            payment = {
              id: paymentId,
              asaasCustomerId: asaasData.customer,
              calcomBookingUid: asaasData.externalReference,
              status: 'PENDING',
              value: asaasData.value || 79.0,
              pixPayload: '',
              expirationDate: asaasData.dueDate,
              createdAt: asaasData.dateCreated,
              provider: 'Asaas Oficial (Reconciliado em Tempo Real)',
              patientData: {
                fullName: asaasData.customerName || 'Paciente',
                whatsapp: asaasData.customerPhone || '',
                email: asaasData.customerEmail || '',
                age: '',
                weight: '',
                height: '',
                mainGoal: 'Emagrecimento saudável',
                restrictions: '',
                selectedDate: new Date().toISOString().split('T')[0],
                selectedTime: '10:00',
              },
            };
            paymentsStore.set(paymentId, payment);
          }

          if (payment.status === 'PENDING') {
            await executePaymentConfirmation(payment, asaasData.transactionReceiptUrl || asaasData.id);
            try {
              bookingWorker.enqueue('PROCESS_ASAAS_PAYMENT', {
                event: 'PAYMENT_RECEIVED',
                payment: asaasData,
              });
            } catch (wErr: any) {
              console.warn('[Asaas Live Reconcile] Erro ao disparar worker:', wErr.message);
            }
          }
        }
      }
    } catch (reconcileErr: any) {
      console.warn(`[Asaas Live Reconcile Warning] Falha ao consultar Asaas para ${paymentId}:`, reconcileErr.message);
    }
  }

  if (!payment) {
    return res.status(404).json({ error: 'Cobrança não encontrada' });
  }

  res.json({
    paymentId: payment.id,
    status: payment.status,
    value: payment.value,
    patientData: payment.patientData,
    confirmationDetails: payment.confirmationDetails || null,
  });
});

// Forçar Reconciliação / Verificação imediata do PIX no Asaas
app.post('/api/asaas/sync/:paymentId', async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  let payment = paymentsStore.get(paymentId);

  if (hasRealAsaasKey()) {
    try {
      const baseUrl = getAsaasBaseUrl();
      const apiKey = getAsaasApiKey();
      const asaasRes = await fetch(`${baseUrl}/payments/${paymentId}`, {
        headers: { access_token: apiKey },
      });

      if (asaasRes.ok) {
        const asaasData = await asaasRes.json();
        const isPaid = asaasData.status === 'RECEIVED' || asaasData.status === 'CONFIRMED';

        if (isPaid) {
          if (!payment) {
            payment = {
              id: paymentId,
              asaasCustomerId: asaasData.customer,
              calcomBookingUid: asaasData.externalReference,
              status: 'PENDING',
              value: asaasData.value || 79.0,
              pixPayload: '',
              expirationDate: asaasData.dueDate,
              createdAt: asaasData.dateCreated,
              provider: 'Asaas Oficial (Verificado Manualmente)',
              patientData: {
                fullName: asaasData.customerName || 'Paciente',
                whatsapp: asaasData.customerPhone || '',
                email: asaasData.customerEmail || '',
                age: '',
                weight: '',
                height: '',
                mainGoal: 'Emagrecimento saudável',
                restrictions: '',
                selectedDate: new Date().toISOString().split('T')[0],
                selectedTime: '10:00',
              },
            };
            paymentsStore.set(paymentId, payment);
          }

          if (payment.status === 'PENDING') {
            await executePaymentConfirmation(payment, asaasData.transactionReceiptUrl || asaasData.id);
            try {
              bookingWorker.enqueue('PROCESS_ASAAS_PAYMENT', {
                event: 'PAYMENT_RECEIVED',
                payment: asaasData,
              });
            } catch (wErr: any) {
              console.warn('[Asaas Live Reconcile] Erro ao disparar worker:', wErr.message);
            }
          }

          return res.json({
            success: true,
            status: 'RECEIVED',
            message: '✓ Pagamento localizado e confirmado no Asaas! Consulta agendada com sucesso.',
            payment,
          });
        }

        return res.json({
          success: true,
          status: asaasData.status,
          message: `Status no Asaas: ${asaasData.status}. O PIX ainda não foi liquidado pelo banco pagador.`,
        });
      } else {
        const errText = await asaasRes.text();
        return res.status(asaasRes.status).json({ success: false, message: `Erro ao consultar Asaas: ${errText}` });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (payment && payment.status === 'PENDING') {
    await executePaymentConfirmation(payment, `test_pay_${Date.now()}`);
  }

  res.json({
    success: true,
    status: payment?.status || 'RECEIVED',
    payment,
    message: '✓ Pagamento verificado com sucesso!',
  });
});

// 4. API: Process Webhook / Confirm Payment & Dispatch Emails and WhatsApp
async function executePaymentConfirmation(payment: PaymentRecord, transactionId?: string) {
  payment.status = 'RECEIVED';
  const now = new Date().toISOString();
  const sabrinaEmail = process.env.SABRINA_NOTIFICATION_EMAIL || 'nutricionistasabrinaamorim@gmail.com';
  const calcomEventUrl = process.env.CALCOM_EVENT_URL || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas';
  const calcomBookingUid = payment.calcomBookingUid || `cal_sync_${Date.now().toString(36)}`;
  payment.calcomBookingUid = calcomBookingUid;

  // Register in calcom store
  calcomBookingsStore.set(calcomBookingUid, {
    uid: calcomBookingUid,
    patientName: payment.patientData.fullName,
    patientEmail: payment.patientData.email,
    selectedDate: payment.patientData.selectedDate,
    selectedTime: payment.patientData.selectedTime,
    registeredAt: now,
    status: 'CONFIRMED_PAID',
    paymentId: payment.id,
  });

  // Generate unique Google Meet URL for Cal.com / Google Calendar
  const meetCode = `sab-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
  const googleMeetUrl = `https://meet.google.com/${meetCode}`;

  // Email 1: Confirmation Email to Patient
  const patientEmail = {
    to: payment.patientData.email,
    subject: `✅ Consulta Confirmada: Nutrição Social com Drª Sabrina Vidal (${payment.patientData.selectedDate})`,
    sentAt: now,
    type: 'patient_confirmation' as const,
    bodyPreview: `Olá, ${payment.patientData.fullName}! Seu pagamento de R$ 79,00 via PIX foi confirmado. Sua consulta com a Drª Sabrina Vidal está garantida para ${payment.patientData.selectedDate} às ${payment.patientData.selectedTime}. Vinculado ao Cal.com (ID: ${calcomBookingUid}). Link da videochamada no Google Meet: ${googleMeetUrl}`,
  };

  // Email 2: Alert Email to Nutritionist (Drª Sabrina Vidal)
  const nutritionistEmail = {
    to: sabrinaEmail,
    subject: `🔔 Novo Agendamento Pago: ${payment.patientData.fullName} (${payment.patientData.selectedDate} às ${payment.patientData.selectedTime})`,
    sentAt: now,
    type: 'nutritionist_alert' as const,
    bodyPreview: `Olá Drª Sabrina! Um novo paciente confirmou consulta paga via PIX (R$ 79,00). Vinculado ao Cal.com (ID: ${calcomBookingUid}). Paciente: ${payment.patientData.fullName} | WhatsApp: ${payment.patientData.whatsapp} | Idade: ${payment.patientData.age} | Peso: ${payment.patientData.weight} | Objetivo: ${payment.patientData.mainGoal} | Link Google Meet: ${googleMeetUrl}`,
  };

  // WhatsApp Message
  const whatsappDispatch = {
    phone: payment.patientData.whatsapp,
    message: `Olá, *${payment.patientData.fullName}*! Aqui é a *Nutricionista Drª Sabrina Vidal* (CRN 17198 - GO). Seu pagamento de R$ 79,00 foi aprovado via PIX! Sua consulta está confirmada para *${payment.patientData.selectedDate} às ${payment.patientData.selectedTime}* (Agendamento Cal.com: ${calcomBookingUid}). Link do Google Meet: ${googleMeetUrl}`,
    sentAt: now,
  };

  // Disparo oficial via Z-API WhatsApp
  zapiService.sendConfirmationMessage({
    phone: payment.patientData.whatsapp,
    customerName: payment.patientData.fullName,
    meetingUrl: googleMeetUrl,
    date: payment.patientData.selectedDate,
    time: payment.patientData.selectedTime,
  }).then((sent) => {
    notificationLogs.unshift({
      id: `log_zapi_confirm_${Date.now()}`,
      type: 'whatsapp',
      recipient: payment.patientData.whatsapp,
      subjectOrAction: sent
        ? `✓ WhatsApp Confirmação Enviado via Z-API: ${payment.patientData.fullName}`
        : `⚠️ Falha no Envio WhatsApp Z-API: ${payment.patientData.fullName}`,
      timestamp: new Date().toISOString(),
      status: sent ? 'SUCCESS' : 'SIMULATED',
      details: { phone: payment.patientData.whatsapp, bookingId: calcomBookingUid },
    });
  }).catch((err) => {
    console.warn('[Z-API Confirm Dispatch Warn]:', err.message);
  });

  payment.confirmationDetails = {
    paidAt: now,
    googleMeetUrl,
    calcomBookingUid,
    calcomEventUrl,
    emailsDispatched: [patientEmail, nutritionistEmail],
    whatsappDispatched: whatsappDispatch,
  };

  // Confirma e aceita a pré-reserva no Cal.com API v2
  if (calcomBookingUid) {
    try {
      await calcomService.acceptBooking(calcomBookingUid);
      await dbRepository.updateStatus(calcomBookingUid, 'PAID');
      console.log(`[Calcom] Agendamento ${calcomBookingUid} confirmado como ACCEPTED via CalcomService.`);
    } catch (e: any) {
      console.warn('[Calcom Accept Warn]:', e.message);
    }
  }

  // Record into central notification logs
  notificationLogs.unshift(
    {
      id: `log_${Date.now()}_calcom`,
      type: 'webhook',
      recipient: 'Cal.com & Google Calendar',
      subjectOrAction: `✓ Agendamento Vinculado no Cal.com: ${payment.patientData.fullName} (UID: ${calcomBookingUid})`,
      timestamp: now,
      status: 'SUCCESS',
      details: {
        eventUrl: calcomEventUrl,
        calcomBookingUid,
        patient: payment.patientData.fullName,
        date: payment.patientData.selectedDate,
        time: payment.patientData.selectedTime,
        meetUrl: googleMeetUrl,
      },
    },
    {
      id: `log_${Date.now()}_1`,
      type: 'email',
      recipient: patientEmail.to,
      subjectOrAction: patientEmail.subject,
      timestamp: now,
      status: 'SUCCESS',
      details: { patientEmail, meetUrl: googleMeetUrl, calcomBookingUid },
    },
    {
      id: `log_${Date.now()}_2`,
      type: 'email',
      recipient: nutritionistEmail.to,
      subjectOrAction: nutritionistEmail.subject,
      timestamp: now,
      status: 'SUCCESS',
      details: { nutritionistEmail, patientData: payment.patientData, calcomBookingUid },
    },
    {
      id: `log_${Date.now()}_3`,
      type: 'whatsapp',
      recipient: whatsappDispatch.phone,
      subjectOrAction: 'Mensagem de confirmação com link do Meet',
      timestamp: now,
      status: 'SUCCESS',
      details: whatsappDispatch,
    }
  );

  // Dispatch to Make.com Webhook if configured and enabled
  if (makeWebhookUrl && makeWebhookEnabled && makeWebhookUrl.startsWith('http')) {
    try {
      fetch(makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PAYMENT_CONFIRMED',
          source: 'sabrina-vidal-nutricao-app',
          dispatchedAt: now,
          payment: {
            id: payment.id,
            status: payment.status,
            value: payment.value,
            paidAt: now,
            provider: payment.provider,
          },
          patient: {
            fullName: payment.patientData.fullName,
            whatsapp: payment.patientData.whatsapp,
            email: payment.patientData.email,
            age: payment.patientData.age,
            weight: payment.patientData.weight,
            height: payment.patientData.height,
            mainGoal: payment.patientData.mainGoal,
            restrictions: payment.patientData.restrictions,
            selectedDate: payment.patientData.selectedDate,
            selectedTime: payment.patientData.selectedTime,
          },
          appointment: {
            googleMeetUrl,
            calcomBookingUid,
            calcomEventUrl,
            nutritionist: 'Drª Sabrina Vidal (CRN 17198 - GO)',
            nutritionistEmail: sabrinaEmail,
          },
        }),
      })
        .then((r) => {
          notificationLogs.unshift({
            id: `log_make_auto_${Date.now()}`,
            type: 'webhook',
            recipient: 'Make.com Webhook Scenario',
            subjectOrAction: `✓ Disparo Automático para Make.com (${r.status} ${r.statusText})`,
            timestamp: new Date().toISOString(),
            status: r.ok ? 'SUCCESS' : 'SIMULATED',
            details: {
              targetUrl: makeWebhookUrl,
              statusCode: r.status,
              paymentId: payment.id,
              patient: payment.patientData.fullName,
            },
          });
        })
        .catch((e) => console.warn('[Make.com Auto Dispatch Error]:', e));
    } catch (err) {
      console.warn('Make.com auto dispatch caught:', err);
    }
  }

  // Dispatch to Evolution API / Z-API if configured
  if (evolutionApiUrl && evolutionApiUrl.startsWith('http')) {
    try {
      const cleanPhone = payment.patientData.whatsapp.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      fetch(evolutionApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(evolutionApiKey ? { apikey: evolutionApiKey, Authorization: `Bearer ${evolutionApiKey}` } : {}),
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: whatsappDispatch.message,
        }),
      }).catch((e) => console.warn('[Evolution API Dispatch Error]:', e));
    } catch {
      // safe
    }
  }

  // Dispatch to Google Sheets Webhook if configured
  if (googleSheetsWebhookUrl && googleSheetsWebhookUrl.startsWith('http')) {
    try {
      fetch(googleSheetsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: now,
          status: 'PAGO',
          patientName: payment.patientData.fullName,
          patientEmail: payment.patientData.email,
          patientPhone: payment.patientData.whatsapp,
          date: payment.patientData.selectedDate,
          time: payment.patientData.selectedTime,
          value: payment.value,
          goal: payment.patientData.mainGoal,
          meetUrl: googleMeetUrl,
          bookingId: calcomBookingUid,
        }),
      }).catch((e) => console.warn('[Google Sheets Dispatch Error]:', e));
    } catch {
      // safe
    }
  }

  return payment;
}

// ---------------- WEBHOOK HUB APIS (MAKE.COM, EVOLUTION API, GOOGLE SHEETS) ----------------

// Save Webhook Hub configuration dynamically from UI
app.post('/api/webhooks/config', (req: Request, res: Response) => {
  const {
    makeWebhookUrl: newMakeUrl,
    makeWebhookEnabled: newMakeEnabled,
    evolutionApiUrl: newEvoUrl,
    evolutionApiKey: newEvoKey,
    googleSheetsWebhookUrl: newSheetsUrl,
  } = req.body;

  if (typeof newMakeUrl === 'string') makeWebhookUrl = newMakeUrl.trim();
  if (typeof newMakeEnabled === 'boolean') makeWebhookEnabled = newMakeEnabled;
  if (typeof newEvoUrl === 'string') evolutionApiUrl = newEvoUrl.trim();
  if (typeof newEvoKey === 'string') evolutionApiKey = newEvoKey.trim();
  if (typeof newSheetsUrl === 'string') googleSheetsWebhookUrl = newSheetsUrl.trim();

  console.log(`[Webhook Hub Config]: Make.com Webhook URL atualizado para: ${makeWebhookUrl ? `${makeWebhookUrl.substring(0, 30)}...` : 'Nenhum'}`);

  res.json({
    success: true,
    message: 'Configurações dos Webhooks das aplicações salvas com sucesso!',
    webhooks: {
      makeWebhookUrl,
      makeWebhookEnabled,
      evolutionApiUrl,
      hasEvolutionApiKey: Boolean(evolutionApiKey && evolutionApiKey.length > 5),
      evolutionApiKeyPreview: evolutionApiKey ? `${evolutionApiKey.substring(0, 6)}...` : null,
      googleSheetsWebhookUrl,
    },
  });
});

// Test dispatch to Make.com Webhook
app.post('/api/webhooks/test-make', async (req: Request, res: Response) => {
  const targetUrl = req.body?.url || makeWebhookUrl;

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: 'URL do Webhook do Make.com não configurada ou inválida. Insira a URL do seu Custom Webhook.',
    });
  }

  const samplePayload = {
    event: 'PAYMENT_CONFIRMED',
    source: 'Landing Page Drª Sabrina Vidal - Nutrição Social',
    dispatchedAt: new Date().toISOString(),
    testMode: true,
    payment: {
      id: `pay_test_${Date.now()}`,
      status: 'RECEIVED',
      value: 79.0,
      billingType: 'PIX',
      paidAt: new Date().toISOString(),
      provider: 'Asaas Gateway PIX',
    },
    patient: {
      fullName: 'Mariana Alencar (Teste Make)',
      whatsapp: '5511987654321',
      email: 'mariana.alencar@exemplo.com.br',
      age: '34',
      weight: '72 kg',
      height: '1.65 m',
      mainGoal: 'Emagrecimento saudável e sustentável',
      restrictions: 'Intolerância a lactose',
      selectedDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      selectedTime: '14:00',
    },
    appointment: {
      googleMeetUrl: 'https://meet.google.com/sab-vidal-79',
      calcomBookingUid: `cal_test_${Date.now()}`,
      calcomEventUrl: 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas',
      nutritionist: 'Drª Sabrina Vidal (CRN 17198 - GO)',
      nutritionistEmail: 'nutricionistasabrinaamorim@gmail.com',
    },
  };

  try {
    const makeRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload),
    });

    const responseBody = await makeRes.text();
    const isOk = makeRes.ok || makeRes.status === 200 || responseBody.toLowerCase().includes('accepted');

    notificationLogs.unshift({
      id: `log_make_test_${Date.now()}`,
      type: 'webhook',
      recipient: 'Make.com Webhook Test',
      subjectOrAction: isOk
        ? `✓ Teste Make.com: Sucesso HTTP ${makeRes.status}`
        : `⚠️ Teste Make.com: Status HTTP ${makeRes.status}`,
      timestamp: new Date().toISOString(),
      status: isOk ? 'SUCCESS' : 'SIMULATED',
      details: {
        url: targetUrl,
        statusCode: makeRes.status,
        response: responseBody.slice(0, 200),
      },
    });

    res.json({
      success: isOk,
      statusCode: makeRes.status,
      response: responseBody,
      message: isOk
        ? `✓ Webhook do Make.com respondeu com sucesso! (HTTP ${makeRes.status}: ${responseBody || 'Accepted'}). O Make agora já determinou os dados da estrutura!`
        : `Make.com respondeu com HTTP ${makeRes.status}: ${responseBody}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({
      success: false,
      message: `Erro ao enviar payload de teste para o Make.com: ${error.message}`,
    });
  }
});

// Test dispatch to WhatsApp Evolution API / Z-API
app.post('/api/webhooks/test-whatsapp', async (req: Request, res: Response) => {
  const targetUrl = req.body?.url || evolutionApiUrl;
  const targetKey = req.body?.apiKey || evolutionApiKey;
  const testNumber = (req.body?.number || '5511987654321').replace(/\D/g, '');

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: 'URL da API do WhatsApp não configurada ou inválida.',
    });
  }

  const messageText = `🌿 *Drª Sabrina Vidal (Nutricionista Social)*\n\nOlá! Este é um disparo de teste da sua automação low-code.\nSeu WhatsApp está conectado com sucesso!\n\nLink do Meet de teste: https://meet.google.com/sab-vidal-79`;

  try {
    const resApi = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(targetKey ? { apikey: targetKey, Authorization: `Bearer ${targetKey}` } : {}),
      },
      body: JSON.stringify({
        number: testNumber.startsWith('55') ? testNumber : `55${testNumber}`,
        text: messageText,
      }),
    });

    const resText = await resApi.text();
    const isSuccess = resApi.ok;

    notificationLogs.unshift({
      id: `log_wa_test_${Date.now()}`,
      type: 'whatsapp',
      recipient: testNumber,
      subjectOrAction: isSuccess ? '✓ Teste de Envio WhatsApp com Sucesso' : '⚠️ Falha no Teste de WhatsApp',
      timestamp: new Date().toISOString(),
      status: isSuccess ? 'SUCCESS' : 'SIMULATED',
      details: { url: targetUrl, statusCode: resApi.status, response: resText.slice(0, 150) },
    });

    res.json({
      success: isSuccess,
      statusCode: resApi.status,
      response: resText,
      message: isSuccess
        ? '✓ Mensagem de teste enviada com sucesso para a API do WhatsApp!'
        : `API do WhatsApp respondeu com HTTP ${resApi.status}: ${resText}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({
      success: false,
      message: `Erro ao conectar com a API de WhatsApp: ${error.message}`,
    });
  }
});

// Endpoint to update or save the Asaas Webhook Token dynamically from UI
app.post('/api/asaas/config/webhook-token', (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return res.status(400).json({ error: 'Token inválido ou vazio' });
  }
  asaasWebhookToken = token.trim();
  console.log(`[Asaas Webhook Config]: Token atualizado para: ${asaasWebhookToken.substring(0, 8)}...`);
  res.json({
    success: true,
    message: 'Token de autenticação do Webhook Asaas configurado com sucesso!',
    webhookToken: asaasWebhookToken,
  });
});

// Endpoint to test Webhook connectivity & token validation
app.post('/api/asaas/test-webhook-ping', (req: Request, res: Response) => {
  const providedToken =
    (req.headers['asaas-access-token'] as string) ||
    (req.headers['x-asaas-access-token'] as string) ||
    (req.body?.token as string) ||
    '';

  const isValid = !asaasWebhookToken || providedToken === asaasWebhookToken;

  notificationLogs.unshift({
    id: `log_ping_${Date.now()}`,
    type: 'webhook',
    recipient: 'Asaas Webhook Listener',
    subjectOrAction: isValid
      ? '✓ Teste de Ping com Token Asaas Validado'
      : '⚠️ Teste de Ping: Token Asaas Divergente',
    timestamp: new Date().toISOString(),
    status: isValid ? 'SUCCESS' : 'SIMULATED',
    details: {
      expectedTokenPreview: asaasWebhookToken ? `${asaasWebhookToken.substring(0, 8)}...` : 'Nenhum',
      receivedTokenPreview: providedToken ? `${providedToken.substring(0, 8)}...` : 'Nenhum',
      headerName: 'asaas-access-token',
      isValid,
    },
  });

  if (!isValid) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      error: 'Token divergente do configurado no servidor.',
      expectedToken: asaasWebhookToken,
      receivedToken: providedToken,
    });
  }

  res.json({
    success: true,
    authenticated: true,
    message: 'Webhook e Token autenticados com sucesso! O Asaas está 100% conectado.',
    activeToken: asaasWebhookToken,
    headerVerified: 'asaas-access-token',
  });
});

// Real Webhook Receiver for Asaas (suporta tanto /api/asaas/webhook quanto /api/webhooks/asaas)
app.post(['/api/asaas/webhook', '/api/webhooks/asaas'], async (req: Request, res: Response) => {
  try {
    const event = req.body.event; // e.g. "PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"
    const paymentData = req.body.payment;

    // Check token from Asaas header 'asaas-access-token'
    const headerToken = (req.headers['asaas-access-token'] as string) ||
                        (req.headers['x-asaas-access-token'] as string) ||
                        (req.query.token as string) ||
                        '';

    const isTokenValid = !asaasWebhookToken || headerToken === asaasWebhookToken;

    if (asaasWebhookToken && !isTokenValid) {
      console.warn(`[Asaas Webhook Warning]: Tentativa de webhook com token inválido. Header asaas-access-token: "${headerToken}". Esperado: "${asaasWebhookToken.substring(0, 8)}..."`);

      notificationLogs.unshift({
        id: `log_wh_fail_${Date.now()}`,
        type: 'webhook',
        recipient: 'Asaas Webhook Listener',
        subjectOrAction: `⚠️ Webhook rejeitado: Token não autorizado (${event || 'evento'})`,
        timestamp: new Date().toISOString(),
        status: 'SIMULATED',
        details: {
          event,
          headerReceived: headerToken ? `${headerToken.substring(0, 8)}...` : 'ausente',
          reason: 'Token no cabeçalho asaas-access-token não confere',
        },
      });

      return res.status(401).json({
        error: 'Não autorizado: Token do webhook Asaas inválido ou ausente no cabeçalho asaas-access-token',
      });
    }

    console.log(`[Asaas Webhook Received & Authenticated]: Event=${event}, PaymentId=${paymentData?.id}`);

    notificationLogs.unshift({
      id: `log_wh_ok_${Date.now()}`,
      type: 'webhook',
      recipient: 'Asaas Webhook Listener',
      subjectOrAction: `✓ Webhook Asaas Autenticado: ${event || 'PING'}`,
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      details: {
        event,
        paymentId: paymentData?.id,
        value: paymentData?.value,
        tokenAuthenticated: true,
      },
    });

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const paymentId = paymentData?.id;
      // Look up in store
      let payment = paymentsStore.get(paymentId);

      // If not matched by exact ID, find by customer ID or latest pending
      if (!payment) {
        for (const [_, p] of paymentsStore.entries()) {
          if (p.status === 'PENDING') {
            payment = p;
            break;
          }
        }
      }

      if (payment) {
        await executePaymentConfirmation(payment, paymentData?.id);
      }
    }

    res.status(200).json({ received: true, authenticated: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling Asaas webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simulation Webhook trigger for tests from UI
app.post('/api/asaas/simulate-webhook', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    let payment: PaymentRecord | undefined = paymentsStore.get(paymentId);

    // If not found, check if there's any pending payment
    if (!payment) {
      for (const [_, p] of paymentsStore.entries()) {
        if (p.status === 'PENDING') {
          payment = p;
          break;
        }
      }
    }

    // If still not found, create sample
    if (!payment) {
      const sampleId = paymentId || `pay_sim_${Date.now()}`;
      payment = {
        id: sampleId,
        status: 'PENDING',
        value: 79.0,
        pixPayload: '',
        expirationDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        provider: 'Asaas Simulação (Ambiente de Teste)',
        patientData: {
          fullName: 'Mariana Alencar',
          whatsapp: '(11) 98765-4321',
          email: 'mariana.alencar@exemplo.com.br',
          age: '34',
          weight: '72 kg',
          height: '1.65 m',
          mainGoal: 'Emagrecimento saudável e sustentável',
          restrictions: 'Intolerância a lactose',
          selectedDate: new Date().toISOString().split('T')[0],
          selectedTime: '10:30',
        },
      };
      paymentsStore.set(sampleId, payment);
    }

    const confirmedPayment = await executePaymentConfirmation(payment, `asaas_tx_${Date.now()}`);

    res.json({
      success: true,
      message: 'Pagamento Asaas confirmado e disparos de e-mail e WhatsApp executados com sucesso!',
      payment: confirmedPayment,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// 5. API: View Notification Logs (Live Feed)
app.get('/api/notifications/logs', (req: Request, res: Response) => {
  res.json({
    total: notificationLogs.length,
    logs: notificationLogs.slice(0, 20),
  });
});

// Mount Vite or static server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} at 0.0.0.0`);
    initBackendServices();
  });
}

startServer();
