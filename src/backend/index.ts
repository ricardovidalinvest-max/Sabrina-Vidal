import { Router, Request, Response, NextFunction } from 'express';
import { handleCalcomWebhook } from './controllers/calcom.webhook';
import { handleAsaasWebhook } from './controllers/asaas.webhook';
import { validateCalcomSignature, validateAsaasToken } from './middlewares/webhookAuth.middleware';
import { cleanupCronJob } from './jobs/cleanupExpiredBookings.cron';
import { dbRepository } from './db/database';
import { getLiveConfig, updateLiveConfig, getMaskedConfig, verifyAdminPassword } from './config/env.config';
import { asaasService } from './services/asaas.service';
import { calcomService } from './services/calcom.service';
import { zapiService } from './services/zapi.service';

export const backendRouter = Router();

// Middleware de Autenticação Restrita (Apenas o dono do sistema acessa com senha)
export const requireAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const passHeader = req.headers['x-admin-password'] as string;
  let token = passHeader;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  if (!token || !verifyAdminPassword(token)) {
    res.status(401).json({
      success: false,
      error: 'Acesso restrito. Forneça a senha administrativa correta no cabeçalho x-admin-password.',
    });
    return;
  }
  next();
};

// ==============================================================================
// 1. ENDPOINT DE AUTENTICAÇÃO DO PROPRIETÁRIO (ACESSO RESTRITO COM SENHA)
// ==============================================================================
backendRouter.post('/api/backend/auth/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (verifyAdminPassword(password)) {
    return res.json({
      success: true,
      message: 'Autenticado com sucesso.',
      token: password,
    });
  }
  return res.status(401).json({
    success: false,
    message: 'Senha incorreta. Acesso não autorizado.',
  });
});

// ==============================================================================
// 2. ENDPOINTS DE WEBHOOK PÚBLICOS (Cal.com & Asaas com validação por chave)
// ==============================================================================
backendRouter.post(
  ['/api/webhooks/calcom', '/api/calcom/webhook'],
  validateCalcomSignature,
  handleCalcomWebhook
);

backendRouter.post(
  ['/api/webhooks/asaas', '/api/asaas/webhook'],
  validateAsaasToken,
  handleAsaasWebhook
);

// ==============================================================================
// 3. CENTRAL DE AMBIENTES: COPIAR E INSERIR CHAVES WEBHOOK (PROTEGIDA)
// ==============================================================================

// Helper para obter a URL pública do app (com suporte a domínio customizado e reverse proxies)
const getBaseUrl = (req: Request): string => {
  const live = getLiveConfig();
  const envUrl = (live.appUrl || process.env.APP_URL || '').trim();
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/$/, '');
  }
  const host = req.get('x-forwarded-host') || req.get('host') || 'sabrinavidal.com.br';
  let proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  // Se estiver em produção ou em domínio não-localhost, assegura https
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    proto = 'https';
  }
  return `${proto}://${host}`;
};

// Obter URLs prontas para copiar e o status das chaves configuradas (Apenas Admin)
backendRouter.get('/api/backend/config', requireAdminAuth, (req: Request, res: Response) => {
  const origin = getBaseUrl(req);
  const live = getLiveConfig();

  res.json({
    success: true,
    maskedConfig: getMaskedConfig(),
    rawConfig: {
      zapiInstanceId: live.zapiInstanceId,
      zapiClientToken: live.zapiClientToken,
      hasZapiToken: Boolean(live.zapiToken && live.zapiToken.length > 5),
      appUrl: live.appUrl || '',
    },
    webhookUrls: {
      origin,
      calcom: {
        url: `${origin}/api/webhooks/calcom`,
        event: 'BOOKING_CREATED',
        secretHeader: 'x-cal-signature-256',
        secret: live.calcomWebhookSecret,
        instructions: 'No Cal.com > Evento > Webhooks > Adicionar Webhook. Cole a URL, selecione BOOKING_CREATED e defina o Segredo do Webhook.',
      },
      asaas: {
        url: `${origin}/api/webhooks/asaas`,
        event: 'PAYMENT_RECEIVED',
        tokenHeader: 'asaas-access-token',
        token: live.asaasWebhookToken,
        instructions: 'No Asaas > Minha Conta > Configurações > Integrações > Webhooks para Cobranças. Cole a URL, selecione Pagamento Recebido e insira o Token de Autenticação.',
      },
    },
  });
});

