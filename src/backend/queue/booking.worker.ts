import { dbRepository } from '../db/database';
import { asaasService } from '../services/asaas.service';
import { calcomService } from '../services/calcom.service';
import { zapiService } from '../services/zapi.service';
import { CalcomWebhookPayload, AsaasWebhookPayload } from '../types/index';

export type JobType = 'PROCESS_CALCOM_BOOKING' | 'PROCESS_ASAAS_PAYMENT';

export interface BookingJob {
  id: string;
  type: JobType;
  payload: any;
  attempts: number;
  createdAt: Date;
}

/**
 * Worker / Fila Assíncrona Fail-Proof ("Responda rápido, processe depois")
 * Pode operar em memória diretamente em Node.js ou ser adaptado para BullMQ / Redis em clusters.
 */
class BookingAsyncWorker {
  private queue: BookingJob[] = [];
  private isProcessing = false;
  private readonly MAX_RETRIES = 3;

  /**
   * Adiciona um job na fila e dispara o processamento assíncrono em background sem bloquear a resposta HTTP.
   */
  enqueue(type: JobType, payload: any): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job: BookingJob = {
      id: jobId,
      type,
      payload,
      attempts: 0,
      createdAt: new Date(),
    };

    this.queue.push(job);
    console.log(`[AsyncWorker] Job enfileirado: ${jobId} (Tipo: ${type}). Fila atual: ${this.queue.length} jobs.`);

    // Agenda execução assíncrona na próxima iteração do Event Loop
    setImmediate(() => {
      this.processNext();
    });

    return jobId;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift();

    if (!job) {
      this.isProcessing = false;
      return;
    }

