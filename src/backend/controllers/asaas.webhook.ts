import { Request, Response } from 'express';
import { bookingWorker } from '../queue/booking.worker';
import { AsaasWebhookPayload } from '../types/index';

/**
 * Controller do Webhook do Asaas
 * Rota: POST /api/webhooks/asaas
 * 
 * PADRÃO: "Responda Rápido, Processe Depois"
 * 1. Valida se o evento é PAYMENT_RECEIVED (ou PAYMENT_CONFIRMED)
 * 2. Retorna 200 OK imediatamente para o Asaas (evitando timeouts ou reenvios desnecessários)
 * 3. Enfileira o job para verificação de idempotência e pós-processamento assíncrono
 */
export const handleAsaasWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AsaasWebhookPayload;

    console.log(`[AsaasWebhook:RECEIVE] Evento recebido: ${body?.event || 'UNKNOWN'}`);

    // Filtra gatilho solicitado: PAYMENT_RECEIVED (com tolerância amigável a PAYMENT_CONFIRMED)
    if (body.event !== 'PAYMENT_RECEIVED' && body.event !== 'PAYMENT_CONFIRMED') {
      console.log(`[AsaasWebhook:SKIP] Evento '${body.event}' ignorado. Aguardando PAYMENT_RECEIVED.`);
      res.status(200).json({ received: true, ignored: true, event: body.event });
      return;
    }

    if (!body.payment || !body.payment.id) {
      console.warn('[AsaasWebhook:WARN] Objeto payment ausente no payload.');
      res.status(400).json({ error: 'Payload do Asaas incompleto. Falta objeto payment.id.' });
      return;
    }

    const paymentId = body.payment.id;
    console.log(`[AsaasWebhook:FAST_RESPONSE] Pagamento ${paymentId} confirmado. Respondendo 200 OK e enfileirando worker...`);

    // 1. Enfileira para o worker assíncrono (que cuidará da checagem de idempotência, Cal.com e Z-API)
    const jobId = bookingWorker.enqueue('PROCESS_ASAAS_PAYMENT', body);

    // 2. Retorna 200 OK IMEDIATAMENTE conforme o padrão solicitado
    res.status(200).json({
      success: true,
      message: 'Notificação de pagamento Asaas recebida com sucesso. Processamento assíncrono iniciado.',
      paymentId,
      jobId,
    });
  } catch (error: any) {
    console.error('[AsaasWebhook:FATAL_ERROR] Falha no endpoint do webhook Asaas:', error.message);
    res.status(500).json({
      error: 'Erro interno ao processar webhook do Asaas',
      details: error.message,
    });
  }
};
