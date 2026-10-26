export type BookingStatus = 'PENDING' | 'PAID' | 'CANCELED';

export interface AgendamentoRecord {
  id: string; // UUID
  calcom_booking_id: string; // String, Unique
  asaas_payment_id: string | null; // String, Unique, Nullable
  status: BookingStatus; // Enum: PENDING, PAID, CANCELED
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, unknown>;
}

export interface CalcomWebhookPayload {
  triggerEvent: 'BOOKING_CREATED' | 'BOOKING_RESCHEDULED' | 'BOOKING_CANCELLED';
  createdAt: string;
  payload: {
    id: number | string;
    uid?: string;
    title?: string;
    description?: string;
    startTime: string;
    endTime: string;
    status?: string;
    meetingUrl?: string;
    videoCallUrl?: string;
    metadata?: {
      videoCallUrl?: string;
      [key: string]: unknown;
    };
    responses?: {
      name?: { value: string };
      email?: { value: string };
      phone?: { value: string };
      [key: string]: unknown;
    };
    attendees?: Array<{
      name: string;
      email: string;
      timeZone?: string;
    }>;
    user?: {
      name: string;
      email: string;
    };
  };
}

export interface AsaasWebhookPayload {
  event: 'PAYMENT_RECEIVED' | 'PAYMENT_CONFIRMED' | 'PAYMENT_OVERDUE' | 'PAYMENT_DELETED';
  payment: {
    id: string;
    customer: string;
    value: number;
    netValue?: number;
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
    status: string;
    dateCreated: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    description?: string;
    externalReference?: string;
  };
}

export interface ZApiSendMessageResult {
  zaapId?: string;
  messageId?: string;
  id?: string;
  status?: string;
  success: boolean;
}
