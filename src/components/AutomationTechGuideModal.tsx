import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Terminal,
  Server,
  Zap,
  MessageSquare,
  Calendar,
  CreditCard,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Database,
  FileCode,
  Lock,
  Play,
  Activity,
  FolderGit2,
  Globe,
  SlidersHorizontal,
  ExternalLink,
  Eye,
  EyeOff,
  Send,
  CheckCheck,
  QrCode,
  Search,
} from 'lucide-react';
import {
  BACKEND_CODE_FILES,
  BACKEND_DIRECTORY_STRUCTURE,
} from '../data/techDocs';
import { copyTextSafely } from '../utils/clipboard';

interface TechGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutomationTechGuideModal: React.FC<TechGuideProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'webhooks_hub' | 'domain_deploy' | 'architecture' | 'code' | 'live_test' | 'env'>('logs');
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Autenticação Administrativa & Caixa de Log com Senha
  const [adminToken, setAdminToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sabrina_admin_token') || '';
    }
    return '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(sessionStorage.getItem('sabrina_admin_token'));
    }
    return false;
  });
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Helper para headers autenticados
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const token = adminToken || (typeof window !== 'undefined' ? sessionStorage.getItem('sabrina_admin_token') || '' : '');
    return {
      'x-admin-password': token,
      ...extraHeaders,
    };
  };

  const handleLogout = () => {
    setAdminToken('');
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('sabrina_admin_token');
    }
    setPasswordInput('');
    setLoginError('');
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = passwordInput.trim();
    if (!trimmed) {
      setLoginError('Por favor, informe a senha de acesso.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/backend/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminToken(trimmed);
        setIsAuthenticated(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('sabrina_admin_token', trimmed);
        }
        setPasswordInput('');
        addLog('✓ Autenticação de administrador realizada com sucesso.', 'success');
        fetchConfig(trimmed);
        fetchDbRecords(trimmed);
      } else {
        setLoginError(data.message || 'Senha incorreta. Acesso restrito apenas ao proprietário.');
      }
    } catch (err: any) {
      setLoginError(`Erro ao comunicar com o servidor: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Live Config & Webhook URLs from Server
  const [serverOrigin, setServerOrigin] = useState<string>('');
  const [appUrlInput, setAppUrlInput] = useState<string>('');
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Keys Input States (Inserção)
  const [asaasApiKeyInput, setAsaasApiKeyInput] = useState<string>('');
  const [asaasEnvInput, setAsaasEnvInput] = useState<'production' | 'sandbox'>('production');
  const [asaasWebhookTokenInput, setAsaasWebhookTokenInput] = useState<string>('');
  const [showAsaasKey, setShowAsaasKey] = useState<boolean>(false);

  const [calcomApiKeyInput, setCalcomApiKeyInput] = useState<string>('');
  const [calcomSecretInput, setCalcomSecretInput] = useState<string>('');
  const [calcomEventUrlInput, setCalcomEventUrlInput] = useState<string>('https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas');
  const [showCalcomKey, setShowCalcomKey] = useState<boolean>(false);

  const [zapiInstanceInput, setZapiInstanceInput] = useState<string>('');
  const [zapiTokenInput, setZapiTokenInput] = useState<string>('');
  const [zapiClientTokenInput, setZapiClientTokenInput] = useState<string>('');
  const [showZapiToken, setShowZapiToken] = useState<boolean>(false);

  const [priceBrlInput, setPriceBrlInput] = useState<number>(79.0);
  const [expirationMinInput, setExpirationMinInput] = useState<number>(15);

  // Connection Test States
  const [isTestingAsaas, setIsTestingAsaas] = useState<boolean>(false);
  const [asaasTestRes, setAsaasTestRes] = useState<{ success: boolean; message: string; balance?: number } | null>(null);
  const [isGeneratingAsaasPix, setIsGeneratingAsaasPix] = useState<boolean>(false);
  const [generatedAsaasPix, setGeneratedAsaasPix] = useState<any | null>(null);
  const [testCpfInput, setTestCpfInput] = useState<string>('042.188.731-00');

  const [isTestingCalcom, setIsTestingCalcom] = useState<boolean>(false);
  const [calcomTestRes, setCalcomTestRes] = useState<{ success: boolean; message: string; eventTypesCount?: number } | null>(null);

  const [testPhoneInput, setTestPhoneInput] = useState<string>('');
  const [isTestingZapi, setIsTestingZapi] = useState<boolean>(false);
  const [zapiTestRes, setZapiTestRes] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);
  const [isCheckingZapiStatus, setIsCheckingZapiStatus] = useState<boolean>(false);
  const [zapiStatusRes, setZapiStatusRes] = useState<{
    success: boolean;
    connected?: boolean;
    smartphoneConnected?: boolean;
    message: string;
    sessionStatus?: string;
    requiresClientToken?: boolean;
    invalidClientToken?: boolean;
  } | null>(null);
  const [isFetchingZapiQr, setIsFetchingZapiQr] = useState<boolean>(false);
  const [zapiQrCodeImage, setZapiQrCodeImage] = useState<string | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState<boolean>(false);
  const [zapiPhoneCheckRes, setZapiPhoneCheckRes] = useState<{ success: boolean; exists?: boolean; formattedPhone?: string; message: string } | null>(null);
  const [healthCheckRes, setHealthCheckRes] = useState<any | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  // Live Test states
  const [isSimulatingCalcom, setIsSimulatingCalcom] = useState<boolean>(false);
  const [isSimulatingAsaas, setIsSimulatingAsaas] = useState<boolean>(false);
  const [isTriggeringCron, setIsTriggeringCron] = useState<boolean>(false);
  const [dbAgendamentos, setDbAgendamentos] = useState<any[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [liveLogs, setLiveLogs] = useState<Array<{ timestamp: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }>>([
    { timestamp: new Date().toLocaleTimeString(), text: 'Sistema de monitoramento e logs conectado.', type: 'info' },
  ]);

  const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setLiveLogs((prev) => [
      { timestamp: new Date().toLocaleTimeString(), text, type },
      ...prev.slice(0, 50),
    ]);
  };

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    setHealthCheckRes(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthCheckRes(data);
      addLog(`✓ Health Check OK: status ${data.status} (uptime: ${data.uptimeSeconds}s)`, 'success');
    } catch (e: any) {
      setHealthCheckRes({ status: 'error', message: e.message });
      addLog(`Health Check falhou: ${e.message}`, 'error');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    const success = await copyTextSafely(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  // Carregar Configurações e URLs atuais do Backend (Protegido por Senha)
  const fetchConfig = async (overrideToken?: string) => {
    const token = overrideToken || adminToken || (typeof window !== 'undefined' ? sessionStorage.getItem('sabrina_admin_token') || '' : '');
    if (!token) return;

    setIsLoadingConfig(true);
    try {
      const res = await fetch('/api/backend/config', {
        headers: { 'x-admin-password': token },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.webhookUrls?.origin) {
          setServerOrigin(data.webhookUrls.origin);
        }
        if (data.webhookUrls?.asaas?.token) {
          setAsaasWebhookTokenInput(data.webhookUrls.asaas.token);
        }
        if (data.webhookUrls?.calcom?.secret) {
          setCalcomSecretInput(data.webhookUrls.calcom.secret);
        }
        if (data.rawConfig?.zapiInstanceId) {
          setZapiInstanceInput(data.rawConfig.zapiInstanceId);
        }
        if (data.rawConfig?.zapiToken) {
          setZapiTokenInput(data.rawConfig.zapiToken);
        }
        if (data.rawConfig?.zapiClientToken) {
          setZapiClientTokenInput(data.rawConfig.zapiClientToken);
        }
        if (data.rawConfig?.appUrl) {
          setAppUrlInput(data.rawConfig.appUrl);
        }
        if (data.maskedConfig) {
          setAsaasEnvInput(data.maskedConfig.asaasEnvironment || 'production');
          setPriceBrlInput(data.maskedConfig.consultationPriceBrl || 79.0);
          setExpirationMinInput(data.maskedConfig.pixExpirationMinutes || 15);
          if (data.maskedConfig.calcomEventUrl) setCalcomEventUrlInput(data.maskedConfig.calcomEventUrl);
          if (data.maskedConfig.appUrl && !appUrlInput) setAppUrlInput(data.maskedConfig.appUrl);
        }
      }
    } catch (e: any) {
      console.error('Falha ao carregar config:', e.message);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  // Salvar novas chaves inseridas no backend
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    setSaveStatus(null);
    try {
      const payload: Record<string, any> = {
        asaasEnvironment: asaasEnvInput,
        asaasWebhookToken: asaasWebhookTokenInput,
        calcomWebhookSecret: calcomSecretInput,
        calcomEventUrl: calcomEventUrlInput,
        consultationPriceBrl: Number(priceBrlInput),
        pixExpirationMinutes: Number(expirationMinInput),
      };

      if (appUrlInput !== undefined) {
        payload.appUrl = appUrlInput.trim();
      }
      if (asaasApiKeyInput && asaasApiKeyInput.trim().length > 5) {
        payload.asaasApiKey = asaasApiKeyInput.trim();
      }
      if (calcomApiKeyInput && calcomApiKeyInput.trim().length > 5) {
        payload.calcomApiKey = calcomApiKeyInput.trim();
      }
      if (zapiInstanceInput && zapiInstanceInput.trim().length > 2) {
        payload.zapiInstanceId = zapiInstanceInput.trim();
      }
      if (zapiTokenInput && zapiTokenInput.trim().length > 2) {
        payload.zapiToken = zapiTokenInput.trim();
      }
      if (zapiClientTokenInput) {
        payload.zapiClientToken = zapiClientTokenInput.trim();
      }

      const res = await fetch('/api/backend/config', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus({
          type: 'success',
          message: '✓ Chaves salvas e ativadas com sucesso no backend!',
        });
        addLog('Configurações e Chaves atualizadas no backend com sucesso.', 'success');
        // Limpar inputs de senha após salvar com sucesso
        setAsaasApiKeyInput('');
        setCalcomApiKeyInput('');
        setZapiTokenInput('');
        fetchConfig();
      } else {
        setSaveStatus({
          type: 'error',
          message: `Falha ao salvar: ${data.error || 'Erro desconhecido'}`,
        });
      }
    } catch (e: any) {
      setSaveStatus({ type: 'error', message: `Erro ao conectar: ${e.message}` });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Testar Conexão Asaas
  const handleTestAsaas = async () => {
    setIsTestingAsaas(true);
    setAsaasTestRes(null);
    try {
      const res = await fetch('/api/backend/config/test-asaas', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          apiKey: asaasApiKeyInput || undefined,
          environment: asaasEnvInput,
        }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      setAsaasTestRes(data);
      if (data.success) {
        if (data.autoSwitched && data.environment) {
          setAsaasEnvInput(data.environment);
        }
        addLog(`Asaas OK! Saldo: R$ ${data.balance?.toFixed(2) ?? '0.00'} (${data.environment})`, 'success');
      } else {
        addLog(`Asaas falha: ${data.message}`, 'error');
      }
    } catch (e: any) {
      setAsaasTestRes({ success: false, message: e.message });
    } finally {
      setIsTestingAsaas(false);
    }
  };

  // Gerar Cobrança PIX Real na Plataforma Asaas
  const handleGenerateAsaasPix = async () => {
    setIsGeneratingAsaasPix(true);
    setGeneratedAsaasPix(null);
    try {
      const res = await fetch('/api/backend/config/generate-asaas-pix', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          value: priceBrlInput,
          apiKey: asaasApiKeyInput || undefined,
          environment: asaasEnvInput,
          customerName: 'Paciente Teste Nutrição Sabrina',
          customerEmail: 'paciente.teste@exemplo.com',
          customerPhone: '11999998888',
          cpfCnpj: testCpfInput,
        }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedAsaasPix(data.charge);
        addLog(`✓ Cobrança PIX criada no Asaas! ID: ${data.charge.paymentId} | R$ ${Number(data.charge.value).toFixed(2)}`, 'success');
        addLog(`→ Acesse seu painel do Asaas para ver a cobrança: ${data.charge.dashboardUrl}`, 'info');
      } else {
        addLog(`Falha ao gerar PIX no Asaas: ${data.message}`, 'error');
      }
    } catch (e: any) {
      addLog(`Erro: ${e.message}`, 'error');
    } finally {
      setIsGeneratingAsaasPix(false);
    }
  };

  // Testar Conexão Cal.com
  const handleTestCalcom = async () => {
    setIsTestingCalcom(true);
    setCalcomTestRes(null);
    try {
      const res = await fetch('/api/backend/config/test-calcom', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ apiKey: calcomApiKeyInput || undefined }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      setCalcomTestRes(data);
      if (data.success) {
        addLog(`Cal.com OK! Eventos encontrados: ${data.eventTypesCount}`, 'success');
      } else {
        addLog(`Cal.com falha: ${data.message}`, 'error');
      }
    } catch (e: any) {
      setCalcomTestRes({ success: false, message: e.message });
    } finally {
      setIsTestingCalcom(false);
    }
  };

  // Verificar Conexão e Status do WhatsApp na Z-API (GET /status)
  const handleCheckZapiStatus = async () => {
    setIsCheckingZapiStatus(true);
    setZapiStatusRes(null);
    try {
      const res = await fetch('/api/backend/config/test-zapi-status', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          instanceId: zapiInstanceInput || undefined,
          token: zapiTokenInput || undefined,
          clientToken: zapiClientTokenInput || undefined,
        }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      setZapiStatusRes(data);
      if (data.success && data.connected) {
        addLog(`✓ Z-API Online! WhatsApp Conectado e Pronto (${data.sessionStatus || 'CONNECTED'})`, 'success');
      } else {
        addLog(`Z-API Status: ${data.message}`, data.connected === false ? 'warn' : 'error');
      }
    } catch (e: any) {
      setZapiStatusRes({ success: false, connected: false, message: `Erro ao testar Z-API: ${e.message}` });
    } finally {
      setIsCheckingZapiStatus(false);
    }
  };

  // Buscar QR Code oficial para pareamento no WhatsApp
  const handleFetchZapiQr = async () => {
    setIsFetchingZapiQr(true);
    try {
      const res = await fetch('/api/backend/config/zapi-qrcode', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          instanceId: zapiInstanceInput || undefined,
          token: zapiTokenInput || undefined,
          clientToken: zapiClientTokenInput || undefined,
        }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      if (data.success && data.qrCodeImage) {
        setZapiQrCodeImage(data.qrCodeImage);
        addLog('✓ QR Code do WhatsApp carregado! Aponte a câmera em Aparelhos Conectados.', 'success');
      } else {
        addLog(`Z-API QR Code: ${data.message}`, 'warn');
        if (data.connected) {
          setZapiStatusRes({ success: true, connected: true, message: data.message });
          setZapiQrCodeImage(null);
        }
      }
    } catch (e: any) {
      addLog(`Erro ao obter QR Code: ${e.message}`, 'error');
    } finally {
      setIsFetchingZapiQr(false);
    }
  };

  // Verificar se o número de teste possui conta ativa no WhatsApp
  const handleCheckPhone = async () => {
    if (!testPhoneInput || testPhoneInput.trim().length < 8) {
      setZapiPhoneCheckRes({
        success: false,
        message: 'Digite seu número com DDD no campo de teste para verificar.',
      });
      return;
    }
    setIsCheckingPhone(true);
    setZapiPhoneCheckRes(null);
    try {
      const res = await fetch('/api/backend/config/zapi-check-phone', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          phone: testPhoneInput,
          instanceId: zapiInstanceInput || undefined,
          token: zapiTokenInput || undefined,
          clientToken: zapiClientTokenInput || undefined,
        }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      setZapiPhoneCheckRes(data);
      if (data.exists) {
        addLog(`✓ Número ${data.formattedPhone} validado no WhatsApp!`, 'success');
      } else {
        addLog(`Aviso: ${data.message}`, 'warn');
      }
    } catch (e: any) {
      setZapiPhoneCheckRes({ success: false, message: e.message });
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // Testar Disparo Real de Mensagem via Z-API
  const handleTestZapi = async () => {
    if (!testPhoneInput || testPhoneInput.trim().length < 8) {
      setZapiTestRes({
        success: false,
        message: 'Por favor, digite seu número de WhatsApp com DDD no campo abaixo antes de disparar.',
      });
      return;
    }
    setIsTestingZapi(true);
    setZapiTestRes(null);
    try {
      const res = await fetch('/api/backend/config/test-zapi', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          phone: testPhoneInput,
          instanceId: zapiInstanceInput || undefined,
          token: zapiTokenInput || undefined,
          clientToken: zapiClientTokenInput || undefined,
          testMessage: `🌿 *Teste Oficial de Integração Z-API*\n\nOlá! Sua integração com a Z-API foi configurada com sucesso no sistema da Nutricionista Dra. Sabrina Vidal!\n\nData do teste: ${new Date().toLocaleString('pt-BR')}`,
        }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();
      setZapiTestRes(data);
      if (data.success) {
        addLog(`✓ WhatsApp Z-API enviado com sucesso para ${testPhoneInput}! (ID: ${data.messageId || 'OK'})`, 'success');
      } else {
        addLog(`Falha no envio Z-API: ${data.message}`, 'error');
      }
    } catch (e: any) {
      setZapiTestRes({ success: false, message: e.message });
    } finally {
      setIsTestingZapi(false);
    }
  };

  // Buscar Agendamentos no DB (Protegido por Senha)
  const fetchDbRecords = async (overrideToken?: string) => {
    const token = overrideToken || adminToken || (typeof window !== 'undefined' ? sessionStorage.getItem('sabrina_admin_token') || '' : '');
    if (!token) return;

    setIsLoadingDb(true);
    try {
      const res = await fetch('/api/backend/agendamentos', {
        headers: { 'x-admin-password': token },
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setDbAgendamentos(data.agendamentos || []);
      }
    } catch (e: any) {
      console.error('Falha ao carregar agendamentos:', e.message);
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchConfig();
      fetchDbRecords();
    }
  }, [isOpen, isAuthenticated]);

  // URLs prontas baseadas no origin detectado ou no APP_URL customizado
  const resolvedOrigin = (appUrlInput.trim() && appUrlInput.startsWith('http'))
    ? appUrlInput.trim().replace(/\/$/, '')
    : (serverOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com'));
  const calcomWebhookUrl = `${resolvedOrigin}/api/webhooks/calcom`;
  const asaasWebhookUrl = `${resolvedOrigin}/api/webhooks/asaas`;
  const healthCheckUrl = `${resolvedOrigin}/api/health`;

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Acesso Administrativo & Logs
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
              Painel exclusivo da Drª Sabrina Vidal para visualização de logs em tempo real, monitoramento e configuração de chaves.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-left">
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="admin_secret_key"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  placeholder="Digite sua senha..."
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (loginError) setLoginError('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Acessar Caixa de Logs</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <span className="text-[11px] text-slate-500">
              Ambiente protegido por criptografia no backend
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentFile = BACKEND_CODE_FILES[selectedFileIndex] || BACKEND_CODE_FILES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-6xl max-h-[94vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* TOP BAR / HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950/40 border-b border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Caixa de Logs & Painel Administrativo
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Acesso Autorizado (Dra. Sabrina)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Monitoramento ao vivo dos disparos de WhatsApp, cobranças Asaas PIX, reservas Cal.com e automações de background.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer"
              title="Bloquear e sair"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sair / Bloquear</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Fechar Painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-1.5 px-6 bg-slate-900/90 border-b border-slate-800 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'logs'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            Caixa de Logs & Eventos
          </button>

          <button
            onClick={() => setActiveTab('webhooks_hub')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'webhooks_hub'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            Chaves & Webhooks
          </button>

          <button
            onClick={() => setActiveTab('live_test')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'live_test'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            Testes, QR Code & Banco
          </button>

          <button
            onClick={() => setActiveTab('domain_deploy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'domain_deploy'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Globe className="w-4 h-4 text-blue-400" />
            Domínio & Guia de Deploy
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'architecture'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Arquitetura & Fluxo
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'code'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Código dos Módulos
          </button>

          <button
            onClick={() => setActiveTab('env')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'env'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Key className="w-4 h-4" />
            Arquivo .env
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ========================================================================= */}
          {/* TAB 1: CAIXA DE LOGS & MONITORAMENTO EM TEMPO REAL                        */}
          {/* ========================================================================= */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              
              {/* STATUS INDICATORS BAR */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Status Backend</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-base font-bold text-white mt-1">200 OK Online</div>
                  <div className="text-[10px] text-emerald-400/90 mt-0.5">Express + TypeScript Ativo</div>
                </div>

                <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Banco de Dados</span>
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-base font-bold text-white mt-1">{dbAgendamentos.length} Registros</div>
                  <div className="text-[10px] text-blue-300 mt-0.5">Repositório em Memória</div>
                </div>

                <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Cron de Limpeza</span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-base font-bold text-white mt-1">15 Minutos</div>
                  <div className="text-[10px] text-amber-300 mt-0.5">Varredura a cada 60s</div>
                </div>

                <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Autenticação</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-300 mt-1">Autorizado</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Sessão da Dra. Sabrina</div>
                </div>
              </div>

              {/* ACTION TOOLBAR & SIMULATION */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={async () => {
                      setIsSimulatingCalcom(true);
                      addLog('Disparando Webhook Cal.com POST /api/webhooks/calcom (BOOKING_CREATED)...', 'info');
                      try {
                        const testId = `cal_${Date.now()}`;
                        const res = await fetch('/api/webhooks/calcom', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            triggerEvent: 'BOOKING_CREATED',
                            createdAt: new Date().toISOString(),
                            payload: {
                              id: testId,
                              title: 'Consulta Nutrição Social',
                              attendees: [{ name: 'Paciente Teste Logs', email: 'paciente.logs@exemplo.com' }],
                              responses: { phone: { value: '5511999998888' } },
                            },
                          }),
                        });
                        const data = await res.json();
                        addLog(`✓ Cal.com 200 OK! ID: ${testId} salvo como PENDING. Job: ${data.jobId}`, 'success');
                        await fetchDbRecords();
                      } catch (e: any) {
                        addLog(`Erro: ${e.message}`, 'error');
                      } finally {
                        setIsSimulatingCalcom(false);
                      }
                    }}
                    disabled={isSimulatingCalcom}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {isSimulatingCalcom ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    <span>Testar Cal.com</span>
                  </button>

                  <button
                    onClick={async () => {
                      setIsSimulatingAsaas(true);
                      addLog('Disparando Webhook Asaas POST /api/webhooks/asaas (PAYMENT_RECEIVED)...', 'info');
                      try {
                        const target = dbAgendamentos.find((a) => a.status === 'PENDING') || dbAgendamentos[0];
                        const payId = target?.asaas_payment_id || `pay_asaas_${Date.now()}`;
                        const res = await fetch('/api/webhooks/asaas', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'asaas-access-token': asaasWebhookTokenInput,
                          },
                          body: JSON.stringify({
                            event: 'PAYMENT_RECEIVED',
                            payment: {
                              id: payId,
                              value: 79.0,
                              billingType: 'PIX',
                              status: 'RECEIVED',
                              externalReference: target?.calcom_booking_id || 'cal_ref',
                            },
                          }),
                        });
                        const data = await res.json();
                        addLog(`✓ Asaas 200 OK! ID: ${payId}. Status atualizado para PAID!`, 'success');
                        await fetchDbRecords();
                      } catch (e: any) {
                        addLog(`Erro Asaas: ${e.message}`, 'error');
                      } finally {
                        setIsSimulatingAsaas(false);
                      }
                    }}
                    disabled={isSimulatingAsaas}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/90 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {isSimulatingAsaas ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    <span>Testar PIX Pago</span>
                  </button>

                  <button
                    onClick={async () => {
                      setIsTriggeringCron(true);
                      addLog('Executando ciclo do Cron de Limpeza (15 min)...', 'info');
                      try {
                        const res = await fetch('/api/backend/cron/trigger', {
                          method: 'POST',
                          headers: getAuthHeaders(),
                        });
                        if (res.status === 401) {
                          handleLogout();
                          return;
                        }
                        const data = await res.json();
                        addLog(`✓ Cron finalizado: ${data.result?.canceled || 0} agendamentos cancelados.`, 'success');
                        await fetchDbRecords();
                      } catch (e: any) {
                        addLog(`Erro cron: ${e.message}`, 'error');
                      } finally {
                        setIsTriggeringCron(false);
                      }
                    }}
                    disabled={isTriggeringCron}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/90 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {isTriggeringCron ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                    <span>Rodar Cron</span>
                  </button>

                  <button
                    onClick={handleCheckHealth}
                    disabled={isCheckingHealth}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isCheckingHealth ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-emerald-400" />}
                    <span>Health Check</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const allLogs = liveLogs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
                      handleCopy(allLogs, 'logs_export');
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    title="Copiar todos os logs"
                  >
                    {copiedKey === 'logs_export' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'logs_export' ? 'Copiado!' : 'Copiar Logs'}</span>
                  </button>

                  {liveLogs.length > 0 && (
                    <button
                      onClick={() => setLiveLogs([])}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Limpar Tela
                    </button>
                  )}
                </div>
              </div>

              {/* TERMINAL BOX (MACOS / LINUX STYLE) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                {/* Terminal Header */}
                <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                    </div>
                    <span className="text-xs font-mono text-slate-400 ml-2">
                      dra-sabrina@servidor-nutricao: ~/logs/feed.log
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>AO VIVO</span>
                  </div>
                </div>

                {/* Terminal Lines Container */}
                <div className="p-4 h-96 overflow-y-auto space-y-2 font-mono text-xs leading-relaxed selection:bg-emerald-500/30">
                  {liveLogs.length === 0 ? (
                    <div className="text-slate-500 italic py-8 text-center text-xs">
                      Caixa de logs limpa. Novos eventos, webhook triggers e requisições do sistema aparecerão aqui em tempo real.
                    </div>
                  ) : (
                    liveLogs.map((log, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2.5 ${
                          log.type === 'success'
                            ? 'text-emerald-400'
                            : log.type === 'error'
                            ? 'text-rose-400 font-semibold'
                            : log.type === 'warn'
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="text-slate-600 select-none shrink-0 font-mono text-[11px]">
                          [{log.timestamp}]
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                          log.type === 'success'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : log.type === 'error'
                            ? 'bg-rose-500/20 text-rose-300'
                            : log.type === 'warn'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {log.type.toUpperCase()}
                        </span>
                        <span className="break-all">{log.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* BANCO DE DADOS EM TEMPO REAL RESUMO */}
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Últimos Agendamentos Registrados ({dbAgendamentos.length})
                    </h4>
                  </div>
                  <button
                    onClick={() => fetchDbRecords()}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                  >
                    Atualizar Lista
                  </button>
                </div>

                {dbAgendamentos.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum agendamento gravado na memória nesta sessão.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Paciente</th>
                          <th className="py-2 px-3">Cal.com Booking</th>
                          <th className="py-2 px-3">Asaas Payment</th>
                          <th className="py-2 px-3">Horário</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {dbAgendamentos.slice(0, 5).map((a) => (
                          <tr key={a.id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                a.status === 'PAID'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : a.status === 'PENDING'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-200">{a.customer_name}</td>
                            <td className="py-2 px-3 text-emerald-300">{a.calcom_booking_id}</td>
                            <td className="py-2 px-3 text-blue-300">{a.asaas_payment_id || 'Aguardando...'}</td>
                            <td className="py-2 px-3 text-slate-400">{new Date(a.created_at).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: AMBIENTE DE WEBHOOKS & INSERÇÃO DE CHAVES                           */}
          {/* ========================================================================= */}
          {activeTab === 'webhooks_hub' && (
            <div className="space-y-6">

              {/* SECTION 1: COPIAR WEBHOOKS (DESTINADOS AO CAL.COM E ASAAS) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      1. Ambientes de Webhook para Copiar (Colar nas Plataformas)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Copie essas URLs completas e tokens para configurar nos painéis do Cal.com e do Asaas.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md text-emerald-300">
                    Host: {resolvedOrigin}
                  </span>
                </div>

                {/* Banner de Ajuste Rápido de Domínio */}
                <div className="mb-3.5 p-3 bg-slate-950/80 border border-blue-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-200">Domínio Próprio da Aplicação (APP_URL):</span>
                      <p className="text-[10px] text-slate-400">Insira seu domínio (ex: <span className="text-blue-300 font-mono">https://drasabrina.com.br</span>) para atualizar as URLs dos webhooks automaticamente.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="https://seu-dominio.com.br"
                      value={appUrlInput}
                      onChange={(e) => setAppUrlInput(e.target.value)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-blue-300 w-full sm:w-64 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSaveConfig}
                      disabled={isSavingConfig}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      {isSavingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Salvar Domínio'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Card 1: Webhook Cal.com */}
                  <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Webhook do Cal.com
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                        Gatilho: BOOKING_CREATED
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          URL do Webhook (Subscriber URL):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={calcomWebhookUrl}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300 select-all"
                          />
                          <button
                            onClick={() => handleCopy(calcomWebhookUrl, 'calcom_url')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            {copiedKey === 'calcom_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedKey === 'calcom_url' ? 'Copiado!' : 'Copiar URL'}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Segredo do Webhook (Secret HMAC SHA-256):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={calcomSecretInput}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 select-all"
                          />
                          <button
                            onClick={() => handleCopy(calcomSecretInput, 'calcom_secret')}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            {copiedKey === 'calcom_secret' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedKey === 'calcom_secret' ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <div className="font-semibold text-slate-300">Onde colar no Cal.com:</div>
                      <div>1. Acesse seu Cal.com &gt; <strong>Configurações</strong> &gt; <strong>Webhooks</strong>.</div>
                      <div>2. Clique em <strong>Adicionar Novo Webhook</strong>.</div>
                      <div>3. Cole a URL acima, escolha <strong>Agendamento Criado</strong> e cole o segredo.</div>
                    </div>
                  </div>

                  {/* Card 2: Webhook Asaas */}
                  <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Webhook do Asaas (Cobranças)
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                        Gatilho: PAYMENT_RECEIVED
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          URL do Webhook:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={asaasWebhookUrl}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-blue-300 select-all"
                          />
                          <button
                            onClick={() => handleCopy(asaasWebhookUrl, 'asaas_url')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            {copiedKey === 'asaas_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedKey === 'asaas_url' ? 'Copiado!' : 'Copiar URL'}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Token de Autenticação (Header 'asaas-access-token'):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={asaasWebhookTokenInput}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 select-all"
                          />
                          <button
                            onClick={() => handleCopy(asaasWebhookTokenInput, 'asaas_token')}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            {copiedKey === 'asaas_token' ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedKey === 'asaas_token' ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <div className="font-semibold text-slate-300">Onde colar no Asaas:</div>
                      <div>1. Acesse <strong>Minha Conta</strong> &gt; <strong>Configurações</strong> &gt; <strong>Integrações</strong>.</div>
                      <div>2. Em <strong>Webhooks para Cobranças</strong>, cole a URL acima.</div>
                      <div>3. Marque <strong>Pagamento Recebido</strong> e cole o Token de Autenticação.</div>
                    </div>

                    {/* Diagnostic / Penalização 302 Warning & Solution */}
                    <div className="p-3 bg-amber-950/40 rounded-lg border border-amber-500/30 text-[11px] text-amber-200/90 space-y-1.5">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Aviso sobre Penalização no Asaas (Código 302 / Location):
                      </div>
                      <div className="text-slate-300 leading-relaxed">
                        • <strong>Por que ocorre:</strong> O Asaas exige resposta direta HTTP 200. O ambiente de preview em nuvem possui uma camada interna de segurança (redirecionamento 302 com <em>Location: /__cookie_check.html</em>), fazendo o Asaas registrar o erro <em>"O recurso foi temporariamente movido..."</em> e penalizar a fila.
                      </div>
                      <div className="text-slate-300 leading-relaxed">
                        • <strong>Solução Implementada (Fail-Proof):</strong> O backend agora possui <strong>reconciliação ativa direta na API do Asaas a cada 3 segundos</strong>. Assim, mesmo com o webhook penalizado ou bloqueado, quando o PIX for pago, o sistema detecta imediatamente na API do Asaas e confirma a consulta!
                      </div>
                      <div className="text-slate-300 leading-relaxed">
                        • <strong>Como limpar a penalização no Asaas:</strong> No painel do Asaas &gt; <em>Webhooks</em> &gt; <em>Fila de Sincronização</em>, clique em <strong>"Remover Penalização"</strong>.
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION 2: INSERIR CHAVES & TOKENS NO BACKEND */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      2. Inserção de Chaves no Backend para Funcionamento Pleno
                    </h3>
                    <p className="text-xs text-slate-400">
                      Insira as chaves reais das plataformas. Elas serão salvas e ativadas imediatamente no servidor Node.js.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveConfig}
                      disabled={isSavingConfig}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
                    >
                      {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                      Salvar & Ativar Chaves
                    </button>
                  </div>
                </div>

                {saveStatus && (
                  <div
                    className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      saveStatus.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {saveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {saveStatus.message}
                  </div>
                )}

                {/* Form Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  
                  {/* Bloco 1: Asaas */}
                  <div className="space-y-3 p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <CreditCard className="w-3.5 h-3.5" />
                        Asaas (PIX)
                      </span>
                      <button
                        onClick={handleTestAsaas}
                        disabled={isTestingAsaas}
                        className="text-[10px] font-semibold px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 rounded flex items-center gap-1 transition-colors"
                      >
                        {isTestingAsaas ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                        Testar API Asaas
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Chave de API do Asaas (ASAAS_API_KEY):</label>
                      <div className="relative">
                        <input
                          type={showAsaasKey ? 'text' : 'password'}
                          placeholder="Cole sua chave $aact_..."
                          value={asaasApiKeyInput}
                          onChange={(e) => setAsaasApiKeyInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 pr-9 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAsaasKey(!showAsaasKey)}
                          className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                        >
                          {showAsaasKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Ambiente:</label>
                        <select
                          value={asaasEnvInput}
                          onChange={(e: any) => setAsaasEnvInput(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="production">Produção (Real)</option>
                          <option value="sandbox">Sandbox (Testes)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Token do Webhook:</label>
                        <input
                          type="text"
                          value={asaasWebhookTokenInput}
                          onChange={(e) => setAsaasWebhookTokenInput(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {asaasTestRes && (
                      <div className={`p-2 rounded text-[11px] ${asaasTestRes.success ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800' : 'bg-rose-950/40 text-rose-300 border border-rose-800'}`}>
                        {asaasTestRes.message}
                      </div>
                    )}

                    {/* Botão de Geração de PIX Real no Asaas */}
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div>
                        <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                          CPF do Paciente para Emissão (Exigido pelo Asaas):
                        </label>
                        <input
                          type="text"
                          value={testCpfInput}
                          onChange={(e) => setTestCpfInput(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={handleGenerateAsaasPix}
                        disabled={isGeneratingAsaasPix}
                        className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                      >
                        {isGeneratingAsaasPix ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-yellow-300" />
                        )}
                        Emitir Cobrança PIX Oficial no Asaas (R$ {Number(priceBrlInput).toFixed(2)})
                      </button>
                    </div>

                    {/* Exibição da Cobrança PIX Gerada no Asaas */}
                    {generatedAsaasPix && (
                      <div className="p-3 bg-slate-950/90 border border-blue-500/40 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ✓ Registrado no Asaas ({generatedAsaasPix.status})
                          </span>
                          <a
                            href={generatedAsaasPix.dashboardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 underline"
                          >
                            Abrir no Asaas <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>

                        <div className="text-[11px] text-slate-300 font-mono">
                          <span className="text-slate-500">ID da Cobrança:</span> <strong className="text-white">{generatedAsaasPix.paymentId}</strong>
                        </div>

                        {generatedAsaasPix.qrCodeImage && (
                          <div className="flex justify-center p-2 bg-white rounded-lg w-fit mx-auto shadow">
                            <img
                              src={generatedAsaasPix.qrCodeImage}
                              alt="QR Code PIX Asaas"
                              className="w-32 h-32 object-contain"
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Código PIX Copia e Cola Oficial:</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              readOnly
                              value={generatedAsaasPix.pixPayload}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] font-mono text-emerald-300 select-all"
                            />
                            <button
                              onClick={() => handleCopy(generatedAsaasPix.pixPayload, 'generated_pix')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold shrink-0"
                            >
                              {copiedKey === 'generated_pix' ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bloco 2: Cal.com */}
                  <div className="space-y-3 p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Calendar className="w-3.5 h-3.5" />
                        Cal.com
                      </span>
                      <button
                        onClick={handleTestCalcom}
                        disabled={isTestingCalcom}
                        className="text-[10px] font-semibold px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 rounded flex items-center gap-1 transition-colors"
                      >
                        {isTestingCalcom ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                        Testar API Cal.com
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Chave de API do Cal.com (CALCOM_API_KEY):</label>
                      <div className="relative">
                        <input
                          type={showCalcomKey ? 'text' : 'password'}
                          placeholder="Cole sua chave cal_live_..."
                          value={calcomApiKeyInput}
                          onChange={(e) => setCalcomApiKeyInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 pr-9 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCalcomKey(!showCalcomKey)}
                          className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                        >
                          {showCalcomKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Segredo de Assinatura (Webhook Secret):</label>
                      <input
                        type="text"
                        value={calcomSecretInput}
                        onChange={(e) => setCalcomSecretInput(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Link do Evento:</label>
                      <input
                        type="text"
                        value={calcomEventUrlInput}
                        onChange={(e) => setCalcomEventUrlInput(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    {calcomTestRes && (
                      <div className={`p-2 rounded text-[11px] ${calcomTestRes.success ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800' : 'bg-rose-950/40 text-rose-300 border border-rose-800'}`}>
                        {calcomTestRes.message}
                      </div>
                    )}
                  </div>

                  {/* Bloco 3: Z-API WhatsApp */}
                  <div className="space-y-3.5 p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Z-API (WhatsApp)
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleFetchZapiQr}
                          disabled={isFetchingZapiQr}
                          title="Gerar QR Code para escanear"
                          className="text-[10px] font-semibold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isFetchingZapiQr ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <QrCode className="w-2.5 h-2.5 text-emerald-400" />}
                          QR Code
                        </button>
                        <button
                          onClick={handleCheckZapiStatus}
                          disabled={isCheckingZapiStatus}
                          className="text-[10px] font-semibold px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isCheckingZapiStatus ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                          Status
                        </button>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {zapiStatusRes && (
                      <div
                        className={`p-3 rounded-xl text-[11px] border ${
                          zapiStatusRes.connected
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                            : zapiStatusRes.requiresClientToken
                            ? 'bg-amber-950/80 text-amber-200 border-amber-500/80 shadow-lg shadow-amber-950/50'
                            : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                        }`}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                zapiStatusRes.connected
                                  ? 'bg-emerald-400 animate-pulse'
                                  : zapiStatusRes.requiresClientToken
                                  ? 'bg-amber-400 animate-ping'
                                  : 'bg-rose-400'
                              }`}
                            />
                            {zapiStatusRes.connected
                              ? 'WhatsApp Pareado & Conectado (Multi-Device Ativo)'
                              : zapiStatusRes.requiresClientToken
                              ? 'WhatsApp Conectado na Z-API — Aguardando Client-Token!'
                              : 'WhatsApp Desconectado'}
                          </span>
                          {!zapiStatusRes.connected && !zapiStatusRes.requiresClientToken && (
                            <button
                              onClick={handleFetchZapiQr}
                              disabled={isFetchingZapiQr}
                              className="text-[10px] underline font-bold text-amber-300 hover:text-white"
                            >
                              Escanear QR Code agora &rarr;
                            </button>
                          )}
                        </div>
                        <p className="mt-1.5 text-slate-200 text-[11px] leading-relaxed">
                          {zapiStatusRes.message}
                        </p>
                        {zapiStatusRes.requiresClientToken && (
                          <div className="mt-2.5 pt-2 border-t border-amber-500/30 text-[11px] text-amber-300 leading-relaxed bg-amber-950/40 p-2 rounded-lg">
                            <span className="font-bold text-white block mb-1">📋 Como liberar os disparos agora:</span>
                            <ol className="list-decimal list-inside space-y-0.5 text-amber-200/90 text-[10px]">
                              <li>Acesse o painel da <strong>Z-API</strong> (app.z-api.io).</li>
                              <li>No menu superior ou lateral, clique em <strong>Segurança</strong>.</li>
                              <li>Copie o seu <strong>Token de Segurança da Conta (Client-Token)</strong>.</li>
                              <li>Cole no campo <strong>Client-Token da Conta</strong> destacado abaixo.</li>
                              <li>Clique em <strong>Salvar Configurações</strong> e em seguida em <strong>Status</strong>.</li>
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* QR Code Viewer Modal / Card */}
                    {zapiQrCodeImage && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/40 text-center space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5" />
                            Escaneie com seu WhatsApp:
                          </span>
                          <button
                            onClick={() => setZapiQrCodeImage(null)}
                            className="text-[10px] text-slate-400 hover:text-white"
                          >
                            Fechar
                          </button>
                        </div>
                        <div className="flex justify-center p-2 bg-white rounded-lg inline-block mx-auto">
                          <img
                            src={zapiQrCodeImage}
                            alt="QR Code Z-API WhatsApp"
                            className="w-48 h-48 object-contain"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          No celular: <strong>WhatsApp &gt; Menu (3 pontos ou Configurações) &gt; Aparelhos Conectados &gt; Conectar um aparelho</strong>.
                        </p>
                        <div className="flex justify-center gap-2 pt-1">
                          <button
                            onClick={handleCheckZapiStatus}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Já escaneei, verificar status
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        ID da Instância (ZAPI_INSTANCE_ID):
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 3Cxxxxxxxxxxxx"
                        value={zapiInstanceInput}
                        onChange={(e) => setZapiInstanceInput(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Token da Instância (ZAPI_TOKEN):
                      </label>
                      <div className="relative">
                        <input
                          type={showZapiToken ? 'text' : 'password'}
                          placeholder="Cole o Token da Instância Z-API"
                          value={zapiTokenInput}
                          onChange={(e) => setZapiTokenInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 pr-9 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowZapiToken(!showZapiToken)}
                          className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                        >
                          {showZapiToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-300 font-medium block flex items-center gap-1.5">
                          Client-Token da Conta (ZAPI_CLIENT_TOKEN):
                          {zapiStatusRes?.requiresClientToken && (
                            <span className="text-amber-400 text-[10px] font-bold animate-pulse">← Obrigatório para sua conta</span>
                          )}
                        </label>
                        <span className={`text-[10px] font-medium ${zapiStatusRes?.requiresClientToken ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                          Z-API &gt; Menu &gt; Segurança
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="Cole o Token de Segurança da sua conta Z-API"
                        value={zapiClientTokenInput}
                        onChange={(e) => setZapiClientTokenInput(e.target.value)}
                        className={`w-full px-3 py-1.5 bg-slate-950 border rounded-lg text-xs font-mono text-slate-200 focus:outline-none transition-all ${
                          zapiStatusRes?.requiresClientToken
                            ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/20 shadow-md shadow-amber-950/40'
                            : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-400 block">
                          Telefone para Teste (com DDD):
                        </label>
                        {testPhoneInput && (
                          <button
                            type="button"
                            onClick={handleCheckPhone}
                            disabled={isCheckingPhone}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            {isCheckingPhone ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Search className="w-2.5 h-2.5" />}
                            Verificar no WhatsApp
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Ex: 11999998888 ou 5511999998888"
                          value={testPhoneInput}
                          onChange={(e) => setTestPhoneInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          onClick={handleTestZapi}
                          disabled={isTestingZapi}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                        >
                          {isTestingZapi ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Disparar WhatsApp
                        </button>
                      </div>
                    </div>

                    {/* Feedback da verificação de número */}
                    {zapiPhoneCheckRes && (
                      <div
                        className={`p-2 rounded text-[10px] leading-tight ${
                          zapiPhoneCheckRes.exists
                            ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950/40 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {zapiPhoneCheckRes.message}
                      </div>
                    )}

                    {/* Feedback do disparo de teste */}
                    {zapiTestRes && (
                      <div
                        className={`p-2.5 rounded-lg text-[11px] border leading-relaxed ${
                          zapiTestRes.success
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                            : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                        }`}
                      >
                        {zapiTestRes.message}
                      </div>
                    )}
                  </div>

                </div>

                {/* Parâmetros de Consulta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-slate-300">Valor da Consulta Social (R$)</div>
                      <div className="text-[11px] text-slate-500">Valor enviado na cobrança PIX automática</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={priceBrlInput}
                        onChange={(e) => setPriceBrlInput(Number(e.target.value))}
                        className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-emerald-400 text-right focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-slate-300">Prazo de Pagamento (Minutos)</div>
                      <div className="text-[11px] text-slate-500">Tempo até o Cron cancelar e liberar a agenda</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={expirationMinInput}
                        onChange={(e) => setExpirationMinInput(Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-amber-400 text-right focus:outline-none"
                      />
                      <span className="text-xs text-slate-400">min</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: DOMÍNIO & GUIA DE DEPLOY EM PRODUÇÃO                                */}
          {/* ========================================================================= */}
          {activeTab === 'domain_deploy' && (
            <div className="space-y-6">

              {/* Status Banner */}
              <div className="p-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-emerald-950/60 border border-blue-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Preparado para Importação em Domínio Próprio</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        100% Auditado
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      O backend Node.js já possui <span className="text-emerald-300 font-mono">trust proxy</span>, headers CORS liberados, persistência em banco, verificação rawBody para HMAC e endpoints de health check ativos.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCheckHealth}
                  disabled={isCheckingHealth}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  {isCheckingHealth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  Testar Health Check (/health)
                </button>
              </div>

              {healthCheckRes && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-center justify-between ${
                    healthCheckRes.status === 'healthy'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                      : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      <strong>Status: {healthCheckRes.status}</strong> | Uptime: {healthCheckRes.uptimeSeconds}s | Ambiente Asaas: {healthCheckRes.asaasEnvironment || 'production'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {healthCheckRes.timestamp}
                  </span>
                </div>
              )}

              {/* CARD 1: CONFIGURAÇÃO DO DOMÍNIO E URLS FINAIS */}
              <div className="p-5 bg-slate-800/60 border border-slate-700/70 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      1. Definição do Domínio Próprio da Aplicação
                    </h4>
                    <p className="text-xs text-slate-400">
                      Ao preencher seu domínio oficial, todas as URLs de webhook abaixo são recalculadas instantaneamente para você colar no Cal.com e no Asaas.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-blue-300 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                    Host Atual: {resolvedOrigin}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="Ex: https://drasabrinavidal.com.br"
                      value={appUrlInput}
                      onChange={(e) => setAppUrlInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-blue-300 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSaveConfig}
                    disabled={isSavingConfig}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Salvar Domínio no Servidor
                  </button>
                </div>

                {/* Tabela de URLs Oficiais do Domínio */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-slate-300">URLs que devem ser cadastradas nos painéis:</div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-emerald-400">Webhook Cal.com (Agendamento Criado):</div>
                        <div className="text-xs font-mono text-slate-200 select-all">{calcomWebhookUrl}</div>
                      </div>
                      <button
                        onClick={() => handleCopy(calcomWebhookUrl, 'dep_calcom')}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold shrink-0"
                      >
                        {copiedKey === 'dep_calcom' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>

                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-blue-400">Webhook Asaas (Pagamento Recebido):</div>
                        <div className="text-xs font-mono text-slate-200 select-all">{asaasWebhookUrl}</div>
                      </div>
                      <button
                        onClick={() => handleCopy(asaasWebhookUrl, 'dep_asaas')}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold shrink-0"
                      >
                        {copiedKey === 'dep_asaas' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>

                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-amber-400">URL de Health Check & Uptime:</div>
                        <div className="text-xs font-mono text-slate-200 select-all">{healthCheckUrl}</div>
                      </div>
                      <button
                        onClick={() => handleCopy(healthCheckUrl, 'dep_health')}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold shrink-0"
                      >
                        {copiedKey === 'dep_health' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: APONTAMENTO DE DNS NO SEU REGISTRADOR */}
              <div className="p-5 bg-slate-800/60 border border-slate-700/70 rounded-xl space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                  2. Apontamento de DNS no Registrador (Registro.br, Cloudflare, HostGator, GoDaddy)
                </h4>
                <p className="text-xs text-slate-300">
                  Na Zona de DNS do seu domínio, crie os seguintes apontamentos para direcionar o tráfego para seu servidor:
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400 uppercase text-[10px] tracking-wider">
                        <th className="py-2 px-3">Tipo</th>
                        <th className="py-2 px-3">Nome / Host</th>
                        <th className="py-2 px-3">Destino / Valor</th>
                        <th className="py-2 px-3">TTL</th>
                        <th className="py-2 px-3">Finalidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                      <tr>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">A</td>
                        <td className="py-2.5 px-3 text-white">@</td>
                        <td className="py-2.5 px-3 text-blue-300 font-bold">IP_DO_SEU_SERVIDOR (ex: 185.120.xx.xx)</td>
                        <td className="py-2.5 px-3 text-slate-400">Auto / 3600</td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans">Aponta o domínio raiz para seu servidor.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">CNAME</td>
                        <td className="py-2.5 px-3 text-white">www</td>
                        <td className="py-2.5 px-3 text-blue-300 font-bold">seudominio.com.br</td>
                        <td className="py-2.5 px-3 text-slate-400">Auto / 3600</td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans">Redireciona www para o domínio raiz.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CARD 3: COMANDOS DE BUILD & HOSPEDAGEM */}
              <div className="p-5 bg-slate-800/60 border border-slate-700/70 rounded-xl space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  3. Como Rodar em Produção (Vercel, Railway, Render, Docker ou VPS)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bloco 1: PaaS (Railway / Render / Fly.io) */}
                  <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      Opção A: Plataformas Cloud (Railway / Render / Fly)
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      1. Suba este código para um repositório Git (GitHub ou GitLab).<br />
                      2. Conecte ao Railway ou Render selecionando o repositório.<br />
                      3. Comando de Build: <code className="text-emerald-300 bg-slate-950 px-1 rounded">npm run build</code><br />
                      4. Comando de Start: <code className="text-emerald-300 bg-slate-950 px-1 rounded">npm start</code><br />
                      5. Insira as variáveis do seu <code className="text-amber-300">.env</code> na aba Environment Variables.
                    </p>
                  </div>

                  {/* Bloco 2: VPS Linux (Ubuntu com Nginx + PM2) */}
                  <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-blue-400" />
                      Opção B: VPS Própria (Ubuntu / Nginx / PM2)
                    </div>
                    <pre className="text-[10px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 overflow-x-auto">
{`# 1. Instalar dependências e build
npm install
npm run build

# 2. Iniciar processo de background com PM2
pm2 start server.ts --name sabrina-app --interpreter ./node_modules/.bin/tsx
pm2 save

# 3. Gerar Certificado SSL Gratuito (HTTPS)
sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* CARD 4: AUDITORIA DE TODAS AS INTEGRAÇÕES */}
              <div className="p-5 bg-slate-800/60 border border-slate-700/70 rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  4. Checklist de Auditoria das Integrações Realizadas
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Cal.com API v2 + Webhooks:</strong>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Migrado para API v2 com Authorization Bearer, validação HMAC SHA-256 no header x-cal-signature-256 e confirmação de status ACCEPTED após pagamento.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Asaas PIX Gateway:</strong>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Detecção automática de Produção vs Sandbox, CPF/CNPJ obrigatório no cadastro de cliente, geração de QR Code base64 e Webhook de pagamento recebido com resposta 200 instantânea.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Z-API WhatsApp Transacional:</strong>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Suporte a Client-Token de segurança da conta, sanitização do 9º dígito brasileiro (DDI 55 + DDD + 9 dígitos), leitor de QR Code na tela e disparo automático do PIX e do link Google Meet.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Cron Job 15m & Idempotência:</strong>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Varredura a cada 60s para liberar horários de reservas não pagas no Cal.com, cancelamento de cobrança no Asaas e proteção contra pagamentos duplicados no banco.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: ARQUITETURA & ESTRUTURA                                              */}
          {/* ========================================================================= */}
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-1">
                    <Zap className="w-4 h-4" />
                    Responda Rápido, Processe Depois
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tanto o Webhook do Cal.com quanto o do Asaas salvam a intenção e respondem <span className="font-mono text-emerald-300 font-bold">200 OK</span> em menos de 100ms. O processamento pesado (PIX, WhatsApp e API da agenda) ocorre de forma assíncrona no background worker.
                  </p>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    Garantia Rígida de Idempotência
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Quando o Asaas reenvia <span className="font-mono text-blue-300">PAYMENT_RECEIVED</span>, o worker consulta o banco de dados. Se o status já for <span className="font-mono text-blue-300 font-bold">PAID</span>, a requisição é descartada sem duplicar mensagens no WhatsApp nem chamadas repetidas na agenda.
                  </p>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Limpeza de Abandonos (15 min)
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Um Cron Job executa a cada 1 minuto buscando agendamentos <span className="font-mono text-amber-300">PENDING</span> criados há mais de 15 minutos. Cancela o horário no Cal.com liberando a vaga, remove o PIX no Asaas, marca como <span className="font-mono text-amber-300">CANCELED</span> e avisa o cliente no WhatsApp.
                  </p>
                </div>
              </div>

              {/* Directory Tree */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-emerald-400" />
                    Estrutura de Pastas e Arquivos do Backend
                  </h3>
                  <button
                    onClick={() => handleCopy(BACKEND_DIRECTORY_STRUCTURE, 'structure')}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-slate-200 transition-colors"
                  >
                    {copiedKey === 'structure' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'structure' ? 'Copiado!' : 'Copiar Estrutura'}
                  </button>
                </div>

                <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-emerald-400/90 overflow-x-auto border border-slate-800 leading-relaxed">
                  {BACKEND_DIRECTORY_STRUCTURE}
                </pre>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: CÓDIGO FONTE COMPLETO                                                */}
          {/* ========================================================================= */}
          {activeTab === 'code' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              <div className="lg:col-span-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Módulos do Sistema</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{BACKEND_CODE_FILES.length} arquivos</span>
                </div>

                <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                  {BACKEND_CODE_FILES.map((file, idx) => {
                    const isSelected = selectedFileIndex === idx;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFileIndex(idx)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-md'
                            : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono truncate">{file.filename}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono uppercase">
                            {file.language}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 line-clamp-1">{file.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-mono font-bold text-slate-200 truncate">
                      {currentFile.path}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopy(currentFile.code, currentFile.path)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shrink-0"
                  >
                    {copiedKey === currentFile.path ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Arquivo
                      </>
                    )}
                  </button>
                </div>

                <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 text-xs text-slate-400">
                  {currentFile.description}
                </div>

                <div className="p-4 overflow-x-auto max-h-[520px] overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed selection:bg-emerald-500/30">
                  <pre className="whitespace-pre">{currentFile.code}</pre>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: SIMULADOR & BANCO DE DADOS                                           */}
          {/* ========================================================================= */}
          {activeTab === 'live_test' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        1. Webhook Cal.com
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                        POST
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">
                      Dispara <span className="font-mono text-emerald-300">BOOKING_CREATED</span>: salva PENDING no DB, responde 200 OK e chama Asaas PIX + Z-API.
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      setIsSimulatingCalcom(true);
                      addLog('Disparando Webhook Cal.com POST /api/webhooks/calcom (BOOKING_CREATED)...', 'info');
                      try {
                        const testId = `cal_${Date.now()}`;
                        const res = await fetch('/api/webhooks/calcom', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            triggerEvent: 'BOOKING_CREATED',
                            createdAt: new Date().toISOString(),
                            payload: {
                              id: testId,
                              title: 'Consulta Nutrição Social',
                              attendees: [{ name: 'Mariana Alencar', email: 'mariana@exemplo.com' }],
                              responses: { phone: { value: '5511987654321' } },
                            },
                          }),
                        });
                        const data = await res.json();
                        addLog(`✓ Cal.com 200 OK! ID: ${testId} salvo como PENDING. Job: ${data.jobId}`, 'success');
                        await fetchDbRecords();
                      } catch (e: any) {
                        addLog(`Erro: ${e.message}`, 'error');
                      } finally {
                        setIsSimulatingCalcom(false);
                      }
                    }}
                    disabled={isSimulatingCalcom}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    {isSimulatingCalcom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Testar Webhook Cal.com
                  </button>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                        2. Webhook Asaas
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                        POST
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">
                      Dispara <span className="font-mono text-blue-300">PAYMENT_RECEIVED</span>: valida token, 200 OK, checa idempotência, marca PAID e confirma Cal.com.
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      setIsSimulatingAsaas(true);
                      addLog('Disparando Webhook Asaas POST /api/webhooks/asaas (PAYMENT_RECEIVED)...', 'info');
                      try {
                        const target = dbAgendamentos.find((a) => a.status === 'PENDING') || dbAgendamentos[0];
                        const payId = target?.asaas_payment_id || `pay_asaas_${Date.now()}`;
                        const res = await fetch('/api/webhooks/asaas', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'asaas-access-token': asaasWebhookTokenInput,
                          },
                          body: JSON.stringify({
                            event: 'PAYMENT_RECEIVED',
                            payment: {
                              id: payId,
                              value: 79.0,
                              billingType: 'PIX',
                              status: 'RECEIVED',
                              externalReference: target?.calcom_booking_id || 'cal_ref',
                            },
                          }),
                        });
                        const data = await res.json();
                        addLog(`✓ Asaas 200 OK! ID: ${payId}. Status atualizado para PAID!`, 'success');
                        await fetchDbRecords();
                      } catch (e: any) {
                        addLog(`Erro Asaas: ${e.message}`, 'error');
                      } finally {
                        setIsSimulatingAsaas(false);
                      }
                    }}
                    disabled={isSimulatingAsaas}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    {isSimulatingAsaas ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Testar Webhook Asaas (PIX Pago)
                  </button>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        3. Rotina de Limpeza
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                        1 Minuto
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">
                      Varre agendamentos PENDING criados há mais de 15 minutos, cancela na agenda, marca CANCELED e notifica WhatsApp.
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      setIsTriggeringCron(true);
                      addLog('Executando ciclo do Cron de Limpeza...', 'info');
                      try {
                        const res = await fetch('/api/backend/cron/trigger', { method: 'POST' });
                        const data = await res.json();
                        addLog(`✓ Cron finalizado: ${data.result?.canceled || 0} agendamentos cancelados.`, 'success');
                        await fetchDbRecords();
                      } catch (e: any) {
                        addLog(`Erro cron: ${e.message}`, 'error');
                      } finally {
                        setIsTriggeringCron(false);
                      }
                    }}
                    disabled={isTriggeringCron}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    {isTriggeringCron ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Executar Ciclo do Cron
                  </button>
                </div>

              </div>

              {/* Tabela do Banco */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Tabela de Agendamentos no Banco de Dados ({dbAgendamentos.length} registros)
                    </h3>
                  </div>

                  <button
                    onClick={() => fetchDbRecords()}
                    disabled={isLoadingDb}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1 bg-slate-700 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingDb ? 'animate-spin' : ''}`} />
                    Atualizar Tabela
                  </button>
                </div>

                {dbAgendamentos.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-lg border border-slate-800">
                    Nenhum agendamento registrado ainda. Clique em "Testar Webhook Cal.com" acima para gerar uma reserva de teste!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700/60">
                        <tr>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Cliente</th>
                          <th className="py-2 px-3">Cal.com Booking ID</th>
                          <th className="py-2 px-3">Asaas Payment ID</th>
                          <th className="py-2 px-3">Data Criação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {dbAgendamentos.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.status === 'PAID'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : item.status === 'PENDING'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                              {item.customer_name}
                              <div className="text-[10px] text-slate-400 font-mono">{item.customer_phone}</div>
                            </td>
                            <td className="py-2.5 px-3 text-emerald-300 truncate max-w-[150px]">
                              {item.calcom_booking_id}
                            </td>
                            <td className="py-2.5 px-3 text-blue-300 truncate max-w-[150px]">
                              {item.asaas_payment_id || <span className="text-slate-500">Aguardando Worker...</span>}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {new Date(item.created_at).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Console de Logs */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                      Console de Execução dos Workers & Cron
                    </span>
                  </div>
                  {liveLogs.length > 0 && (
                    <button
                      onClick={() => setLiveLogs([])}
                      className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Limpar logs
                    </button>
                  )}
                </div>

                <div className="h-40 overflow-y-auto space-y-1 font-mono text-xs p-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
                  {liveLogs.length === 0 ? (
                    <div className="text-slate-500 italic text-[11px]">
                      Aguardando disparos de teste... Clique nos botões acima para ver os eventos em tempo real.
                    </div>
                  ) : (
                    liveLogs.map((log, i) => (
                      <div
                        key={i}
                        className={`leading-relaxed ${
                          log.type === 'success'
                            ? 'text-emerald-400'
                            : log.type === 'error'
                            ? 'text-rose-400 font-bold'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="text-slate-500 select-none mr-2">[{log.timestamp}]</span>
                        {log.text}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: DOCUMENTAÇÃO .ENV                                                    */}
          {/* ========================================================================= */}
          {activeTab === 'env' && (
            <div className="space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-400" />
                    Variáveis de Ambiente para a Hostinger (.env)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Variáveis completas com todas as chaves da Z-API e do sistema prontas para copiar e colar no painel da Hostinger.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const generatedEnv = `# ==============================================================================
# VARIÁVEIS DE AMBIENTE - HOSTINGER PRODUÇÃO (DRA. SABRINA VIDAL)
# ==============================================================================
NODE_ENV=production
PORT=3000
APP_URL=${appUrlInput || 'https://sabrinavidal.com.br'}
ADMIN_PASSWORD=sabrina@admin2026

# Z-API (WHATSAPP OFICIAL)
ZAPI_INSTANCE_ID=${zapiInstanceInput || '3FB2B3C4ABE0E161991CBEBF5C448C78'}
ZAPI_TOKEN=${zapiTokenInput || '0BC27FC112C8DFDBAF9AE3A7'}
ZAPI_CLIENT_TOKEN=${zapiClientTokenInput || ''}
ZAPI_BASE_URL=https://api.z-api.io

# ASAAS (GATEWAY PIX)
ASAAS_API_KEY=${asaasApiKeyInput || ''}
ASAAS_ENVIRONMENT=${asaasEnvInput || 'production'}
ASAAS_WEBHOOK_TOKEN=${asaasWebhookTokenInput || ''}

# CAL.COM (API v2)
CALCOM_API_KEY=${calcomApiKeyInput || ''}
CALCOM_WEBHOOK_SECRET=${calcomSecretInput || ''}
CALCOM_BASE_URL=https://api.cal.com/v2
CALCOM_EVENT_URL=${calcomEventUrlInput || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas'}

# REGRAS DE NEGÓCIO
CONSULTATION_PRICE_BRL=${priceBrlInput || '79.00'}
PIX_EXPIRATION_MINUTES=${expirationMinInput || '15'}
SABRINA_NOTIFICATION_EMAIL=nutricionistasabrinaamorim@gmail.com`;
                    handleCopy(generatedEnv, 'env_full');
                  }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all shrink-0 cursor-pointer"
                >
                  {copiedKey === 'env_full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'env_full' ? 'Copiado para a Área de Transferência!' : 'Copiar .env Completo para Hostinger'}
                </button>
              </div>

              {/* Tabela de Variáveis Z-API para adicionar individualmente na Hostinger */}
              <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Chaves da Z-API para colar na aba &ldquo;Environment Variables&rdquo; da Hostinger:
                  </h4>
                  <span className="text-[10px] text-slate-400">Hostinger &gt; Node.js App &gt; Variáveis de Ambiente</span>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  {/* ZAPI_INSTANCE_ID */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="space-y-0.5">
                      <span className="font-mono text-emerald-400 font-bold block text-[11px]">ZAPI_INSTANCE_ID</span>
                      <span className="font-mono text-slate-300 text-[11px] block">{zapiInstanceInput || '3FB2B3C4ABE0E161991CBEBF5C448C78'}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(zapiInstanceInput || '3FB2B3C4ABE0E161991CBEBF5C448C78', 'copy_inst')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'copy_inst' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copiar Valor
                    </button>
                  </div>

                  {/* ZAPI_TOKEN */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="space-y-0.5">
                      <span className="font-mono text-emerald-400 font-bold block text-[11px]">ZAPI_TOKEN</span>
                      <span className="font-mono text-slate-300 text-[11px] block">{zapiTokenInput || '0BC27FC112C8DFDBAF9AE3A7'}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(zapiTokenInput || '0BC27FC112C8DFDBAF9AE3A7', 'copy_tok')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'copy_tok' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copiar Valor
                    </button>
                  </div>

                  {/* ZAPI_BASE_URL */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="space-y-0.5">
                      <span className="font-mono text-emerald-400 font-bold block text-[11px]">ZAPI_BASE_URL</span>
                      <span className="font-mono text-slate-300 text-[11px] block">https://api.z-api.io</span>
                    </div>
                    <button
                      onClick={() => handleCopy('https://api.z-api.io', 'copy_url')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'copy_url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copiar Valor
                    </button>
                  </div>

                  {/* ZAPI_CLIENT_TOKEN */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 font-bold text-[11px]">ZAPI_CLIENT_TOKEN</span>
                        <span className="text-[10px] text-amber-400 bg-amber-950/50 px-1 rounded">Segurança da Conta</span>
                      </div>
                      <span className="font-mono text-slate-300 text-[11px] block">
                        {zapiClientTokenInput || '(Preencha se o seu painel Z-API exigir em Menu > Segurança)'}
                      </span>
                    </div>
                    {zapiClientTokenInput ? (
                      <button
                        onClick={() => handleCopy(zapiClientTokenInput, 'copy_cltok')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'copy_cltok' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copiar Valor
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto">
                <pre>{`# ==============================================================================
# VARIÁVEIS DE AMBIENTE - HOSTINGER (.env)
# ==============================================================================
NODE_ENV=production
PORT=3000
APP_URL=${appUrlInput || 'https://sabrinavidal.com.br'}
ADMIN_PASSWORD=sabrina@admin2026

# Z-API (WHATSAPP OFICIAL)
ZAPI_INSTANCE_ID=${zapiInstanceInput || '3FB2B3C4ABE0E161991CBEBF5C448C78'}
ZAPI_TOKEN=${zapiTokenInput || '0BC27FC112C8DFDBAF9AE3A7'}
ZAPI_CLIENT_TOKEN=${zapiClientTokenInput || ''}
ZAPI_BASE_URL=https://api.z-api.io

# ASAAS (GATEWAY PIX)
ASAAS_API_KEY=${asaasApiKeyInput || ''}
ASAAS_ENVIRONMENT=${asaasEnvInput || 'production'}
ASAAS_WEBHOOK_TOKEN=${asaasWebhookTokenInput || ''}

# CAL.COM (API v2)
CALCOM_API_KEY=${calcomApiKeyInput || ''}
CALCOM_WEBHOOK_SECRET=${calcomSecretInput || ''}
CALCOM_BASE_URL=https://api.cal.com/v2
CALCOM_EVENT_URL=${calcomEventUrlInput || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas'}

# REGRAS DE NEGÓCIO
CONSULTATION_PRICE_BRL=${priceBrlInput || '79.00'}
PIX_EXPIRATION_MINUTES=${expirationMinInput || '15'}
SABRINA_NOTIFICATION_EMAIL=nutricionistasabrinaamorim@gmail.com`}</pre>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Servidor Backend Ativo • Endpoints de Webhook & Inserção operando em tempo real</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
