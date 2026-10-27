import { Request, Response } from 'express';
import { dbRepository } from '../db/database';
import { bookingWorker } from '../queue/booking.worker';
import { CalcomWebhookPayload } from '../types/index';

/**
 * Controller do Webhook do Cal.com
 * Rota: POST /api/webhooks/calcom
 * 
 * PADRÃO: "Responda Rápido, Processe Depois"
 * 1. Valida se o evento é BOOKING_CREATED
 * 2. Salva rapidamente o registro no banco com status PENDING
 * 3. Enfileira o job assíncrono para criação do PIX no Asaas e envio do WhatsApp
 * 4. Responde imediatamente com HTTP 200 OK
 */
export const handleCalcomWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CalcomWebhookPayload;

    console.log(`[CalcomWebhook:RECEIVE] Evento recebido: ${body.triggerEvent || 'UNKNOWN'}`);

    // Filtra apenas o evento BOOKING_CREATED solicitado
    if (body.triggerEvent && body.triggerEvent !== 'BOOKING_CREATED') {
      console.log(`[CalcomWebhook:SKIP] Evento '${body.triggerEvent}' ignorado (esperado: BOOKING_CREATED).`);
      res.status(200).json({ received: true, ignored: true, reason: 'Evento diferente de BOOKING_CREATED' });
      return;
    }

    const bookingPayload = body.payload;
    if (!bookingPayload || (!bookingPayload.id && !bookingPayload.uid)) {
      console.warn('[CalcomWebhook:WARN] Payload inválido ou ID/UID do agendamento ausente.');
      res.status(400).json({ error: 'Payload do Cal.com incompleto. Falta payload.id ou payload.uid.' });
      return;
    }

    const calcomBookingId = String(bookingPayload.uid || bookingPayload.id);
    
    // Extrai dados do cliente (attendees ou responses)
    const attendee = bookingPayload.attendees?.[0] || (bookingPayload as any).attendee;
    const customerName = attendee?.name || bookingPayload.responses?.name?.value || 'Paciente Sem Nome';
    const customerEmail = attendee?.email || bookingPayload.responses?.email?.value || 'paciente@exemplo.com';
    const customerPhone = String(
      bookingPayload.responses?.phone?.value ||
      (bookingPayload.responses as any)?.whatsapp?.value ||
      '5511999999999'
    );
    const customerCpf = String(
      (bookingPayload.responses as any)?.cpf?.value ||
      (bookingPayload.responses as any)?.cpfCnpj?.value ||
      (bookingPayload.metadata as any)?.cpf ||
      ''
    );

    // 1. Salva rapidamente no banco com status PENDING
    const record = await dbRepository.createPendingBooking({
      calcomBookingId,
      customerName,
      customerEmail,
      customerPhone,
      metadata: {
        startTime: bookingPayload.startTime,
        endTime: bookingPayload.endTime,
        title: bookingPayload.title,
        videoCallUrl: bookingPayload.videoCallUrl || bookingPayload.metadata?.videoCallUrl,
        customerCpf: customerCpf || undefined,
      },
    });

    console.log(`[CalcomWebhook:FAST_SAVE] Agendamento salvo no banco com sucesso. ID: ${record.id} (Status: ${record.status})`);

    // 2. Enfileira para o worker assíncrono ("Processe Depois")
    const jobId = bookingWorker.enqueue('PROCESS_CALCOM_BOOKING', {
      bookingId: calcomBookingId,
      customerName,
      customerEmail,
      customerPhone,
      customerCpf,
      rawPayload: bookingPayload,
    });

    // 3. Responde HTTP 200 OK imediatamente
    res.status(200).json({
      success: true,
      message: 'Agendamento pré-reservado com sucesso. Cobrança PIX e WhatsApp em processamento.',
      bookingId: calcomBookingId,
      jobId,
      status: 'PENDING',
    });
  } catch (error: any) {
    console.error('[CalcomWebhook:FATAL_ERROR] Falha ao processar webhook do Cal.com:', error.message);
    // Mesmo em falha inesperada, tenta responder de forma estruturada
    res.status(500).json({
      error: 'Erro interno ao processar webhook do Cal.com',
      details: error.message,
    });
  }
};