// Salvar / Inserir novas chaves e tokens em tempo de execução (Apenas Admin)
backendRouter.post('/api/backend/config', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const updated = updateLiveConfig(req.body);
    res.json({
      success: true,
      message: 'Chaves e configurações salvas com sucesso! O backend já está utilizando os novos valores.',
      maskedConfig: getMaskedConfig(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Testar conexão com Asaas (com auto-detecção de ambiente Produção vs Sandbox)
backendRouter.post('/api/backend/config/test-asaas', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const live = getLiveConfig();
    const apiKey = (req.body.apiKey || live.asaasApiKey || '').trim();
    let env: 'production' | 'sandbox' = req.body.environment || live.asaasEnvironment || 'production';

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Nenhuma Chave de API do Asaas fornecida.' });
    }

    const testEnv = async (targetEnv: 'production' | 'sandbox') => {
      const baseUrl = targetEnv === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
      const response = await fetch(`${baseUrl}/finance/balance`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access_token': apiKey,
        },
      });
      return { response, baseUrl };
    };

    // 1. Tenta no ambiente selecionado
    let { response } = await testEnv(env);

    // 2. Se falhar com invalid_environment, testa automaticamente o ambiente alternativo
    if (!response.ok) {
      const errText = await response.text();
      let isInvalidEnv = errText.includes('invalid_environment') || response.status === 401;

      if (isInvalidEnv) {
        const alternateEnv: 'production' | 'sandbox' = env === 'production' ? 'sandbox' : 'production';
        console.log(`[AsaasTest] Erro de ambiente no '${env}'. Testando automaticamente no ambiente alternativo '${alternateEnv}'...`);

        const altResult = await testEnv(alternateEnv);
        if (altResult.response.ok) {
          const altData = await altResult.response.json();
          // Atualiza a configuração ativa no backend
          updateLiveConfig({ asaasEnvironment: alternateEnv, asaasApiKey: apiKey });

          return res.json({
            success: true,
            autoSwitched: true,
            environment: alternateEnv,
            balance: altData.balance,
            message: `✓ Conexão realizada com sucesso! Detectamos que sua chave pertence ao ambiente ${
              alternateEnv === 'production' ? 'PRODUÇÃO (Real)' : 'SANDBOX (Testes)'
            } e ajustamos automaticamente para você!`,
          });
        }
      }

      // Se ambos falharem ou for outro erro
      let parsedDesc = errText;
      try {
        const parsed = JSON.parse(errText);
        parsedDesc = parsed.errors?.[0]?.description || parsed.message || errText;
      } catch {}

      const opposite = env === 'production' ? 'Sandbox (Testes)' : 'Produção (Real)';
      return res.status(400).json({
        success: false,
        message: `Falha na autenticação do Asaas: ${parsedDesc}. Dica: Alterne o seletor de ambiente para '${opposite}' e clique em Testar novamente.`,
      });
    }

    const data = await response.json();
    // Salva a chave válida no live config
    updateLiveConfig({ asaasEnvironment: env, asaasApiKey: apiKey });

    res.json({
      success: true,
      message: `✓ Conexão com Asaas realizada com sucesso no ambiente ${env === 'production' ? 'PRODUÇÃO (Real)' : 'SANDBOX (Testes)'}! API Key 100% válida.`,
      balance: data.balance,
      environment: env,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Erro de conexão com o Asaas: ${error.message}` });
  }
});

// Gerar cobrança PIX real diretamente na plataforma Asaas
backendRouter.post('/api/backend/config/generate-asaas-pix', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const live = getLiveConfig();
    const apiKey = (req.body.apiKey || live.asaasApiKey || '').trim();
    const env = req.body.environment || live.asaasEnvironment || 'production';
    const value = Number(req.body.value) || live.consultationPriceBrl || 79.0;
    const customerName = req.body.customerName || 'Paciente Nutrição Social';
    const customerEmail = req.body.customerEmail || 'paciente@exemplo.com';
    const customerPhone = req.body.customerPhone || '11999998888';
    // Se o usuário informar seu CPF no teste, usa-o; caso contrário, usa um CPF válido padrão para que o Asaas nunca dê erro
    const cpfCnpj = req.body.cpfCnpj || req.body.cpf || '04218873100';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Chave de API do Asaas não configurada. Por favor, insira e teste sua chave antes de gerar o PIX.',
      });
    }

    console.log(`[GenerateAsaasPix] Criando cobrança PIX real no Asaas de R$ ${value.toFixed(2)} (${env}) com CPF ${cpfCnpj}...`);

    // 1. Localiza ou cria cliente no Asaas com CPF/CNPJ
    const customerId = await asaasService.findOrCreateCustomer({
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      cpfCnpj,
    });

    // 2. Cria cobrança PIX na API do Asaas e obtém QR Code + Copia e Cola oficiais
    const pixResult = await asaasService.createPixCharge({
      customerId,
      value,
      description: `Consulta Nutrição Social - Dra. Sabrina Vidal (PIX Oficial Asaas)`,
      externalReference: `manual_${Date.now()}`,
      expiresInMinutes: live.pixExpirationMinutes || 15,
    });

    const dashboardUrl = env === 'production'
      ? 'https://www.asaas.com/cobrancas'
      : 'https://sandbox.asaas.com/cobrancas';

    res.json({
      success: true,
      message: `✓ Cobrança PIX criada com sucesso dentro da plataforma Asaas! ID: ${pixResult.paymentId}`,
      charge: {
        paymentId: pixResult.paymentId,
        status: pixResult.status,
        value: pixResult.value,
        pixPayload: pixResult.pixPayload,
        qrCodeImage: pixResult.qrCodeImage,
        invoiceUrl: pixResult.invoiceUrl,
        expirationDate: pixResult.expirationDate,
        customerId,
        dashboardUrl,
        environment: env,
      },
    });
  } catch (error: any) {
    console.error('[GenerateAsaasPix:ERROR]', error.message);
    res.status(500).json({
      success: false,
      message: `Falha ao gerar cobrança PIX no Asaas: ${error.message}`,
    });
  }
});

// Testar conexão com Cal.com (API v2)
backendRouter.post('/api/backend/config/test-calcom', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const live = getLiveConfig();
    const apiKey = (req.body.apiKey || live.calcomApiKey || '').trim();

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Nenhuma Chave de API do Cal.com fornecida.' });
    }

    let baseUrl = live.calcomBaseUrl || 'https://api.cal.com/v2';
    if (baseUrl.includes('/v1')) {
      baseUrl = baseUrl.replace('/v1', '/v2');
    }
    baseUrl = baseUrl.replace(/\/$/, '');

    // Cal.com API v2 usa Authorization: Bearer <token>
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
    };

    // Endpoint oficial Cal.com API v2: GET /v2/me
    const response = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        parsedMsg = parsed.message || parsed.error?.message || errText;
      } catch {}

      if (response.status === 401) {
        return res.status(401).json({
          success: false,
          message: `Chave de API do Cal.com v2 inválida (HTTP 401). Obtenha sua chave 'cal_live_...' em Cal.com > Configurações > Desenvolvedor > API Keys. Detalhes: ${parsedMsg}`,
        });
      }

      return res.status(response.status).json({
        success: false,
        message: `Falha na API do Cal.com v2 (HTTP ${response.status}): ${parsedMsg}`,
      });
    }

    const data = await response.json();
    const userName = data.data?.name || data.data?.username || data.data?.email || 'Usuário Autenticado';
    res.json({
      success: true,
      message: `✓ Conexão com Cal.com API v2 validada com sucesso! Conectado como: ${userName}`,
      user: data.data,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Erro ao testar Cal.com v2: ${error.message}` });
  }
});

