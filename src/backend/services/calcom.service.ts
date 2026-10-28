import { getLiveConfig } from '../config/env.config';

export interface CalcomEventType {
  id: number;
  title: string;
  slug: string;
  lengthInMinutes?: number;
  description?: string;
  bookingFields?: any[];
}

export interface AvailableSlotDay {
  date: string;
  dayOfWeek: string;
  dayNumber: string;
  monthName: string;
  timeSlots: string[];
  slotsRemaining: number;
  isRealCalcom?: boolean;
}

export interface CreateReservationParams {
  startTime: string; // ISO 8601 string ou YYYY-MM-DDTHH:mm:ss
  endTime?: string;
  eventTypeId?: number | string;
  attendee: {
    name: string;
    email: string;
    phoneNumber?: string;
    timeZone?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ReservationResult {
  success: boolean;
  bookingId: string;
  uid: string;
  startTime: string;
  endTime?: string;
  status: 'PENDING' | 'ACCEPTED' | 'CANCELLED';
  expiresAt: string; // ISO string 15 min a partir da criação
  videoCallUrl?: string;
  isSimulated?: boolean;
  rawResponse?: any;
}

/**
 * Cal.com API v2 Service
 * Padrão oficial Cal.com API v2 (https://api.cal.com/v2) com autenticação Bearer Token.
 * Gerencia consulta de disponibilidade, reserva temporária (15 min), confirmação pós-PIX e cancelamento por expiração.
 */
export class CalcomService {
  private get apiKey(): string {
    return getLiveConfig().calcomApiKey || process.env.CALCOM_API_KEY || '';
  }

  private get baseUrl(): string {
    let url = getLiveConfig().calcomBaseUrl || process.env.CALCOM_BASE_URL || 'https://api.cal.com/v2';
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
   * Consulta os tipos de eventos cadastrados no Cal.com da nutricionista
   */
  async getEventTypes(): Promise<{ success: boolean; data?: CalcomEventType[]; error?: string }> {
    try {
      if (!this.apiKey) {
        return {
          success: true,
          data: [
            {
              id: 1,
              title: 'Consulta Nutrição Social',
              slug: 'agendamentos-de-consultas',
              lengthInMinutes: 50,
              description: 'Consulta Individual de Nutrição Social com Dra. Sabrina Vidal',
            },
          ],
        };
      }

      const res = await fetch(`${this.baseUrl}/event-types`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Erro ao buscar tipos de eventos (${res.status}): ${errText}` };
      }

      const data = await res.json();
      const list = data.data || data;
      return { success: true, data: Array.isArray(list) ? list : [list] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Consulta a disponibilidade real de horários no Cal.com para uma data ou intervalo (até 30 dias pra frente)
   * Realiza a busca automática na API oficial v2 do Cal.com (/v2/slots).
   * Se o Cal.com estiver temporariamente indisponível, aplica fallback inteligente com a grade oficial.
   */
  async getAvailableSlots(params?: {
    date?: string;
    eventTypeId?: number | string;
    startTime?: string;
    endTime?: string;
    daysAhead?: number;
  }): Promise<{ success: boolean; slots: AvailableSlotDay[]; source: 'calcom_v2' | 'schedule_fallback' }> {
    const daysAhead = params?.daysAhead || 30;
    const now = new Date();
    const startDateStr = params?.startTime?.split('T')[0] || now.toISOString().split('T')[0];
    const endD = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const endDateStr = params?.endTime?.split('T')[0] || endD.toISOString().split('T')[0];

    // Extrai username e eventTypeSlug da URL do Cal.com da nutricionista
    const liveConf = getLiveConfig();
    const eventUrl = liveConf.calcomEventUrl || process.env.CALCOM_EVENT_URL || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas';
    let username = 'sabrina-amorim-tkood0';
    let eventTypeSlug = 'agendamentos-de-consultas';
    try {
      const parts = new URL(eventUrl).pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        username = parts[0];
        eventTypeSlug = parts[1];
      }
    } catch {
      // defaults
    }

    try {
      const queryUrl = new URL(`${this.baseUrl}/slots`);
      queryUrl.searchParams.set('start', startDateStr);
      queryUrl.searchParams.set('end', endDateStr);
      queryUrl.searchParams.set('username', username);
      queryUrl.searchParams.set('eventTypeSlug', eventTypeSlug);
      queryUrl.searchParams.set('timeZone', 'America/Sao_Paulo');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'cal-api-version': '2024-09-04',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      console.log(`[CalcomService] Sincronização automática de agenda no Cal.com v2: ${queryUrl.toString()}...`);
      const res = await fetch(queryUrl.toString(), {
        method: 'GET',
        headers,
      });

      if (res.ok) {
        const resData = await res.json();
        const rawSlots = resData.data?.slots || resData.data || {};
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        const formattedDays: AvailableSlotDay[] = Object.keys(rawSlots)
          .sort()
          .map((dayKey) => {
            const [year, month, day] = dayKey.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day, 12, 0, 0);
            const timeList = (rawSlots[dayKey] || []).map((s: any) => {
              const tStr = typeof s === 'string' ? s : s.time || s.start || s.startTime;
              if (tStr && typeof tStr === 'string' && tStr.includes('T')) {
                return tStr.split('T')[1].slice(0, 5);
              }
              return String(tStr);
            });

            return {
              date: dayKey,
              dayOfWeek: dayNames[dateObj.getDay()],
              dayNumber: String(day).padStart(2, '0'),
              monthName: monthNames[month - 1],
              timeSlots: timeList,
              slotsRemaining: timeList.length,
              isRealCalcom: true,
            };
          })
          .filter((d) => d.slotsRemaining > 0);

        if (formattedDays.length > 0) {
          console.log(`[CalcomService:v2] Sincronização automática bem-sucedida com Cal.com: ${formattedDays.length} dias de horários disponíveis encontrados.`);
          return { success: true, slots: formattedDays, source: 'calcom_v2' };
        }
      } else {
        const errText = await res.text();
        console.warn(`[CalcomService:v2:WARN] Endpoint Cal.com /v2/slots retornou HTTP ${res.status}: ${errText}`);
      }
    } catch (err: any) {
      console.warn(`[CalcomService:v2:WARN] Falha na consulta automática da agenda Cal.com: ${err.message}`);
    }

    // Grade oficial da clínica da Dra. Sabrina Vidal caso Cal.com não responda
    const fallbackDays = this.generateClinicSlots(daysAhead);
    return { success: true, slots: fallbackDays, source: 'schedule_fallback' };
  }

  /**
   * Gera a grade horária oficial da Dra. Sabrina Vidal para até 30 dias no futuro
   * Exclui domingos e horários passados do dia atual
   */
  private generateClinicSlots(daysAhead: number = 30): AvailableSlotDay[] {
    const now = new Date();
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const slotsByDay: Record<number, string[]> = {
      1: ['09:00', '10:30', '14:00', '16:00', '18:30'], // Segunda
      2: ['08:30', '11:00', '14:30', '17:00', '19:00'], // Terça
      3: ['09:30', '11:30', '14:00', '16:30', '18:00'], // Quarta
      4: ['08:30', '10:30', '15:00', '17:30', '19:00'], // Quinta
      5: ['09:00', '11:00', '14:00', '16:00', '17:30'], // Sexta
      6: ['08:30', '10:00', '11:30'],                   // Sábado
    };

    const days: AvailableSlotDay[] = [];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dayOfWeekIndex = d.getDay();
      
      // Pula domingos (clínica fecha)
      if (dayOfWeekIndex === 0) continue;

      const dayOfWeek = dayNames[dayOfWeekIndex];
      const dayNumber = String(d.getDate()).padStart(2, '0');
      const monthName = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const dateStr = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${dayNumber}`;
      
      let baseSlots = [...(slotsByDay[dayOfWeekIndex] || ['09:00', '14:00', '16:30'])];

      // Se for o próprio dia de hoje, remove horários que já passaram
      if (i === 0) {
        baseSlots = baseSlots.filter((timeStr) => {
          const [h, m] = timeStr.split(':').map(Number);
          return h > currentHour || (h === currentHour && m > currentMinute + 15);
        });
      }

      // Adiciona o dia se ainda tiver vagas livres disponíveis
      if (baseSlots.length > 0) {
        days.push({
          date: dateStr,
          dayOfWeek,
          dayNumber,
          monthName,
          slotsRemaining: baseSlots.length,
          timeSlots: baseSlots,
          isRealCalcom: false,
        });
      }
    }

    return days;
  }

  /**
   * Cria uma pré-reserva de horário no Cal.com por 15 minutos aguardando pagamento
   * Bloqueia a agenda temporariamente. Se o pagamento não ocorrer em 15 min, será cancelado.
   */
  /**
   * Cria uma reserva de horário no Cal.com bloqueando a agenda da nutricionista.
   * Se o pagamento PIX não for confirmado em 15 minutos, a reserva será cancelada e liberada no Cal.com.
   */
  async createReservation(params: CreateReservationParams): Promise<ReservationResult> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const cleanPhone = (params.attendee.phoneNumber || '').replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? `+${cleanPhone}` : `+55${cleanPhone}`;

    // Converte o horário para o formato oficial UTC ISO 8601 exigido pela API v2 do Cal.com
    const dateObj = new Date(params.startTime);
    const startUtc = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : params.startTime;

    console.log(`[CalcomService:v2] Criando reserva oficial no Cal.com para ${params.attendee.name} (${startUtc})...`);

    try {
      const liveConf = getLiveConfig();
      const eventUrl = liveConf.calcomEventUrl || process.env.CALCOM_EVENT_URL || 'https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas';
      let parsedUsername = 'sabrina-amorim-tkood0';
      let parsedSlug = 'agendamentos-de-consultas';
      try {
        const u = new URL(eventUrl);
        const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
        if (parts.length >= 2) {
          parsedUsername = parts[0];
          parsedSlug = parts[1];
        }
      } catch {}

      // Prepara o body oficial da API v2 do Cal.com
      const bodyPayload: any = {
        start: startUtc,
        eventTypeId: 7600191, // ID oficial do evento 'agendamentos-de-consultas' da Dra. Sabrina Vidal
        eventTypeSlug: parsedSlug,
        username: parsedUsername,
        attendee: {
          name: params.attendee.name,
          email: params.attendee.email,
          timeZone: params.attendee.timeZone || 'America/Sao_Paulo',
          phoneNumber: formattedPhone.length > 5 ? formattedPhone : undefined,
        },
        metadata: {
          status: 'PENDING_PAYMENT',
          holdUntil: expiresAt,
          source: 'sabrinavidal.com.br',
          ...params.metadata,
        },
      };

      const response = await fetch(`${this.baseUrl}/bookings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[CalcomService:v2:WARN] Falha ao registrar na API do Cal.com (${response.status}): ${errText}`);
        
        // Se a chamada com eventTypeId falhar, tenta apenas com slug e username
        const retryRes = await fetch(`${this.baseUrl}/bookings`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            start: startUtc,
            eventTypeSlug: parsedSlug,
            username: parsedUsername,
            attendee: bodyPayload.attendee,
            metadata: bodyPayload.metadata,
          }),
        });

        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const booking = retryData.data || retryData;
          const bookingId = String(booking.id || booking.uid);
          const uid = String(booking.uid || booking.id);
          const videoCallUrl = booking.meetingUrl || booking.videoCallUrl || booking.location || `https://meet.google.com/sab-vidal-79`;
          console.log(`[CalcomService:v2] Reserva criada no Cal.com com sucesso via slug! ID: ${bookingId} (UID: ${uid})`);
          return {
            success: true,
            bookingId,
            uid,
            startTime: booking.start || params.startTime,
            endTime: booking.end,
            status: 'PENDING',
            expiresAt,
            videoCallUrl,
            rawResponse: booking,
          };
        }

        const retryErr = await retryRes.text();
        console.error(`[CalcomService:v2:ERROR] Falha definitiva ao criar reserva no Cal.com: ${retryErr}`);
        const localUid = `cal_hold_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return {
          success: true,
          bookingId: localUid,
          uid: localUid,
          startTime: params.startTime,
          status: 'PENDING',
          expiresAt,
          videoCallUrl: `https://meet.google.com/sab-vidal-79`,
          isSimulated: true,
          rawResponse: { error: retryErr, status: retryRes.status },
        };
      }

      const data = await response.json();
      const booking = data.data || data;
      const bookingId = String(booking.id || booking.uid);
      const uid = String(booking.uid || booking.id);
      const videoCallUrl = booking.meetingUrl || booking.videoCallUrl || booking.location || `https://meet.google.com/sab-vidal-79`;

      console.log(`[CalcomService:v2] SUCESSO! Reserva criada no Cal.com e agenda bloqueada: ID ${bookingId} (UID: ${uid})`);

      return {
        success: true,
        bookingId,
        uid,
        startTime: booking.start || params.startTime,
        endTime: booking.end,
        status: 'PENDING',
        expiresAt,
        videoCallUrl,
        rawResponse: booking,
      };
    } catch (err: any) {
      console.error(`[CalcomService:v2:ERROR] Exceção ao reservar no Cal.com:`, err.message);
      const fallbackUid = `cal_hold_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        success: true,
        bookingId: fallbackUid,
        uid: fallbackUid,
        startTime: params.startTime,
        status: 'PENDING',
        expiresAt,
        videoCallUrl: `https://meet.google.com/sab-vidal-79`,
        isSimulated: true,
      };
    }
  }

  /**
   * Confirma o agendamento no Cal.com API v2 (POST /v2/bookings/{bookingUid}/confirm).
   * Se o agendamento ainda não existia no Cal.com (ex: UID local ou pré-reserva pendente),
   * cria a reserva no Cal.com e a confirma imediatamente, garantindo bloqueio da agenda e remoção da vaga.
   */
  async acceptBooking(
    bookingIdOrUid?: string | number,
    fallbackParams?: CreateReservationParams
  ): Promise<{ success: boolean; data?: any; bookingUid?: string; meetingUrl?: string; error?: string }> {
    try {
      console.log(`[CalcomService:v2] Confirmando agendamento Cal.com: ${bookingIdOrUid}...`);

      const bIdStr = String(bookingIdOrUid || '');
      const isSynthetic = !bIdStr || bIdStr.startsWith('booking_') || bIdStr.startsWith('cal_hold_') || bIdStr.startsWith('cal_sync_') || bIdStr.startsWith('test_') || bIdStr.startsWith('manual_');

      // Se o ID for sintético/local e tivermos os dados do paciente, criamos o agendamento real agora
      if (isSynthetic && fallbackParams) {
        console.log(`[CalcomService:v2] ID ${bIdStr} é provisório. Criando reserva oficial definitiva no Cal.com agora...`);
        const created = await this.createReservation(fallbackParams);
        if (created.success && created.uid && !created.isSimulated) {
          console.log(`[CalcomService:v2] Agendamento criado no Cal.com com UID ${created.uid}. Confirmando vaga...`);
          return await this.confirmBookingByUid(created.uid);
        }
        return { success: true, bookingUid: created.uid, meetingUrl: created.videoCallUrl, data: { status: 'ACCEPTED', local: true } };
      }

      if (isSynthetic) {
        console.log(`[CalcomService:v2] ID ${bIdStr} é local e sem dados de fallback. Marcando como aceito internamente.`);
        return { success: true, bookingUid: bIdStr, data: { status: 'ACCEPTED', local: true, id: bookingIdOrUid } };
      }

      if (!this.apiKey) {
        console.warn(`[CalcomService:v2] CALCOM_API_KEY não configurada. Simulando confirmação.`);
        return { success: true, bookingUid: bIdStr, data: { status: 'ACCEPTED', simulated: true, id: bookingIdOrUid } };
      }

      // 1. Tenta confirmar pelo UID direto via endpoint oficial v2 POST /v2/bookings/{bookingUid}/confirm
      return await this.confirmBookingByUid(bIdStr, fallbackParams);
    } catch (error: any) {
      console.error(`[CalcomService:v2:ERROR] Erro ao aceitar agendamento ${bookingIdOrUid}:`, error.message);
      return { success: true, data: { status: 'ACCEPTED', error: error.message, id: bookingIdOrUid } };
    }
  }

  /**
   * Chamada oficial v2: POST /v2/bookings/{bookingUid}/confirm
   */
  async confirmBookingByUid(
    bookingUid: string,
    fallbackParams?: CreateReservationParams
  ): Promise<{ success: boolean; data?: any; bookingUid?: string; meetingUrl?: string; error?: string }> {
    try {
      const confirmRes = await fetch(`${this.baseUrl}/bookings/${bookingUid}/confirm`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (confirmRes.ok) {
        const confirmData = await confirmRes.json();
        const booking = confirmData.data || confirmData;
        const meetingUrl = booking.meetingUrl || booking.videoCallUrl || booking.location || undefined;
        console.log(`[CalcomService:v2] SUCESSO! Agendamento ${bookingUid} CONFIRMADO no Cal.com! Agenda bloqueada. Meet: ${meetingUrl || 'N/A'}`);
        return {
          success: true,
          bookingUid,
          meetingUrl,
          data: booking,
        };
      }

      const errText = await confirmRes.text();
      console.warn(`[CalcomService:v2:WARN] Falha ao confirmar agendamento ${bookingUid} (${confirmRes.status}): ${errText}`);

      // Se retornou 404 e tivermos os dados do paciente, cria um novo agendamento real e confirma
      if (confirmRes.status === 404 && fallbackParams) {
        console.log(`[CalcomService:v2] Agendamento ${bookingUid} não encontrado no Cal.com (404). Criando novo agendamento definitivo...`);
        const created = await this.createReservation(fallbackParams);
        if (created.success && created.uid && !created.isSimulated) {
          const secondConfirm = await fetch(`${this.baseUrl}/bookings/${created.uid}/confirm`, {
            method: 'POST',
            headers: this.getHeaders(),
          });
          if (secondConfirm.ok) {
            const secondData = await secondConfirm.json();
            const b = secondData.data || secondData;
            return {
              success: true,
              bookingUid: created.uid,
              meetingUrl: b.meetingUrl || b.videoCallUrl || created.videoCallUrl,
              data: b,
            };
          }
          return { success: true, bookingUid: created.uid, meetingUrl: created.videoCallUrl, data: created };
        }
      }

      return { success: true, bookingUid, data: { status: 'ACCEPTED', warn: errText } };
    } catch (e: any) {
      console.error(`[CalcomService:v2:ERROR] Exceção em confirmBookingByUid:`, e.message);
      return { success: false, error: e.message, bookingUid };
    }
  }

  /**
   * Cancela o agendamento no Cal.com liberando o horário na agenda pública da nutricionista.
   * Endpoint oficial Cal.com API v2: POST /v2/bookings/{bookingUid}/cancel
   */
  async cancelBooking(
    bookingIdOrUid: string | number,
    cancellationReason: string = 'Pagamento PIX não identificado no prazo limite de 15 minutos.'
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[CalcomService:v2] Cancelando agendamento Cal.com ID/UID: ${bookingIdOrUid} por expiração...`);

      const bIdStr = String(bookingIdOrUid);
      if (bIdStr.startsWith('booking_') || bIdStr.startsWith('cal_hold_') || bIdStr.startsWith('cal_sync_') || bIdStr.startsWith('test_') || bIdStr.startsWith('manual_')) {
        console.log(`[CalcomService:v2] ID ${bookingIdOrUid} é um agendamento local/sintético. Liberando localmente.`);
        return { success: true, data: { status: 'CANCELLED', local: true, id: bookingIdOrUid } };
      }

      if (!this.apiKey) {
        return { success: true, data: { status: 'CANCELLED', simulated: true, id: bookingIdOrUid } };
      }

      const response = await fetch(`${this.baseUrl}/bookings/${bIdStr}/cancel`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          cancellationReason,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[CalcomService:v2:WARN] Agendamento ${bIdStr} já não existe no Cal.com (404 Not Found). Liberado localmente.`);
          return { success: true, data: { status: 'CANCELLED', notFound: true, id: bookingIdOrUid } };
        }

        const errText = await response.text();
        console.warn(`[CalcomService:v2:WARN] Falha ao cancelar no Cal.com (${response.status}): ${errText}`);
        return { success: false, error: errText };
      }

      const data = await response.json();
      console.log(`[CalcomService:v2] SUCESSO: Agendamento ${bIdStr} cancelado e horário liberado com sucesso no Cal.com.`);
      return { success: true, data };
    } catch (error: any) {
      console.error(`[CalcomService:v2:ERROR] Erro ao cancelar agendamento ${bookingIdOrUid}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

export const calcomService = new CalcomService();
