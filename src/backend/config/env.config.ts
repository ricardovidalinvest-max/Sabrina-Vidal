export interface BackendConfig {
  calcomApiKey: string;
  calcomWebhookSecret: string;
  calcomBaseUrl: string;
  calcomEventUrl: string;

  asaasApiKey: string;
  asaasEnvironment: 'production' | 'sandbox';
  asaasWebhookToken: string;

  zapiInstanceId: string;
  zapiToken: string;
  zapiClientToken: string;
  zapiBaseUrl: string;

  consultationPriceBrl: number;
  pixExpirationMinutes: number;
  appUrl: string;
  adminPassword: string;
}

// Estado em memória inicializado com variáveis de ambiente ou padrões seguros
const currentConfig: BackendConfig = {
  calcomApiKey: process.env.CALCOM_API_KEY || '',
  calcomWebhookSecret: process.env.CALCOM_WEBHOOK_SECRET || 'whsec_calcom_sabrina_vidal_social',
  calcomBaseUrl: process.env.CALCOM_BASE_URL || 'https://api.cal.com/v2',
  calcomEventUrl: process.env.CALCOM_EVENT_URL || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas',

  asaasApiKey: process.env.ASAAS_API_KEY || '',
  asaasEnvironment: (process.env.ASAAS_ENVIRONMENT as 'production' | 'sandbox') || 'production',
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN || 'whsec_8RvJb3lvYWcwIE2pByN073lTotEFzN-BGFaehqMTzGI',

  zapiInstanceId: process.env.ZAPI_INSTANCE_ID || '',
  zapiToken: process.env.ZAPI_TOKEN || '',
  zapiClientToken: process.env.ZAPI_CLIENT_TOKEN || '',
  zapiBaseUrl: process.env.ZAPI_BASE_URL || 'https://api.z-api.io',

  consultationPriceBrl: Number(process.env.CONSULTATION_PRICE_BRL) || 79.0,
  pixExpirationMinutes: Number(process.env.PIX_EXPIRATION_MINUTES) || 15,
  appUrl: process.env.APP_URL || '',
  adminPassword: process.env.ADMIN_PASSWORD || 'sabrina@admin2026',
};

export const getLiveConfig = (): BackendConfig => {
  return { ...currentConfig };
};

export const verifyAdminPassword = (inputPass: string): boolean => {
  if (!inputPass || typeof inputPass !== 'string') return false;
  const current = currentConfig.adminPassword || process.env.ADMIN_PASSWORD || 'sabrina@admin2026';
  return inputPass.trim() === current.trim();
};

export const updateLiveConfig = (newValues: Partial<BackendConfig>): BackendConfig => {
  if (newValues.calcomApiKey !== undefined) currentConfig.calcomApiKey = newValues.calcomApiKey.trim();
  if (newValues.calcomWebhookSecret !== undefined) currentConfig.calcomWebhookSecret = newValues.calcomWebhookSecret.trim();
  if (newValues.calcomBaseUrl !== undefined) currentConfig.calcomBaseUrl = newValues.calcomBaseUrl.trim();
  if (newValues.calcomEventUrl !== undefined) currentConfig.calcomEventUrl = newValues.calcomEventUrl.trim();

  if (newValues.asaasApiKey !== undefined) currentConfig.asaasApiKey = newValues.asaasApiKey.trim();
  if (newValues.asaasEnvironment !== undefined) currentConfig.asaasEnvironment = newValues.asaasEnvironment;
  if (newValues.asaasWebhookToken !== undefined) currentConfig.asaasWebhookToken = newValues.asaasWebhookToken.trim();

  if (newValues.zapiInstanceId !== undefined) currentConfig.zapiInstanceId = newValues.zapiInstanceId.trim();
  if (newValues.zapiToken !== undefined) currentConfig.zapiToken = newValues.zapiToken.trim();
  if (newValues.zapiClientToken !== undefined) currentConfig.zapiClientToken = newValues.zapiClientToken.trim();
  if (newValues.zapiBaseUrl !== undefined) currentConfig.zapiBaseUrl = newValues.zapiBaseUrl.trim();

  if (newValues.consultationPriceBrl !== undefined) currentConfig.consultationPriceBrl = Number(newValues.consultationPriceBrl);
  if (newValues.pixExpirationMinutes !== undefined) currentConfig.pixExpirationMinutes = Number(newValues.pixExpirationMinutes);
  if (newValues.appUrl !== undefined) currentConfig.appUrl = newValues.appUrl.trim();
  if (newValues.adminPassword !== undefined && newValues.adminPassword.trim().length > 0) {
    currentConfig.adminPassword = newValues.adminPassword.trim();
  }

  console.log('[LiveConfig] Configurações de chaves e webhooks atualizadas com sucesso em tempo de execução.');
  return { ...currentConfig };
};

export const getMaskedConfig = () => {
  const mask = (str: string, keepLen = 6) => {
    if (!str) return '';
    if (str.length <= keepLen) return '••••••••';
    return `${str.substring(0, keepLen)}••••••••${str.substring(str.length - 4)}`;
  };

  return {
    calcomApiKey: mask(currentConfig.calcomApiKey, 8),
    hasCalcomApiKey: Boolean(currentConfig.calcomApiKey && currentConfig.calcomApiKey.length > 5),
    calcomWebhookSecret: currentConfig.calcomWebhookSecret,
    calcomBaseUrl: currentConfig.calcomBaseUrl,
    calcomEventUrl: currentConfig.calcomEventUrl,

    asaasApiKey: mask(currentConfig.asaasApiKey, 8),
    hasAsaasApiKey: Boolean(currentConfig.asaasApiKey && currentConfig.asaasApiKey.length > 10),
    asaasEnvironment: currentConfig.asaasEnvironment,
    asaasWebhookToken: currentConfig.asaasWebhookToken,

    zapiInstanceId: mask(currentConfig.zapiInstanceId, 4),
    hasZapiInstanceId: Boolean(currentConfig.zapiInstanceId && currentConfig.zapiInstanceId.length > 4),
    zapiToken: mask(currentConfig.zapiToken, 4),
    hasZapiToken: Boolean(currentConfig.zapiToken && currentConfig.zapiToken.length > 4),
    zapiClientToken: mask(currentConfig.zapiClientToken, 3),
    zapiBaseUrl: currentConfig.zapiBaseUrl,

    consultationPriceBrl: currentConfig.consultationPriceBrl,
    pixExpirationMinutes: currentConfig.pixExpirationMinutes,
    appUrl: currentConfig.appUrl,
  };
};
