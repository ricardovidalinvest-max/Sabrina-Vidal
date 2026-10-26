import crypto from 'crypto';
import { AgendamentoRecord, BookingStatus } from '../types/index';

/**
 * Interface do Repositório de Agendamentos.
 * Permite trocar a implementação entre Prisma, Drizzle ou Pool Postgres diretamente.
 */
export interface IAgendamentosRepository {
  createPendingBooking(data: {
    calcomBookingId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgendamentoRecord>;

  findByCalcomId(calcomBookingId: string): Promise<AgendamentoRecord | null>;
  findByAsaasPaymentId(asaasPaymentId: string): Promise<AgendamentoRecord | null>;
  
  updateAsaasPaymentId(
    calcomBookingId: string,
    asaasPaymentId: string
  ): Promise<AgendamentoRecord | null>;

  updateStatus(
    idOrPaymentId: string,
    newStatus: BookingStatus
  ): Promise<AgendamentoRecord | null>;

  findExpiredPendingBookings(minutesThreshold: number): Promise<AgendamentoRecord[]>;
  getAll(): Promise<AgendamentoRecord[]>;
}

/**
 * Implementação em memória com alta consistência para execução imediata, testes
 * e ambiente Node.js. Inclui suporte a concorrência e idempotência.
 */
class InMemoryAgendamentosRepository implements IAgendamentosRepository {
  private records = new Map<string, AgendamentoRecord>();

  async createPendingBooking(data: {
    calcomBookingId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgendamentoRecord> {
    const existing = await this.findByCalcomId(data.calcomBookingId);
    if (existing) {
      return existing;
    }

    const newRecord: AgendamentoRecord = {
      id: crypto.randomUUID(),
      calcom_booking_id: data.calcomBookingId,
      asaas_payment_id: null,
      status: 'PENDING',
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      created_at: new Date(),
      updated_at: new Date(),
      metadata: data.metadata,
    };

    this.records.set(newRecord.id, newRecord);
    return newRecord;
  }

  async findByCalcomId(calcomBookingId: string): Promise<AgendamentoRecord | null> {
    for (const record of this.records.values()) {
      if (record.calcom_booking_id === calcomBookingId) {
        return { ...record };
      }
    }
    return null;
  }

  async findByAsaasPaymentId(asaasPaymentId: string): Promise<AgendamentoRecord | null> {
    if (!asaasPaymentId) return null;
    for (const record of this.records.values()) {
      if (record.asaas_payment_id === asaasPaymentId) {
        return { ...record };
      }
    }
    return null;
  }

  async updateAsaasPaymentId(
    calcomBookingId: string,
    asaasPaymentId: string
  ): Promise<AgendamentoRecord | null> {
    for (const record of this.records.values()) {
      if (record.calcom_booking_id === calcomBookingId) {
        record.asaas_payment_id = asaasPaymentId;
        record.updated_at = new Date();
        return { ...record };
      }
    }
    return null;
  }

  async updateStatus(
    idOrPaymentId: string,
    newStatus: BookingStatus
  ): Promise<AgendamentoRecord | null> {
    for (const record of this.records.values()) {
      if (record.id === idOrPaymentId || record.asaas_payment_id === idOrPaymentId || record.calcom_booking_id === idOrPaymentId) {
        record.status = newStatus;
        record.updated_at = new Date();
        return { ...record };
      }
    }
    return null;
  }

  async findExpiredPendingBookings(minutesThreshold: number = 15): Promise<AgendamentoRecord[]> {
    const cutoffTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
    const expired: AgendamentoRecord[] = [];

    for (const record of this.records.values()) {
      if (record.status === 'PENDING' && new Date(record.created_at) < cutoffTime) {
        expired.push({ ...record });
      }
    }

    return expired;
  }

  async getAll(): Promise<AgendamentoRecord[]> {
    return Array.from(this.records.values()).map(r => ({ ...r }));
  }
}

// Instância singleton do repositório
export const dbRepository: IAgendamentosRepository = new InMemoryAgendamentosRepository();
