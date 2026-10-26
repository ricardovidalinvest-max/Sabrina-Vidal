import { dbRepository } from '../db/database';
import { calcomService } from '../services/calcom.service';
import { asaasService } from '../services/asaas.service';
import { zapiService } from '../services/zapi.service';

/**
 * Rotina de Limpeza de Abandonos de Carrinho (Cron Job)
 * 
 * Regra:
 * Executa a cada 1 minuto.
 * Busca no banco todos os agendamentos com status PENDING criados há mais de 15 minutos.
 * Para cada registro expirado:
 *   a) Chama a API do Cal.com para cancelar o agendamento (liberando o horário na agenda).
 *   b) Chama a API do Asaas para deletar/cancelar a cobrança PIX pendente.
 *   c) Atualiza o banco para status CANCELED.
 *   d) Chama a Z-API informando ao paciente que o tempo limite expirou.
 */
export class CleanupExpiredBookingsJob {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly EXPIRATION_MINUTES = 15;

  /**
   * Executa uma verificação manual ou via disparador do cron.
   */
  async runCleanupCycle(): Promise<{ scanned: number; canceled: number; details: string[] }> {
    if (this.isRunning) {
      console.log('[Cron:Cleanup] Ciclo anterior ainda em execução. Ignorando tick concorrente.');
      return { scanned: 0, canceled: 0, details: ['Ciclo concorrente em andamento'] };
    }

    this.isRunning = true;
    const details: string[] = [];

    try {
      console.log(`[Cron:Cleanup:TICK] Iniciando varredura de agendamentos PENDING > ${this.EXPIRATION_MINUTES} minutos...`);

      // 1. Busca no banco registros com status PENDING criados antes de (AGORA - 15 minutos)
      const expiredBookings = await dbRepository.findExpiredPendingBookings(this.EXPIRATION_MINUTES);

      console.log(`[Cron:Cleanup] Total de agendamentos pendentes expirados encontrados: ${expiredBookings.length}`);

      let canceledCount = 0;

      for (const booking of expiredBookings) {
        console.log(`[Cron:Cleanup:PROCESSING] Expirando agendamento ID: ${booking.id} (Cal.com: ${booking.calcom_booking_id})...`);

        // a) Cancela o agendamento no Cal.com liberando a vaga na agenda da Dra. Sabrina
        if (booking.calcom_booking_id) {
          await calcomService.cancelBooking(
            booking.calcom_booking_id,
            'Cancelado automaticamente por expiração do PIX após 15 minutos.'
          );
        }

        // b) Cancela a cobrança no Asaas (se houver asaas_payment_id)
        if (booking.asaas_payment_id) {
          await asaasService.deleteCharge(booking.asaas_payment_id);
        }

        // c) Atualiza o banco para status CANCELED
        await dbRepository.updateStatus(booking.id, 'CANCELED');

        // d) Envia WhatsApp na Z-API notificando que o horário foi liberado
        if (booking.customer_phone) {
          await zapiService.sendExpirationMessage({
            phone: booking.customer_phone,
            customerName: booking.customer_name,
          });
        }

        canceledCount++;
        const msg = `Agendamento ${booking.calcom_booking_id} de ${booking.customer_name} cancelado e liberado com sucesso.`;
        details.push(msg);
        console.log(`[Cron:Cleanup:DONE] ${msg}`);
      }

      return {
        scanned: expiredBookings.length,
        canceled: canceledCount,
        details,
      };
    } catch (error: any) {
      console.error('[Cron:Cleanup:ERROR] Falha durante o ciclo de limpeza:', error.message);
      return { scanned: 0, canceled: 0, details: [`Erro: ${error.message}`] };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Inicia o Cron Job para rodar a cada 1 minuto (60.000 ms).
   * Compatível tanto com node-cron ('* * * * *') quanto com agendador nativo de Node.js.
   */
  startCron(intervalMs: number = 60 * 1000): void {
    if (this.intervalTimer) {
      console.log('[Cron:Cleanup] Cron já está ativo.');
      return;
    }

    console.log(`[Cron:Cleanup] Iniciando rotina periódica de limpeza a cada ${intervalMs / 1000} segundos.`);
    
    // Roda o primeiro ciclo após 10 segundos para dar boot limpo no servidor
    setTimeout(() => {
      this.runCleanupCycle();
    }, 10000);

    // E então a cada 1 minuto
    this.intervalTimer = setInterval(() => {
      this.runCleanupCycle();
    }, intervalMs);
  }

  /**
   * Para a execução do cron.
   */
  stopCron(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('[Cron:Cleanup] Cron de limpeza finalizado.');
    }
  }
}

export const cleanupCronJob = new CleanupExpiredBookingsJob();
