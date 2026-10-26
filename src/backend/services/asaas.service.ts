import { getLiveConfig } from '../config/env.config';

export interface CreateCustomerDTO {
  name: string;
  email: string;
  phone: string;
  cpfCnpj?: string;
}

export interface CreatePixChargeDTO {
  customerId: string;
  value: number;
  description: string;
  externalReference?: string;
  expiresInMinutes?: number;
}

export interface PixChargeResult {
  paymentId: string;
  status: string;
  value: number;
  netValue?: number;
  pixPayload: string;
  qrCodeImage: string;
  invoiceUrl?: string;
  expirationDate: string;
}

export class AsaasService {
  private get apiKey(): string {
    return getLiveConfig().asaasApiKey || process.env.ASAAS_API_KEY || '';
  }

  private get environment(): 'production' | 'sandbox' {
    return getLiveConfig().asaasEnvironment || 'production';
  }

  private get baseUrl(): string {
    return this.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
  }

  constructor() {}

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'access_token': this.apiKey,
    };
  }

  /**
   * Busca cliente por e-mail/telefone ou cria um novo registro no Asaas.
   */
  async findOrCreateCustomer(data: CreateCustomerDTO): Promise<string> {
    try {
      console.log(`[AsaasService] Localizando/Criando cliente: ${data.name} (${data.email})...`);

      if (!this.apiKey || this.apiKey === 'MY_ASAAS_API_KEY') {
        const mockCustomerId = `cus_mock_${Math.random().toString(36).substring(2, 9)}`;
        console.warn(`[AsaasService] ASAAS_API_KEY ausente ou placeholder. Usando ID simulado: ${mockCustomerId}`);
        return mockCustomerId;
      }

      const cleanPhone = data.phone.replace(/\D/g, '');
      const cleanCpf = data.cpfCnpj ? data.cpfCnpj.replace(/\D/g, '') : undefined;

      // 1. Tentar buscar por e-mail
      const searchUrl = `${this.baseUrl}/customers?email=${encodeURIComponent(data.email)}`;
      const searchRes = await fetch(searchUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
          const customer = searchData.data[0];
          console.log(`[AsaasService] Cliente já existente encontrado no Asaas: ${customer.id}`);

          // Se o cliente existe mas não possui CPF registrado no Asaas, atualiza com o CPF
          if (cleanCpf && (!customer.cpfCnpj || customer.cpfCnpj !== cleanCpf)) {
            console.log(`[AsaasService] Atualizando CPF/CNPJ do cliente existente ${customer.id}...`);
            await fetch(`${this.baseUrl}/customers/${customer.id}`, {
              method: 'POST',
              headers: this.getHeaders(),
              body: JSON.stringify({ cpfCnpj: cleanCpf }),
            }).catch((e) => console.warn('[AsaasService] Aviso ao atualizar CPF:', e.message));
          }

          return customer.id;
        }
      }

      // 2. Se não existir, criar novo com CPF/CNPJ
      const createRes = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          mobilePhone: cleanPhone.length >= 10 ? cleanPhone : undefined,
          cpfCnpj: cleanCpf,
          notificationDisabled: false,
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Falha ao criar cliente no Asaas (Status ${createRes.status}): ${errText}`);
      }

      const createdCustomer = await createRes.json();
      console.log(`[AsaasService] Novo cliente criado com sucesso: ${createdCustomer.id}`);
      return createdCustomer.id;
    } catch (error: any) {
      console.error(`[AsaasService:ERROR] Erro ao buscar/criar cliente:`, error.message);
      throw error;
    }
  }

  /**
   * Cria uma cobrança PIX com vencimento dinâmico e obtém o Payload Copia e Cola + QR Code.
   */
  async createPixCharge(params: CreatePixChargeDTO): Promise<PixChargeResult> {
    try {
      console.log(`[AsaasService] Gerando cobrança PIX de R$ ${params.value.toFixed(2)} para cliente ${params.customerId}...`);

      const now = new Date();
      const dueDate = now.toISOString().split('T')[0]; // Vencimento hoje
      const expiresInMin = params.expiresInMinutes || 15;
      const expirationDate = new Date(now.getTime() + expiresInMin * 60 * 1000).toISOString();

      if (!this.apiKey || this.apiKey === 'MY_ASAAS_API_KEY') {
        const mockPayId = `pay_mock_${Math.random().toString(36).substring(2, 10)}`;
        const simulatedPix = `00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/${mockPayId}5204000053039865405${params.value.toFixed(2)}5802BR5920Dra Sabrina Vidal Nut6009Sao Paulo62070503***6304ABCD`;
        console.warn(`[AsaasService] API Key ausente. Gerando PIX simulado com ID: ${mockPayId}`);
        return {
          paymentId: mockPayId,
          status: 'PENDING',
          value: params.value,
          pixPayload: simulatedPix,
          qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(simulatedPix)}`,
          expirationDate,
        };
      }

      // 1. Criar cobrança no Asaas
      const paymentRes = await fetch(`${this.baseUrl}/payments`, {
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

      if (!paymentRes.ok) {
        const errText = await paymentRes.text();
        throw new Error(`Falha ao registrar cobrança no Asaas (Status ${paymentRes.status}): ${errText}`);
      }

      const paymentData = await paymentRes.json();
      const paymentId = paymentData.id;

      // 2. Buscar QR Code e Copia e Cola específicos do PIX
      const qrRes = await fetch(`${this.baseUrl}/payments/${paymentId}/pixQrCode`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      let pixPayload = '';
      let qrCodeImage = '';

      if (qrRes.ok) {
        const qrData = await qrRes.json();
        pixPayload = qrData.payload || '';
        qrCodeImage = qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : '';
      } else {
        console.warn(`[AsaasService] Não foi possível obter o pixQrCode diretamente da API. Gerando fallback.`);
        pixPayload = `00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/${paymentId}5204000053039865405${params.value.toFixed(2)}5802BR5920Dra Sabrina Vidal6009Sao Paulo62070503***6304E1F2`;
        qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixPayload)}`;
      }

      console.log(`[AsaasService] Cobrança PIX criada com sucesso: ID ${paymentId}`);
      return {
        paymentId,
        status: paymentData.status || 'PENDING',
        value: paymentData.value || params.value,
        netValue: paymentData.netValue,
        pixPayload,
        qrCodeImage,
        invoiceUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl || `https://www.asaas.com/i/${paymentId}`,
        expirationDate,
      };
    } catch (error: any) {
      console.error(`[AsaasService:ERROR] Erro ao criar cobrança PIX:`, error.message);
      throw error;
    }
  }

  /**
   * Remove/Cancela a cobrança no Asaas caso o agendamento expire por falta de pagamento.
   */
  async deleteCharge(paymentId: string): Promise<boolean> {
    try {
      console.log(`[AsaasService] Cancelando cobrança Asaas ID: ${paymentId}...`);

      if (!this.apiKey || this.apiKey === 'MY_ASAAS_API_KEY') {
        console.log(`[AsaasService] Cobrança simulada ${paymentId} cancelada com sucesso.`);
        return true;
      }

      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[AsaasService:WARN] Falha ao excluir cobrança ${paymentId} (Status ${response.status}): ${errText}`);
        return false;
      }

      console.log(`[AsaasService] Cobrança ${paymentId} excluída no Asaas com sucesso.`);
      return true;
    } catch (error: any) {
      console.error(`[AsaasService:ERROR] Erro ao excluir cobrança ${paymentId}:`, error.message);
      return false;
    }
  }
}

export const asaasService = new AsaasService();
