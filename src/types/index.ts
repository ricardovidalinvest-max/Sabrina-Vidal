export interface BookingFormData {
  fullName: string;
  cpf: string;
  whatsapp: string;
  email: string;
  age: string;
  weight: string;
  height: string;
  mainGoal: string;
  restrictions: string;
  selectedDate: string;
  selectedTime: string;
}

export type FunnelStep = 'calendar' | 'form' | 'pix' | 'success';

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface DayOption {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  dayNumber: string;
  monthName: string;
  slotsRemaining: number;
  timeSlots: string[];
}

export interface Testimonial {
  name: string;
  age: number;
  city: string;
  lostWeight: string;
  headline: string;
  story: string;
  timeframe: string;
  avatarUrl: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  category?: string;
}