// Testar status da instância Z-API (Verificar se QR Code está conectado e status do smartphone)
backendRouter.post('/api/backend/config/test-zapi-status', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const live = getLiveConfig();
    const instanceId = (req.body.instanceId || live.zapiInstanceId || '').trim();
    const token = (req.body.token || live.zapiToken || '').trim();
    const clientToken = (req.body.clientToken !== undefined ? req.body.clientToken : live.zapiClientToken || '').trim();

    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        message: 'Preencha o ID da Instância e o Token da Z-API antes de testar.',
      });
    }

    // Salva temporariamente para manter sincronizado
    updateLiveConfig({ zapiInstanceId: instanceId, zapiToken: token, zapiClientToken: clientToken });

    const statusResult = await zapiService.checkStatus({ instanceId, token, clientToken });
    res.json(statusResult);
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Erro ao verificar status da Z-API: ${error.message}` });
  }
});

// Obter QR Code oficial da Z-API para conexão na tela
backendRouter.post('/api/backend/config/zapi-qrcode', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const live = getLiveConfig();
    const instanceId = (req.body.instanceId || live.zapiInstanceId || '').trim();
    const token = (req.body.token || live.zapiToken || '').trim();
    const clientToken = (req.body.clientToken !== undefined ? req.body.clientToken : live.zapiClientToken || '').trim();

    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        message: 'Preencha o ID da Instância e o Token da Z-API para gerar o QR Code.',
      });
    }

    const qrResult = await zapiService.getQrCodeImage({ instanceId, token, clientToken });
    res.json(qrResult);
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Erro ao obter QR Code: ${error.message}` });
  }
});

