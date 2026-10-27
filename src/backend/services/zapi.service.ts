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
  requiresClientToken?: boolean;
  invalidClientToken?: boolean;
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
    const raw = getLiveConfig().zapiBaseUrl || process.env.ZAPI_BASE_URL || 'https://api.z-api.io';
    try {
      const u = new URL(raw);
      return `${u.protocol}//${u.host}`;
    } catch {
      return 'https://api.z-api.io';
    }
  }

  constructor() {}

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
   * Obtém variantes do número de telefone brasileiro (com e sem o 9º dígito),
   * essencial para compatibilidade com o WhatsApp em DDDs como 62 (Goiás), 11, etc.
   */
  getPhoneVariants(rawPhone: string): string[] {
    let clean = (rawPhone || '').replace(/\D/g, '');
    if (clean.startsWith('0') && clean.length >= 11) {
      clean = clean.replace(/^0+/, '');
    }
    if (!clean.startsWith('55')) {
      clean = `55${clean}`;
    }

    const variants: string[] = [clean];

    // Se tiver 13 dígitos: 55 + DD + 9XXXXXXXX (ex: 5562993431970)
    // Variante com 8 dígitos: 556293431970 (remove o primeiro 9 após o DDD)
    if (clean.length === 13 && clean.startsWith('55')) {
      const ddd = clean.substring(2, 4);
      const rest = clean.substring(5);
      if (clean[4] === '9') {
        variants.push(`55${ddd}${rest}`);
      }
    }

    // Se tiver 12 dígitos: 55 + DD + XXXXXXXX (ex: 556293431970)
    // Variante com 9 dígitos: 5562993431970 (insere o 9 após o DDD)
    if (clean.length === 12 && clean.startsWith('55')) {
      const ddd = clean.substring(2, 4);
      const rest = clean.substring(4);
      variants.push(`55${ddd}9${rest}`);
    }

    return [...new Set(variants)];
  }

  /**
   * Verifica o status de conexão da instância e se o WhatsApp está pareado via QR Code.
   */
  async checkStatus(overrides?: {
    instanceId?: string;
    token?: string;
    clientToken?: string;
  }): Promise<ZApiStatusResult> {
    const live = getLiveConfig();
    const instId = (overrides?.instanceId || live.zapiInstanceId || process.env.ZAPI_INSTANCE_ID || '').trim();
    const tok = (overrides?.token || live.zapiToken || process.env.ZAPI_TOKEN || '').trim();
    const clTok = (overrides?.clientToken !== undefined ? overrides.clientToken : (live.zapiClientToken || process.env.ZAPI_CLIENT_TOKEN || '')).trim();

    if (!instId || !tok) {
      return {
        success: false,
        connected: false,
        message: 'Preencha o ID da Instância e o Token da Z-API para testar a conexão.',
      };
    }

    try {
      const url = `${this.baseUrl}/instances/${instId}/token/${tok}/status`;
      const makeHeaders = (includeClientToken: boolean) => {
        const h: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (includeClientToken && clTok) {
          h['Client-Token'] = clTok;
        }
        return h;
      };

      console.log(`[ZApiService] Verificando status da instância Z-API: ${instId}...`);
      let response = await fetch(url, { method: 'GET', headers: makeHeaders(Boolean(clTok)) });
      let text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      // Se falhar com 401 ou 403 e foi enviado Client-Token, tenta sem Client-Token
      if ((response.status === 401 || response.status === 403) && clTok) {
        console.log(`[ZApiService] Status retornou ${response.status} com Client-Token. Testando sem Client-Token...`);
        const fallbackRes = await fetch(url, { method: 'GET', headers: makeHeaders(false) });
        if (fallbackRes.ok) {
          response = fallbackRes;
          text = await fallbackRes.text();
          try { data = JSON.parse(text); } catch { data = { raw: text }; }
          console.log(`[ZApiService] Instância aceitou conexão sem Client-Token!`);
        }
      }
      console.log(`[ZApiService:STATUS_RAW] Resposta status Z-API HTTP ${response.status}:`, JSON.stringify(data));

      const rawError = String(data.error || data.message || text || '').trim();
      const rawErrorUpper = rawError.toUpperCase();

      // Caso 1: Z-API exige o Client-Token (Segurança da conta ativada)
      if (rawErrorUpper.includes('CLIENT-TOKEN IS NOT CONFIGURED') || rawErrorUpper.includes('CLIENT TOKEN IS NOT CONFIGURED')) {
        console.warn('[ZApiService:WARN] Z-API exige o Client-Token de segurança da conta.');
        return {
          success: false,
          connected: false,
          requiresClientToken: true,
          message: '🔐 Chave de Segurança da Conta exigida: O WhatsApp está conectado na sua instância Z-API, mas sua conta exige o Client-Token no cabeçalho das requisições. No painel da Z-API (app.z-api.io), vá em Segurança > Token de Segurança, copie o Client-Token e cole no campo "Client-Token da Conta" abaixo.',
          error: 'CLIENT_TOKEN_REQUIRED',
        };
      }

      // Caso 2: Client-Token inválido ou não autorizado
      if (rawErrorUpper.includes('CLIENT-TOKEN NOT ALLOWED') || rawErrorUpper.includes('INVALID CLIENT-TOKEN')) {
        console.warn('[ZApiService:WARN] Z-API rejeitou o Client-Token fornecido.');
        return {
          success: false,
          connected: false,
          invalidClientToken: true,
          message: '⚠️ Client-Token não reconhecido: O Client-Token informado não foi aceito pela Z-API. Verifique se copiou a chave correta no painel da Z-API em Menu > Segurança.',
          error: 'INVALID_CLIENT_TOKEN',
        };
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            connected: false,
            requiresClientToken: !clTok,
            message: !clTok
              ? '🔐 Falha de autenticação: Esta instância da Z-API exige o Client-Token de segurança. Acesse Painel Z-API > Segurança e preencha o Client-Token abaixo.'
              : `Falha de autenticação na Z-API (HTTP ${response.status}): ${data.error || text}. Verifique o Token da Instância e o Client-Token.`,
            error: data.error || text,
          };
        }

        if (response.status === 404) {
          return {
            success: false,
            connected: false,
            message: `Instância não encontrada (Status 404): O ID '${instId}' não foi localizado na Z-API.`,
            error: data.error || text,
          };
        }

        return {
          success: false,
          connected: false,
          message: `Erro retornado pela Z-API (Status ${response.status}): ${data.error || text}`,
          error: data.error || text,
        };
      }

      // Detecção resiliente de conexão (suporta boolean, string, status de sessão e número conectado)
      const isConnected = (data.connected === true ||
                          String(data.connected).toLowerCase() === 'true' ||
                          String(data.status).toUpperCase() === 'CONNECTED' ||
                          String(data.sessionStatus).toUpperCase() === 'CONNECTED' ||
                          Boolean(data.phone)) &&
                          !rawErrorUpper.includes('NOT CONNECTED');

      const isSmartphoneConnected = data.smartphoneConnected !== undefined
        ? Boolean(data.smartphoneConnected)
        : true;

      if (isConnected) {
        return {
          success: true,
          connected: true,
          smartphoneConnected: isSmartphoneConnected,
          message: isSmartphoneConnected
            ? '✓ Instância Z-API conectada e pronta para envio no WhatsApp!'
            : '✓ WhatsApp Pareado e Conectado (Multi-Device Ativo). Pronto para disparos!',
          sessionStatus: 'CONNECTED',
        };
      } else {
        return {
          success: true,
          connected: false,
          message: data.error || '⚠️ Instância localizada com sucesso, porém o WhatsApp está DESCONECTADO. Clique em "Escanear QR Code" para conectar.',
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
        const errDetailUpper = String(errDetail).toUpperCase();
        if (errDetailUpper.includes('CLIENT-TOKEN IS NOT CONFIGURED') || errDetailUpper.includes('CLIENT TOKEN IS NOT CONFIGURED')) {
          return {
            success: false,
            message: '🔐 A Z-API exige o Client-Token de segurança da conta antes de gerar o QR Code. Copie o Client-Token em Z-API > Segurança e preencha o campo "Client-Token da Conta".',
          };
        }

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
   * Testa automaticamente variantes de 8 e 9 dígitos (essencial para Goiás DDD 62 e contas corporativas).
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

    if (!instId || !tok) {
      return {
        success: false,
        exists: false,
        formattedPhone: rawPhone,
        message: 'Preencha o ID da Instância e o Token da Z-API.',
      };
    }

    const variants = this.getPhoneVariants(rawPhone);
    const makeHeaders = (includeClientToken: boolean) => {
      const h: Record<string, string> = { 'Content-Type': 'application/json' };
      if (includeClientToken && clTok) h['Client-Token'] = clTok;
      return h;
    };

    for (const testPhone of variants) {
      try {
        const url = `${this.baseUrl}/instances/${instId}/token/${tok}/phone-exists/${testPhone}`;
        console.log(`[ZApiService] Verificando existência do telefone ${testPhone} na Z-API...`);
        let response = await fetch(url, { method: 'GET', headers: makeHeaders(Boolean(clTok)) });

        if ((response.status === 401 || response.status === 403) && clTok) {
          response = await fetch(url, { method: 'GET', headers: makeHeaders(false) });
        }

        const text = await response.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (response.ok && data.exists) {
          const isAlt = testPhone !== variants[0];
          return {
            success: true,
            exists: true,
            formattedPhone: data.phone || testPhone,
            message: `✓ O número ${data.phone || testPhone} possui WhatsApp ativo${isAlt ? ' (identificado no formato com 8 dígitos)' : ''}!`,
          };
        }
      } catch (err: any) {
        console.warn(`[ZApiService:WARN] Falha ao checar telefone ${testPhone}:`, err.message);
      }
    }

    const primary = variants[0] || rawPhone;
    return {
      success: true,
      exists: false,
      formattedPhone: primary,
      message: `⚠️ O número ${primary} não foi localizado no WhatsApp (testados formatos com 8 e 9 dígitos). Verifique o DDD.`,
    };
  }

  /**
   * Envia uma mensagem de texto simples via Z-API com validação, fallback de variantes brasileiras e logs detalhados.
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

    if (!instId || !tok || instId === 'YOUR_INSTANCE_ID') {
      console.warn('[ZApiService] Credenciais Z-API ausentes. Configure o ID da Instância e o Token.');
      return {
        success: false,
        error: 'Credenciais Z-API não configuradas. Preencha o ID da Instância e o Token da Z-API no painel.',
      };
    }

    const variants = this.getPhoneVariants(rawPhone);
    if (!variants.length || variants[0].length < 10) {
      return {
        success: false,
        error: `Telefone inválido (${rawPhone}). Digite o número com DDD (ex: 11999998888 ou 5511999998888).`,
      };
    }

    const url = `${this.baseUrl}/instances/${instId}/token/${tok}/send-text`;
    const makeHeaders = (includeClientToken: boolean) => {
      const h: Record<string, string> = { 'Content-Type': 'application/json' };
      if (includeClientToken && clTok) h['Client-Token'] = clTok;
      return h;
    };

    let lastError = '';
    let lastResData: any = null;

    // Itera pelas variantes de telefone (ex: 13 dígitos 5562993431970 e 12 dígitos 556293431970)
    for (let i = 0; i < variants.length; i++) {
      const currentPhone = variants[i];
      try {
        console.log(`[ZApiService] Disparando WhatsApp para ${currentPhone} (Tentativa ${i + 1}/${variants.length}) via instância ${instId}...`);

        let response = await fetch(url, {
          method: 'POST',
          headers: makeHeaders(Boolean(clTok)),
          body: JSON.stringify({
            phone: currentPhone,
            message: message,
          }),
        });

        let responseText = await response.text();
        let resData: any = {};
        try { resData = JSON.parse(responseText); } catch { resData = { raw: responseText }; }

        // Se der 401/403 e tiver Client-Token, só usa sem Client-Token se a tentativa alternativa tiver êxito
        if ((response.status === 401 || response.status === 403) && clTok) {
          const preErr = String(resData.error || '').toUpperCase();
          if (!preErr.includes('CLIENT-TOKEN NOT ALLOWED')) {
            const altRes = await fetch(url, {
              method: 'POST',
              headers: makeHeaders(false),
              body: JSON.stringify({
                phone: currentPhone,
                message: message,
              }),
            });
            if (altRes.ok) {
              response = altRes;
              responseText = await altRes.text();
              try { resData = JSON.parse(responseText); } catch { resData = { raw: responseText }; }
            }
          }
        }
        lastResData = resData;

        // Verifica se houve erro explícito no corpo (ex: NOT_FOUND)
        const bodyError = resData.error || resData.message;
        const errUpper = String(bodyError || '').toUpperCase();
        const isNotFound = errUpper.includes('NOT_FOUND') || errUpper.includes('NOT FOUND') || errUpper.includes('NOT EXISTS');

        if (!response.ok || isNotFound) {
          lastError = bodyError || `Status HTTP ${response.status}`;
          console.warn(`[ZApiService:WARN] Disparo para ${currentPhone} retornou erro: ${lastError}`);

          if (errUpper.includes('CLIENT-TOKEN IS NOT CONFIGURED') || errUpper.includes('CLIENT TOKEN IS NOT CONFIGURED')) {
            return {
              success: false,
              error: '🔐 Disparo bloqueado pela Z-API: Sua conta Z-API exige o Client-Token de segurança da conta. Acesse Painel Z-API > Segurança, copie o Client-Token e preencha o campo "Client-Token da Conta" no painel.',
              rawResponse: resData,
            };
          }

          if (errUpper.includes('CLIENT-TOKEN NOT ALLOWED') || errUpper.includes('INVALID CLIENT-TOKEN')) {
            return {
              success: false,
              error: '⚠️ Client-Token recusado pela Z-API. Verifique se copiou a chave correta no Painel Z-API > Segurança.',
              rawResponse: resData,
            };
          }

          // Se for erro de número não encontrado e houver outra variante, continua o loop
          if (isNotFound && i < variants.length - 1) {
            console.log(`[ZApiService:RETRY] Número ${currentPhone} não localizado. Tentando variante alternativa: ${variants[i + 1]}...`);
            continue;
          }

          if (response.status === 401) {
            return {
              success: false,
              error: `Falha de autenticação (HTTP 401). Verifique o Token da Instância e o Client-Token da Z-API.`,
              rawResponse: resData,
            };
          }

          if (response.status === 400 && String(bodyError).toLowerCase().includes('not connected')) {
            return {
              success: false,
              error: `Instância desconectada. Clique em 'Escanear QR Code' para parear seu WhatsApp.`,
              rawResponse: resData,
            };
          }

          // Se tiver mais variantes, tenta a próxima
          if (i < variants.length - 1) continue;

          return {
            success: false,
            error: isNotFound
              ? `O número ${currentPhone} não possui conta ativa no WhatsApp (testadas variantes com 8 e 9 dígitos).`
              : `Z-API recusou a mensagem: ${lastError}`,
            rawResponse: resData,
          };
        }

        const messageId = resData.zaapId || resData.messageId || resData.id || 'OK';
        console.log(`[ZApiService:SUCCESS] Mensagem enviada com sucesso para ${currentPhone}! ID: ${messageId}`);
        return {
          success: true,
          messageId,
          rawResponse: resData,
        };
      } catch (error: any) {
        console.error(`[ZApiService:FATAL] Exceção ao disparar para ${currentPhone}:`, error.message);
        lastError = error.message;
      }
    }

    return {
      success: false,
      error: `Erro ao enviar mensagem via Z-API: ${lastError}`,
      rawResponse: lastResData,
    };
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
