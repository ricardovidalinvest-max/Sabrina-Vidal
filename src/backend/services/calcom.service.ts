import { getLiveConfig } from '../config/env.config';

/**
 * Cal.com API v2 Service
 * Migrado para Cal.com API v2 (https://api.cal.com/v2) com autenticação via Bearer Token.
 */
export class CalcomService {
  private get apiKey(): string {
    return getLiveConfig().calcomApiKey || process.env.CALCOM_API_KEY || '';
  }

  private get baseUrl(): string {
    let url = getLiveConfig().calcomBaseUrl || process.env.CALCOM_BASE_URL || 'https://api.cal.com/v2';
    // Garante que não use a versão legada v1 (HTTP 410)
    if (url.includes('/v1')) {
      url = url.replace('/v1', '/v2');
    }
    return url.replace(/\/$/, '');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  constructor() {}

  /**
   * Altera o status do agendamento de PENDING para ACCEPTED após confirmação de pagamento no Asaas.
   */
  async acceptBooking(bookingId: string | number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[CalcomService:v2] Confirmando agendamento Cal.com ID: ${bookingId}...`);

      if (!this.apiKey) {
        console.warn(`[CalcomService:v2] CALCOM_API_KEY não configurada. Simulando confirmação do agendamento.`);
        return { success: true, data: { status: 'ACCEPTED', simulated: true, id: bookingId } };
      }

      // Endpoint Cal.com v2 para confirmação de reserva
      const response = await fetch(`${this.baseUrl}/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          status: 'ACCEPTED',
        }),
      });

      if (!response.ok) {
        // Fallback para rota /confirm da v2
        const fallbackRes = await fetch(`${this.baseUrl}/bookings/${bookingId}/confirm`, {
          method: 'POST',
          headers: this.getHeaders(),
        });

        if (!fallbackRes.ok) {
          const errText = await response.text();
          throw new Error(`Falha na API Cal.com v2 (Status ${response.status}): ${errText}`);
        }

        const fallbackData = await fallbackRes.json();
        console.log(`[CalcomService:v2] Agendamento ${bookingId} confirmado com sucesso via fallback.`);
        return { success: true, data: fallbackData };
      }

      const data = await response.json();
      console.log(`[CalcomService:v2] Agendamento ${bookingId} aceito com sucesso.`);
      return { success: true, data };
    } catch (error: any) {
      console.error(`[CalcomService:v2:ERROR] Erro ao aceitar agendamento ${bookingId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancela o agendamento no Cal.com liberando o horário na agenda pública da nutricionista.
   */
  async cancelBooking(
    bookingId: string | number,
    cancellationReason: string = 'Pagamento PIX não identificado no prazo limite de 15 minutos.'
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[CalcomService:v2] Cancelando agendamento Cal.com ID: ${bookingId} por expiração...`);

      if (!this.apiKey) {
        console.warn(`[CalcomService:v2] CALCOM_API_KEY não configurada. Simulando cancelamento.`);
        return { success: true, data: { status: 'CANCELLED', simulated: true, id: bookingId } };
      }

      const response = await fetch(`${this.baseUrl}/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          cancellationReason,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Falha ao cancelar na API Cal.com v2 (Status ${response.status}): ${errText}`);
      }

      const data = await response.json();
      console.log(`[CalcomService:v2] Agendamento ${bookingId} cancelado e horário liberado com sucesso.`);
      return { success: true, data };
    } catch (error: any) {
      console.error(`[CalcomService:v2:ERROR] Erro ao cancelar agendamento ${bookingId}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

export const calcomService = new CalcomService();