// Verificar se número possui conta no WhatsApp
backendRouter.post('/api/backend/config/zapi-check-phone', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const live = getLiveConfig();
    const instanceId = (req.body.instanceId || live.zapiInstanceId || '').trim();
    const token = (req.body.token || live.zapiToken || '').trim();
    const clientToken = (req.body.clientToken !== undefined ? req.body.clientToken : live.zapiClientToken || '').trim();
    const { phone } = req.body;

    if (!phone || String(phone).trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Informe o número de telefone com DDD para verificação.',
      });
    }

    const checkResult = await zapiService.checkPhoneExists(phone, { instanceId, token, clientToken });
    res.json(checkResult);
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Erro ao verificar telefone: ${error.message}` });
  }
});

// Testar envio de WhatsApp via Z-API com credenciais diretas e diagnóstico
backendRouter.post('/api/backend/config/test-zapi', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const live = getLiveConfig();
    const instanceId = (req.body.instanceId || live.zapiInstanceId || '').trim();
    const token = (req.body.token || live.zapiToken || '').trim();
    const clientToken = (req.body.clientToken !== undefined ? req.body.clientToken : live.zapiClientToken || '').trim();
    const { phone, testMessage } = req.body;

    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        message: 'Preencha o ID da Instância e o Token da Z-API antes de enviar o teste.',
      });
    }

    if (!phone || String(phone).trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, informe seu número com DDD no campo "Telefone para Disparo de Teste" (ex: 11999998888).',
      });
    }

    // Salva as credenciais no live config
    updateLiveConfig({ zapiInstanceId: instanceId, zapiToken: token, zapiClientToken: clientToken });

    const targetPhone = phone.trim();
    const msg = testMessage || '🌿 Teste de Integração WhatsApp Z-API Dra. Sabrina Vidal. Conexão realizada com sucesso!';

    console.log(`[TestZapi] Disparando teste para ${targetPhone} usando instância ${instanceId}...`);
    const sendResult = await zapiService.sendTextMessage(targetPhone, msg, {
      instanceId,
      token,
      clientToken,
    });

    if (sendResult.success) {
      res.json({
        success: true,
        message: `✓ Mensagem enviada com sucesso para ${targetPhone} via Z-API! (ID: ${sendResult.messageId})`,
        messageId: sendResult.messageId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: sendResult.error || 'Falha no disparo pela Z-API. Verifique se o WhatsApp está conectado ao QR Code e os tokens corretos.',
        details: sendResult.rawResponse,
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Erro ao disparar WhatsApp: ${error.message}` });
  }
});

// ==============================================================================
// 4. ROTAS AUXILIARES DE MONITORAMENTO & TESTE DO MANUAL TÉCNICO
// ==============================================================================

// Listar agendamentos armazenados com seus status atuais
backendRouter.get('/api/backend/agendamentos', requireAdminAuth, async (req, res) => {
  try {
    const list = await dbRepository.getAll();
    res.json({ success: true, count: list.length, agendamentos: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Disparo manual da rotina de limpeza do Cron para inspeção e testes
backendRouter.post('/api/backend/cron/trigger', requireAdminAuth, async (req, res) => {
  try {
    const result = await cleanupCronJob.runCleanupCycle();
    res.json({
      success: true,
      message: 'Ciclo de limpeza de 15 minutos executado com sucesso.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Inicialização automática das rotinas em segundo plano
export const initBackendServices = () => {
  console.log('[Backend] Inicializando serviços de background e Cron de Limpeza...');
  cleanupCronJob.startCron(60 * 1000);
};