    try {
      job.attempts++;
      console.log(`[AsyncWorker:START] Processando Job ${job.id} (Tentativa ${job.attempts}/${this.MAX_RETRIES})...`);

      if (job.type === 'PROCESS_CALCOM_BOOKING') {
        await this.handleCalcomBookingJob(job.payload);
      } else if (job.type === 'PROCESS_ASAAS_PAYMENT') {
        await this.handleAsaasPaymentJob(job.payload);
      }

      console.log(`[AsyncWorker:SUCCESS] Job ${job.id} finalizado com êxito.`);
    } catch (error: any) {
      console.error(`[AsyncWorker:ERROR] Falha na execução do Job ${job.id}:`, error.message);

      if (job.attempts < this.MAX_RETRIES) {
        console.warn(`[AsyncWorker:RETRY] Reagendando job ${job.id} para nova tentativa em 5 segundos...`);
        setTimeout(() => {
          this.queue.push(job);
          this.processNext();
        }, 5000);
      } else {
        console.error(`[AsyncWorker:FATAL] Job ${job.id} esgotou todas as ${this.MAX_RETRIES} tentativas.`);
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  /**
   * Processador do Webhook Cal.com (Passo 2 do fluxo):
   * a) Chama Asaas para criar Customer e Cobrança PIX de 15 minutos
   * b) Atualiza o banco com o asaas_payment_id
   * c) Dispara Z-API WhatsApp com Copia e Cola + QR Code + alerta de 15 minutos
   */
  private async handleCalcomBookingJob(data: {
    bookingId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerCpf?: string;
    value?: number;
    rawPayload?: any;
  }): Promise<void> {
    const { bookingId, customerName, customerEmail, customerPhone, customerCpf } = data;
    const priceValue = data.value || Number(process.env.CONSULTATION_PRICE_BRL) || 79.0;

    console.log(`[Worker:Calcom] Processando agendamento ${bookingId} para ${customerName} (CPF: ${customerCpf || 'Padrão'})...`);

    // a) Criar/Localizar Customer no Asaas e criar Cobrança PIX
    const customerId = await asaasService.findOrCreateCustomer({
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      cpfCnpj: customerCpf || '04218873100',
    });

    const pixCharge = await asaasService.createPixCharge({
      customerId: customerId,
      value: priceValue,
      description: `Consulta Nutrição Social - Dra. Sabrina Vidal (Reserva #${bookingId})`,
      externalReference: bookingId,
      expiresInMinutes: 15,
    });

    // b) Atualiza o banco com o asaas_payment_id
    const updated = await dbRepository.updateAsaasPaymentId(bookingId, pixCharge.paymentId);
    console.log(`[Worker:Calcom] Banco atualizado com Asaas Payment ID: ${pixCharge.paymentId} (Status: ${updated?.status})`);

    // c) Dispara mensagem na Z-API WhatsApp com PIX Copia e Cola e link do QR Code
    const whatsappSent = await zapiService.sendPixMessage({
      phone: customerPhone,
      customerName: customerName,
      pixPayload: pixCharge.pixPayload,
      qrCodeUrl: pixCharge.qrCodeImage,
      minutesLeft: 15,
    });

    console.log(`[Worker:Calcom] Mensagem PIX enviada via WhatsApp: ${whatsappSent ? 'SUCESSO' : 'FALHA'}`);
  }

  /**
   * Processador do Webhook Asaas (Passo 3 do fluxo):
   * a) IDEMPOTÊNCIA: Checa se o pagamento já está como PAID no banco. Se sim, descarta!
   * b) Atualiza o banco para status PAID.
   * c) Chama Cal.com API alterando status de PENDING para ACCEPTED.
   * d) Chama Z-API enviando mensagem final de confirmação com link do Google Meet.
   */
  private async handleAsaasPaymentJob(payload: AsaasWebhookPayload): Promise<void> {
    const payment = payload.payment;
    const paymentId = payment.id;

    console.log(`[Worker:Asaas] Processando confirmação do pagamento Asaas: ${paymentId}...`);

    // a) VERIFICAÇÃO DE IDEMPOTÊNCIA RÍGIDA
    const existing = await dbRepository.findByAsaasPaymentId(paymentId);

    if (!existing) {
      console.warn(`[Worker:Asaas:WARN] Agendamento não localizado no banco para o payment_id ${paymentId}. Verificando externalReference...`);
      if (payment.externalReference) {
        const byCal = await dbRepository.findByCalcomId(payment.externalReference);
        if (byCal && byCal.status === 'PAID') {
          console.log(`[Worker:IDEMPOTENCY] Agendamento ${byCal.calcom_booking_id} já está como PAID. Operação ignorada com segurança.`);
          return;
        }
      }
    } else if (existing.status === 'PAID') {
      console.log(`[Worker:IDEMPOTENCY] Pagamento ${paymentId} já foi processado e está com status PAID. Descartando para evitar duplicações.`);
      return;
    }

    // b) Atualizar banco para PAID
    const updatedRecord = await dbRepository.updateStatus(paymentId, 'PAID');
    const calcomBookingId = updatedRecord?.calcom_booking_id || payment.externalReference;

    console.log(`[Worker:Asaas] Status atualizado para PAID no banco (Agendamento: ${calcomBookingId}).`);

    // c) Chamar API do Cal.com alterando o status de PENDING para ACCEPTED
    let meetingUrl = 'https://meet.google.com/social-sabrina';
    if (calcomBookingId) {
      const calRes = await calcomService.acceptBooking(calcomBookingId);
      if (calRes.data?.videoCallUrl || calRes.data?.meetingUrl) {
        meetingUrl = calRes.data.videoCallUrl || calRes.data.meetingUrl;
      }
    }

    // d) Chamar Z-API enviando mensagem de confirmação no WhatsApp com o link da reunião
    const targetPhone = updatedRecord?.customer_phone;
    const targetName = updatedRecord?.customer_name || 'Paciente';

    if (targetPhone) {
      await zapiService.sendConfirmationMessage({
        phone: targetPhone,
        customerName: targetName,
        meetingUrl: meetingUrl,
      });
      console.log(`[Worker:Asaas] WhatsApp de confirmação enviado para ${targetPhone}.`);
    } else {
      console.warn(`[Worker:Asaas:WARN] Telefone não encontrado para o pagamento ${paymentId}.`);
    }
  }
}

export const bookingWorker = new BookingAsyncWorker();
