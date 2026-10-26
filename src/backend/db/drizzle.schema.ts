import { pgTable, uuid, varchar, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Drizzle ORM Schema para a Tabela de Agendamentos
export const bookingStatusEnum = pgEnum('booking_status', ['PENDING', 'PAID', 'CANCELED']);

export const agendamentos = pgTable(
  'agendamentos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    calcomBookingId: varchar('calcom_booking_id', { length: 255 }).notNull().unique(),
    asaasPaymentId: varchar('asaas_payment_id', { length: 255 }).unique(),
    status: bookingStatusEnum('status').default('PENDING').notNull(),
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    customerEmail: varchar('customer_email', { length: 255 }).notNull(),
    customerPhone: varchar('customer_phone', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table: any) => ({
    statusCreatedIdx: index('idx_agendamentos_status_created').on(table.status, table.createdAt),
    asaasPaymentIdx: index('idx_agendamentos_asaas_payment').on(table.asaasPaymentId),
  })
);

export type AgendamentoSelect = typeof agendamentos.$inferSelect;
export type AgendamentoInsert = typeof agendamentos.$inferInsert;
