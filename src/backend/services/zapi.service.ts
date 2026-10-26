import { getLiveConfig } from '../config/env.config';

export interface ZApiSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rawResponse?: any;
}

export interface ZApiStatusResult {
  success: boolean;
  connected: boolean;
  smartphoneConnected?: boolean;
  message: string;
  sessionStatus?: string;
  error?: string;
}

export class ZApiService {
  private get instanceId(): string {
    return getLiveConfig().zapiInstanceId || process.env.ZAPI_INSTANCE_ID || '';
  }

  private get token(): string {
    return getLiveConfig().zapiToken || process.env.ZAPI_TOKEN || '';
  }

  private get clientToken(): string {
    return getLiveConfig().zapiClientToken || process.env.ZAPI_CLIENT_TOKEN || '';
  }

  private get baseUrl(): string {
    return getLiveConfig().zapiBaseUrl || process.env.ZAPI_BASE_URL || 'https://api.z-api.io';
  }

  constructor() {}

  /**
   * Sanitiza e formata o telefone para o padrão internacional do WhatsApp (55DD9XXXXXXXX).
  /**
   * Sanitiza e formata o telefone para o padrão internacional do WhatsApp (55DD9XXXXXXXX).
   * Insere o 9º dígito se for número de celular no Brasil com 8 dígitos.
   */
  formatPhoneNumber(rawPhone: string): string {
    let clean = (rawPhone || '').replace(/\D/g, '');

    // Remove zero à esquerda do DDD (ex: 011999998888 -> 11999998888)
    if (clean.startsWith('0') && clean.length >= 11) {
      clean = clean.replace(/^0+/, '');
    }

    // Se começar com 55 e tiver 12 dígitos (55 + 2 DDD + 8 dígitos)
    // No Brasil, celulares têm 9 dígitos começando com 9, 8, 7 ou 6
    if (clean.startsWith('55') && clean.length === 12) {
      const ddd = clean.substring(2, 4);
      const number = clean.substring(4);
      if (['6', '7', '8', '9'].includes(number[0])) {
        clean = `55${ddd}9${number}`;
      }
    }

    // Se NÃO começar com 55:
    if (!clean.startsWith('55')) {
      if (clean.length === 10) {
        const ddd = clean.substring(0, 2);
        const number = clean.substring(2);
        if (['6', '7', '8', '9'].includes(number[0])) {
          clean = `55${ddd}9${number}`;
        } else {
          clean = `55${clean}`;
        }
      } else if (clean.length === 11) {
        clean = `55${clean}`;
      }
    }

    return clean;
  }

  /**
   * Verifica o status de conexão da instância e se o WhatsApp está pareado via QR Code.
   */
  async checkStatus(overrides?: {
    instanceId?: string;
    token?: string;
    clientToken?: string;
  }): Promise<ZApiStatusResult> {
    const instId = (overrides?.instanceId || this.instanceId || '').trim();
    const tok = (overrides?.token || this.token || '').trim();
    const clTok = (overrides?.clientToken || this.clientToken || '').trim();

    if (!instId || !tok) {
      return {
        success: false,
        connected: false,
        message: 'Preencha o ID da Instância e o Token da Z-API para testar a conexão.',
      };
    }

    try {
      const url = `${this.baseUrl}/instances/${instId}/token/${tok}/status`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (clTok) {
        headers['Client-Token'] = clTok;
      }

      console.log(`[ZApiService] Verificando status da instância Z-API: ${instId}...`);
      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        const errText = await response.text();
        let parsed = errText;
        try {
          const json = JSON.parse(errText);
          parsed = json.error || json.message || errText;
        } catch {}

        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            connected: false,
            message: `Falha de autenticação na Z-API (Status ${response.status}): ${parsed}. Certifique-se de preencher o Token da Instância e o Client-Token (token de segurança da conta no painel Z-API).`,
            error: parsed,
          };
        }

        if (response.status === 404) {
          return {
            success: false,
            connected: false,
            message: `Instância não encontrada (Status 404): O ID '${instId}' não foi localizado na Z-API.`,
            error: parsed,
          };
        }

        return {
          success: false,
          connected: false,
          message: `Erro retornado pela Z-API (Status ${response.status}): ${parsed}`,
          error: parsed,
        };
      }

      const data = await response.json();
      const isConnected = Boolean(data.connected);
      const isSmartphoneConnected = data.smartphoneConnected !== undefined ? Boolean(data.smartphoneConnected) : true;

      if (isConnected) {
        if (!isSmartphoneConnected) {
          return {
            success: true,
            connected: true,
            smartphoneConnected: false,
            message: '⚠️ A Instância está autenticada, porém o CELULAR físico está DESCONECTADO da internet ou desligado (smartphoneConnected: false). Ative a internet no seu aparelho para as mensagens chegarem.',
            sessionStatus: 'SMARTPHONE_OFFLINE',
          };
        }

        return {
          success: true,
          connected: true,
          smartphoneConnected: true,
          message: '✓ Instância Z-API conectada e pronta para envio no WhatsApp!',
          sessionStatus: 'CONNECTED',
        };
      } else {
        return {
          success: true,
          connected: false,
          message: '⚠️ Instância localizada com sucesso, porém o WhatsApp está DESCONECTADO. É necessário escanear o QR Code no seu aplicativo do WhatsApp.',
          sessionStatus: data.sessionStatus || 'DISCONNECTED',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        connected: false,
        message: `Falha de rede ao conectar à Z-API: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Obtém a imagem do QR Code em Base64 para escaneamento direto na tela.
   */
  async getQrCodeImage(overrides?: {
    instanceId?: string;
    token?: string;
    clientToken?: string;
  }): Promise<{ success: boolean; qrCodeImage?: string; message: string; connected?: boolean }> {
    const instId = (overrides?.instanceId || this.instanceId || '').trim();
    const tok = (overrides?.token || this.token || '').trim();
    const clTok = (overrides?.clientToken || this.clientToken || '').trim();

    if (!instId || !tok) {
      return {
        success: false,
        message: 'Preencha o ID da Instância e o Token da Z-API para obter o QR Code.',
      };
    }

    try {
      const url = `${this.baseUrl}/instances/${instId}/token/${tok}/qr-code/image`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (clTok) {
        headers['Client-Token'] = clTok;
      }

      console.log(`[ZApiService] Solicitando imagem do QR Code da instância ${instId}...`);
      const response = await fetch(url, { method: 'GET', headers });
      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const errDetail = data.error || data.message || text;
        return {
          success: false,
          message: `Erro ao buscar QR Code na Z-API (Status ${response.status}): ${errDetail}`,
        };
      }

      if (data.connected) {
        return {
          success: true,
          connected: true,
          message: '✓ O WhatsApp já está conectado nesta instância! Não precisa ler o QR Code.',
        };
      }

      const qrImage = data.value || data.image || data.qrcode || '';
      if (!qrImage) {
        return {
          success: false,
          message: 'QR Code ainda não foi gerado pela Z-API. Aguarde alguns segundos e tente novamente.',
        };
      }

      return {
        success: true,
        connected: false,
        qrCodeImage: qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`,
        message: 'Aponte a câmera do WhatsApp (Aparelhos Conectados) para o QR Code abaixo.',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Falha ao carregar QR Code: ${error.message}`,
      };
    }
  }

  /**
   * Verifica se o número informado possui conta ativa no WhatsApp na base da Z-API.
   */
  async checkPhoneExists(
    rawPhone: string,
    overrides?: {
      instanceId?: string;
      token?: string;
      clientToken?: string;
    }
  ): Promise<{ success: boolean; exists: boolean; formattedPhone: string; message: string }> {
    const instId = (overrides?.instanceId || this.instanceId || '').trim();
    const tok = (overrides?.token || this.token || '').trim();
    const clTok = (overrides?.clientToken || this.clientToken || '').trim();
    const phone = this.formatPhoneNumber(rawPhone);

    if (!instId || !tok) {
      return {
        success: false,
        exists: false,
        formattedPhone: phone,
        message: 'Preencha o ID da Instância e o Token da Z-API.',
      };
    }

    try {
      const url = `${this.baseUrl}/instances/${instId}/token/${tok}/phone-exists/${phone}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (clTok) {
        headers['Client-Token'] = clTok;
      }

      console.log(`[ZApiService] Verificando existência do telefone ${phone} na Z-API...`);
      const response = await fetch(url, { method: 'GET', headers });
      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        return {
          success: false,
          exists: false,
          formattedPhone: phone,
          message: `Falha ao verificar número (Status ${response.status}): ${data.error || text}`,
        };
      }

      const exists = Boolean(data.exists);
      return {
        success: true,
        exists,
        formattedPhone: data.phone || phone,
        message: exists
          ? `✓ O número ${data.phone || phone} possui WhatsApp ativo!`
          : `⚠️ O número ${phone} NÃO foi localizado no WhatsApp. Verifique se o DDD está correto.`,
      };
    } catch (error: any) {
      return {
        success: false,
        exists: false,
        formattedPhone: phone,
        message: `Erro ao verificar número: ${error.message}`,
      };
    }
  }

  /**
   * Envia uma mensagem de texto simples via Z-API com validação e log detalhado.
   */
  async sendTextMessage(
    rawPhone: string,
    message: string,
    overrides?: {
      instanceId?: string;
      token?: string;
      clientToken?: string;
    }
  ): Promise<ZApiSendResult> {
    const instId = (overrides?.instanceId || this.instanceId || '').trim();
    const tok = (overrides?.token || this.token || '').trim();
    const clTok = (overrides?.clientToken || this.clientToken || '').trim();
    const phone = this.formatPhoneNumber(rawPhone);

    if (!instId || !tok || instId === 'YOUR_INSTANCE_ID') {
      console.warn('[ZApiService] Credenciais Z-API ausentes. Configure o ID da Instância e o Token.');
      return {
        success: false,
        error: 'Credenciais Z-API não configuradas. Preencha o ID da Instância e o Token da Z-API no painel.',
      };
    }

    if (!phone || phone.length < 10) {
      return {
        success: false,
        error: `Telefone inválido (${rawPhone}). Digite o número com DDD (ex: 11999998888 ou 5511999998888).`,
      };
    }

    try {
      console.log(`[ZApiService] Disparando WhatsApp para ${phone} via instância ${instId}...`);
      const url = `${this.baseUrl}/instances/${instId}/token/${tok}/send-text`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (clTok) {
        headers['Client-Token'] = clTok;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: phone,
          message: message,
        }),
      });

      const responseText = await response.text();
      let resData: any = {};
      try {
        resData = JSON.parse(responseText);
      } catch {
        resData = { raw: responseText };
      }

      if (!response.ok) {
        const errorDetail = resData.error || resData.message || responseText;
        console.error(`[ZApiService:ERROR] Falha Z-API (Status ${response.status}):`, errorDetail);
        
        let friendly = `Falha no envio Z-API (Status ${response.status}): ${errorDetail}`;
        if (response.status === 401) {
          friendly = `Falha de autenticação (HTTP 401): ${errorDetail}. Verifique se o Token da Instância e o Client-Token (token de segurança da conta) estão corretos.`;
        } else if (response.status === 400 && String(errorDetail).toLowerCase().includes('not connected')) {
          friendly = `Instância desconectada: ${errorDetail}. Clique no botão 'Escanear QR Code' para parear seu WhatsApp.`;
        }

        return {
          success: false,
          error: friendly,
          rawResponse: resData,
        };
      }

      // Validação caso Z-API responda HTTP 200 porém com erro no corpo
      if (resData.error && String(resData.error).trim().length > 0) {
        console.warn(`[ZApiService:WARN] Z-API respondeu 200 mas com erro no payload:`, resData.error);
        return {
          success: false,
          error: `Z-API recusou a mensagem: ${resData.error}`,
          rawResponse: resData,
        };
      }

      const messageId = resData.zaapId || resData.messageId || resData.id || 'OK';
      console.log(`[ZApiService:SUCCESS] Mensagem enviada com sucesso para ${phone}. ID: ${messageId}`);
      return {
        success: true,
        messageId,
        rawResponse: resData,
      };
    } catch (error: any) {
      console.error(`[ZApiService:FATAL] Erro ao disparar para ${phone}:`, error.message);
      return {
        success: false,
        error: `Erro de conexão com Z-API: ${error.message}`,
      };
    }
  }

  /**
   * Envia o PIX Copia e Cola + Link do QR Code com alerta de 15 minutos de reserva.
   */
  async sendPixMessage(params: {
    phone: string;
    customerName: string;
    pixPayload: string;
    qrCodeUrl?: string;
    minutesLeft?: number;
  }): Promise<boolean> {
    const minutes = params.minutesLeft || 15;
    const firstName = params.customerName.split(' ')[0];

    const message = `🌿 Olá, *${firstName}*! Tudo bem?\n\n` +
      `Recebemos seu agendamento para a *Consulta de Nutrição Social com a Dra. Sabrina Vidal*! 👩‍⚕️\n\n` +
      `Seu horário está *pré-reservado por ${minutes} minutos*. Para garantir sua vaga na agenda, realize o pagamento via PIX:\n\n` +
      `📋 Copie o código PIX Copia e Cola abaixo:\n` +
      `\`\`\`${params.pixPayload}\`\`\`\n\n` +
      (params.qrCodeUrl ? `📱 Se preferir escanear o QR Code, acesse o link:\n${params.qrCodeUrl}\n\n` : '') +
      `⏱️ *Atenção:* Caso o pagamento não seja identificado em *${minutes} minutos*, o horário será liberado automaticamente para outro paciente.\n\n` +
      `Assim que o PIX for concluído, você receberá a confirmação com o link da sala no Google Meet! 🎯`;

    const res = await this.sendTextMessage(params.phone, message);
    if (!res.success) {
      console.warn(`[ZApiService] Aviso no envio de PIX WhatsApp: ${res.error}`);
    }
    return res.success;
  }

  /**
   * Envia a mensagem de confirmação imediata pós-pagamento com link da consulta.
   */
  async sendConfirmationMessage(params: {
    phone: string;
    customerName: string;
    meetingUrl?: string;
    date?: string;
    time?: string;
  }): Promise<boolean> {
    const firstName = params.customerName.split(' ')[0];
    const meetLink = params.meetingUrl || 'https://meet.google.com/social-sabrina';

    const message = `🎉 *PAGAMENTO CONFIRMADO!* \n\n` +
      `Olá, *${firstName}*! Seu pagamento PIX foi compensado com sucesso e sua consulta está *100% CONFIRMADA* na agenda da Dra. Sabrina Vidal!\n\n` +
      (params.date && params.time ? `📅 *Data & Horário:* ${params.date} às ${params.time}\n` : '') +
      `📹 *Link da Consulta Online (Google Meet):*\n${meetLink}\n\n` +
      `📝 *Orientações prévias:*\n` +
      `• Conecte-se com 5 minutos de antecedência.\n` +
      `• Tenha em mãos seus exames de sangue recentes caso possua.\n` +
      `• Deixe um copo d'água e caderno para anotações.\n\n` +
      `Qualquer dúvida, basta responder a esta mensagem. Te esperamos! 💚`;

    const res = await this.sendTextMessage(params.phone, message);
    if (!res.success) {
      console.warn(`[ZApiService] Aviso no envio de Confirmação WhatsApp: ${res.error}`);
    }
    return res.success;
  }

  /**
   * Envia a notificação de cancelamento por tempo expirado (15 minutos).
   */
  async sendExpirationMessage(params: {
    phone: string;
    customerName: string;
  }): Promise<boolean> {
    const firstName = params.customerName.split(' ')[0];

    const message = `⏰ *Tempo de reserva expirado*\n\n` +
      `Olá, *${firstName}*. Notamos que o pagamento PIX da sua consulta não foi concluído dentro do prazo limite de 15 minutos.\n\n` +
      `Para mantermos a agenda justa para todos, o horário foi *liberado automaticamente*. \n\n` +
      `Se ainda deseja realizar seu acompanhamento nutricional, basta acessar novamente nosso site e escolher um novo horário disponível! ✨`;

    const res = await this.sendTextMessage(params.phone, message);
    return res.success;
  }
}

export const zapiService = new ZApiService();
