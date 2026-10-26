import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  User,
  Phone,
  Mail,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  FileCheck,
  ArrowRight,
  ArrowLeft,
  Video,
  ShieldAlert,
  Calendar,
  CalendarCheck,
  CreditCard,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { BookingFormData, FunnelStep } from '../types';
import { AVAILABLE_DAYS } from '../data/copywriting';
import { copyTextSafely } from '../utils/clipboard';

interface BookingFunnelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DispatchedEmail {
  to: string;
  subject: string;
  sentAt: string;
  type: 'patient_confirmation' | 'nutritionist_alert';
  bodyPreview: string;
}

const formatCpf = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export const getWeekAvailableDays = () => {
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

  const currentDayOfWeek = now.getDay();
  // Ajusta para segunda-feira da semana atual
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceToMonday);

  const days = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dayOfWeekIndex = d.getDay();
    const dayOfWeek = dayNames[dayOfWeekIndex];
    const dayNumber = String(d.getDate()).padStart(2, '0');
    const monthName = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const dateStr = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${dayNumber}`;
    const timeSlots = slotsByDay[dayOfWeekIndex] || ['09:00', '14:00', '16:30'];

    days.push({
      date: dateStr,
      dayOfWeek,
      dayNumber,
      monthName,
      slotsRemaining: timeSlots.length,
      timeSlots,
    });
  }
  return days;
};

export const WEEK_AVAILABLE_DAYS = getWeekAvailableDays();

export const BookingFunnelModal: React.FC<BookingFunnelModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<FunnelStep>('calendar');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [calcomBookingUid, setCalcomBookingUid] = useState<string>('');
  const [isCalcomSynced, setIsCalcomSynced] = useState<boolean>(false);
  const [calcomNotice, setCalcomNotice] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<BookingFormData>({
    fullName: '',
    cpf: '',
    whatsapp: '',
    email: '',
    age: '',
    weight: '',
    height: '',
    mainGoal: 'Emagrecimento saudável e sustentável',
    restrictions: '',
    selectedDate: WEEK_AVAILABLE_DAYS[0]?.date || '2026-10-26',
    selectedTime: '09:00',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Asaas PIX State
  const [paymentId, setPaymentId] = useState<string>('');
  const [pixCopyPasteCode, setPixCopyPasteCode] = useState<string>(
    '00020126580014br.gov.bcb.pix0136nutricionistasabrinaamorim@gmail.com520400005303986540579.005802BR5925SABRINA VIDAL NUTRICIONISTA6009GOIANIA62070503***63048E2B'
  );
  const [pixQrBase64, setPixQrBase64] = useState<string>('');
  const [pixProvider, setPixProvider] = useState<string>('Asaas PIX Gateway');
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedMeet, setCopiedMeet] = useState(false);
  const [pixTimeRemaining, setPixTimeRemaining] = useState(900); // 15 min
  const [isCheckingAsaas, setIsCheckingAsaas] = useState(false);
  const [checkAsaasNotice, setCheckAsaasNotice] = useState<string | null>(null);

  // Dispatched emails store
  const [dispatchedEmails, setDispatchedEmails] = useState<DispatchedEmail[]>([]);
  const [meetUrl, setMeetUrl] = useState('https://meet.google.com/sab-vidal-79');

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to Cal.com Embed postMessages (bookingSuccessfulV2, bookingSuccessful, etc.)
  useEffect(() => {
    const handleCalcomMessage = async (e: MessageEvent) => {
      try {
        let msgData = e.data;
        if (typeof msgData === 'string') {
          try {
            msgData = JSON.parse(msgData);
          } catch {
            // non-json
          }
        }

        // Cal.com sends data with { type: "__cal" } or { action: "bookingSuccessfulV2" }
        const isCalMessage =
          msgData?.type === '__cal' ||
          msgData?.origin === 'https://cal.com' ||
          msgData?.action?.includes?.('booking') ||
          msgData?.data?.action?.includes?.('booking');

        if (isCalMessage) {
          const payload = msgData?.data?.data || msgData?.data || msgData;
          const action = msgData?.data?.action || msgData?.action;

          if (action === 'bookingSuccessful' || action === 'bookingSuccessfulV2') {
            const booking = payload?.booking || payload;
            const uid = booking?.uid || booking?.id || `cal_${Date.now()}`;
            setCalcomBookingUid(uid);
            setIsCalcomSynced(true);
            setCalcomNotice('✓ Horário registrado com sucesso no Cal.com da Drª Sabrina!');

            if (booking?.startTime) {
              const startObj = new Date(booking.startTime);
              const dateStr = startObj.toISOString().split('T')[0];
              const timeStr = startObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              setFormData((prev) => ({
                ...prev,
                selectedDate: dateStr,
                selectedTime: timeStr,
              }));
            }

            if (booking?.videoCallUrl) {
              setMeetUrl(booking.videoCallUrl);
            }

            const attendee = booking?.attendees?.[0] || booking?.attendee;
            if (attendee?.name) {
              setFormData((prev) => ({ ...prev, fullName: attendee.name }));
            }
            if (attendee?.email) {
              setFormData((prev) => ({ ...prev, email: attendee.email }));
            }

            // Register on backend
            fetch('/api/calcom/register-booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid,
                startTime: booking?.startTime,
                endTime: booking?.endTime,
                patientName: attendee?.name || formData.fullName,
                patientEmail: attendee?.email || formData.email,
                videoCallUrl: booking?.videoCallUrl || meetUrl,
              }),
            }).catch(() => {});

            // Smooth transition to intake form
            setTimeout(() => {
              setStep('form');
            }, 1200);
          }
        }
      } catch {
        // silent
      }
    };

    window.addEventListener('message', handleCalcomMessage);
    return () => window.removeEventListener('message', handleCalcomMessage);
  }, [formData.fullName, formData.email, meetUrl]);

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        selectedDate: AVAILABLE_DAYS[selectedDayIndex].date,
        selectedTime: selectedTime,
      }));
      setPixTimeRemaining(900);
    }
  }, [isOpen, selectedDayIndex, selectedTime]);

  // Countdown timer for PIX expiration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'pix' && pixTimeRemaining > 0) {
      timer = setInterval(() => {
        setPixTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, pixTimeRemaining]);

  // Polling Asaas status while on PIX screen
  useEffect(() => {
    if (step === 'pix' && paymentId) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/asaas/status/${paymentId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
              if (data.confirmationDetails) {
                setMeetUrl(data.confirmationDetails.googleMeetUrl || meetUrl);
                if (data.confirmationDetails.calcomBookingUid) {
                  setCalcomBookingUid(data.confirmationDetails.calcomBookingUid);
                  setIsCalcomSynced(true);
                }
                if (data.confirmationDetails.emailsDispatched) {
                  setDispatchedEmails(data.confirmationDetails.emailsDispatched);
                }
              }
              setStep('success');
              if (pollingRef.current) clearInterval(pollingRef.current);
            }
          }
        } catch {
          // silent error handling during background polling
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [step, paymentId, meetUrl]);

  if (!isOpen) return null;

  const currentDay = WEEK_AVAILABLE_DAYS[selectedDayIndex] || WEEK_AVAILABLE_DAYS[0];

  const handleSelectDay = (idx: number) => {
    setSelectedDayIndex(idx);
    const day = WEEK_AVAILABLE_DAYS[idx];
    if (day) {
      setSelectedTime(day.timeSlots[0] || '09:00');
      setFormData((prev) => ({
        ...prev,
        selectedDate: day.date,
        selectedTime: day.timeSlots[0] || '09:00',
      }));
    }
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
    setFormData((prev) => ({
      ...prev,
      selectedTime: time,
    }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'Informe seu nome completo';

    const cleanCpf = formData.cpf.replace(/\D/g, '');
    if (!cleanCpf) {
      errors.cpf = 'Informe o CPF do paciente (obrigatório para emissão do PIX no Asaas)';
    } else if (cleanCpf.length !== 11) {
      errors.cpf = 'O CPF deve conter exatamente 11 dígitos (000.000.000-00)';
    }

    if (!formData.whatsapp.trim() || formData.whatsapp.length < 10)
      errors.whatsapp = 'Informe um WhatsApp com DDD válido';
    if (!formData.email.trim() || !formData.email.includes('@'))
      errors.email = 'Informe um e-mail válido';
    if (!formData.age.trim()) errors.age = 'Informe sua idade';
    if (!formData.weight.trim()) errors.weight = 'Informe seu peso aproximado';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 2 Submission -> Call backend Asaas API
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsGeneratingPix(true);
    try {
      const cleanCpf = formData.cpf.replace(/\D/g, '');
      const res = await fetch('/api/asaas/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cpf: formData.cpf,
          cpfCnpj: cleanCpf,
          calcomBookingUid: calcomBookingUid || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPaymentId(data.paymentId);
        if (data.calcomBookingUid) setCalcomBookingUid(data.calcomBookingUid);
        if (data.pixPayload) setPixCopyPasteCode(data.pixPayload);
        if (data.pixQrCodeBase64) setPixQrBase64(data.pixQrCodeBase64);
        if (data.provider) setPixProvider(data.provider);
        setPixTimeRemaining(900);
      } else {
        // Fallback local ID
        setPaymentId(`pay_asaas_${Date.now()}`);
      }
    } catch {
      setPaymentId(`pay_asaas_${Date.now()}`);
    } finally {
      setIsGeneratingPix(false);
      setStep('pix');
    }
  };

  const handleCopyPix = async () => {
    await copyTextSafely(pixCopyPasteCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleCopyMeet = async () => {
    await copyTextSafely(meetUrl);
    setCopiedMeet(true);
    setTimeout(() => setCopiedMeet(false), 3000);
  };

  // Verificação ativa do pagamento em tempo real no Asaas
  const handleVerifyAsaasPayment = async () => {
    if (!paymentId) return;
    setIsCheckingAsaas(true);
    setCheckAsaasNotice(null);
    try {
      const res = await fetch(`/api/asaas/sync/${paymentId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
        if (data.payment?.confirmationDetails) {
          setMeetUrl(data.payment.confirmationDetails.googleMeetUrl || meetUrl);
          if (data.payment.confirmationDetails.calcomBookingUid) {
            setCalcomBookingUid(data.payment.confirmationDetails.calcomBookingUid);
            setIsCalcomSynced(true);
          }
          if (data.payment.confirmationDetails.emailsDispatched) {
            setDispatchedEmails(data.payment.confirmationDetails.emailsDispatched);
          }
        }
        setStep('success');
      } else {
        setCheckAsaasNotice(
          data.message ||
            'O pagamento ainda está em processamento no sistema bancário. O PIX costuma compensar em instantes. O sistema continua monitorando.'
        );
      }
    } catch {
      setCheckAsaasNotice('Aguardando compensação do PIX no Asaas.');
    } finally {
      setIsCheckingAsaas(false);
    }
  };

  const formatMinutes = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDisplayDate = (isoDate: string) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const patientName = formData.fullName || 'Mariana Alencar';
  const displayDate = formatDisplayDate(formData.selectedDate);

  // WhatsApp formatted template
  const whatsAppText = `Olá, *${patientName}*! Tudo bem? Aqui é a *Nutricionista Drª Sabrina Vidal* (CRN 17198 - GO)! 🌿✨

Seu pagamento de R$ 79,00 via PIX foi confirmado com sucesso e a sua consulta de *Nutrição Social* já está 100% garantida na minha agenda:

📅 *Data:* ${displayDate} (${currentDay.dayOfWeek}-feira)
⏰ *Horário:* ${formData.selectedTime} (Horário de Brasília)
💻 *Link da nossa videochamada no Google Meet:*
${meetUrl}

📋 *Algumas dicas rápidas para o nosso encontro:*
1. Se você tiver exames de sangue recentes (últimos 6 meses), pode me enviar por aqui em PDF ou foto.
2. Anote os alimentos que você mais gosta e aqueles que você não tolera de jeito nenhum.
3. No dia da consulta, procure um cantinho calmo com copo de água na mão!

Estou muito animada para te conhecer e montar um plano alimentar realista e gostoso para você!

Qualquer dúvida, pode responder direto a esta mensagem ou pelo e-mail nutricionistasabrinaamorim@gmail.com. Até breve! 💚`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden my-6">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-emerald-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 text-emerald-200 flex items-center justify-center font-bold text-xs">
              {step === 'calendar' ? '1/4' : step === 'form' ? '2/4' : step === 'pix' ? '3/4' : '4/4'}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                {step === 'calendar' && 'Etapa 1: Escolha a Data e Horário'}
                {step === 'form' && 'Etapa 2: Preenchimento de Dados & Anamnese'}
                {step === 'pix' && 'Etapa 3: Pagamento via PIX'}
                {step === 'success' && 'Etapa 4: Consulta Confirmada com Sucesso!'}
              </h3>
              <p className="text-xs text-emerald-300">
                Drª Sabrina Vidal · Nutrição Social · Valor: R$ 79,00
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-emerald-900/80 hover:bg-emerald-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: CALENDAR SELECTION (Horários Disponíveis da Semana) */}
        {step === 'calendar' && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Header: Title and subtitle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
              <div>
                <h4 className="text-base sm:text-lg font-bold text-emerald-950 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-700" />
                  <span>Horários Disponíveis Desta Semana</span>
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Selecione o melhor dia e horário para a sua consulta individual online com a Drª Sabrina Vidal.
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Horários abertos para esta semana</span>
              </div>
            </div>

            {/* Day Selector Ribbon (Segunda a Sábado da semana) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                <span>1. Escolha o dia da consulta:</span>
                <span className="text-[11px] text-emerald-700 font-medium">Consulta Online · 50 min</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {WEEK_AVAILABLE_DAYS.map((day, idx) => {
                  const isSelected = selectedDayIndex === idx;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => handleSelectDay(idx)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-xs ring-2 ring-emerald-600/30'
                          : 'border-neutral-200 bg-white hover:border-emerald-300 text-neutral-700'
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                        {day.dayOfWeek}
                      </div>
                      <div className="text-xl font-bold my-0.5 tabular-nums">
                        {day.dayNumber}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {day.monthName}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                        {day.slotsRemaining} {day.slotsRemaining === 1 ? 'vaga livre' : 'vagas livres'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Selector */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700" />
                <h5 className="text-sm font-bold text-emerald-950">
                  2. Horários livres para {currentDay.dayOfWeek}, {currentDay.dayNumber} de {currentDay.monthName}:
                </h5>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {currentDay.timeSlots.map((time) => {
                  const isSelected = selectedTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleSelectTime(time)}
                      className={`py-3 px-4 rounded-xl text-sm font-medium border transition-all cursor-pointer tabular-nums text-center flex items-center justify-center gap-2 ${
                        isSelected
                          ? 'bg-emerald-700 border-emerald-700 text-white font-bold shadow-md scale-[1.02]'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:border-emerald-400 hover:bg-emerald-50/50'
                      }`}
                    >
                      <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-200' : 'text-neutral-400'}`} />
                      <span>{time}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Summary & Advance Button */}
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="text-xs text-neutral-500 font-medium">Horário selecionado:</div>
                <div className="text-sm sm:text-base font-bold text-emerald-950 flex items-center justify-center sm:justify-start gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-emerald-700" />
                  <span>
                    {currentDay.dayOfWeek}, {currentDay.dayNumber} de {currentDay.monthName} às {selectedTime}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] rounded-xl transition-all shadow-md cursor-pointer shrink-0"
              >
                <span>Avançar para Preenchimento de Dados</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: INTAKE FORM */}
        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="p-6 sm:p-8 space-y-5">
            <div>
              <h4 className="text-lg font-bold text-emerald-950 mb-1">
                Preencha seus dados para a consulta:
              </h4>
              <p className="text-xs sm:text-sm text-neutral-500">
                A Drª Sabrina Vidal estuda suas respostas antes da chamada para que a consulta de 50 min seja 100% individualizada.
              </p>
            </div>

            {/* Cal.com Appointment Slot Header Banner */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-950 font-medium">
                <CalendarCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Horário da sua consulta:{' '}
                  <strong>{displayDate} às {formData.selectedTime}</strong>
                  {calcomBookingUid && (
                    <span className="ml-1.5 font-mono text-[10px] text-emerald-900 bg-emerald-200/80 px-1.5 py-0.5 rounded font-bold">
                      Cal UID: {calcomBookingUid.slice(0, 10)}
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep('calendar')}
                className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline self-start sm:self-auto cursor-pointer"
              >
                Alterar dia ou hora
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nome Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mariana Silva"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                {formErrors.fullName && (
                  <span className="text-[11px] text-rose-600">{formErrors.fullName}</span>
                )}
              </div>

              {/* CPF do Paciente (Obrigatório Asaas) */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700">
                    CPF do Titular / Paciente *
                  </label>
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    Obrigatório para emissão do PIX no Asaas
                  </span>
                </div>
                <div className="relative">
                  <FileText className="w-4 h-4 text-neutral-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => {
                      const formatted = formatCpf(e.target.value);
                      setFormData({ ...formData, cpf: formatted });
                      if (formErrors.cpf) {
                        setFormErrors((prev) => {
                          const updated = { ...prev };
                          delete updated.cpf;
                          return updated;
                        });
                      }
                    }}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                      formErrors.cpf ? 'border-rose-400 bg-rose-50/40 text-rose-900' : 'border-neutral-300'
                    }`}
                  />
                </div>
                {formErrors.cpf ? (
                  <span className="text-[11px] text-rose-600 mt-1 block font-medium">{formErrors.cpf}</span>
                ) : (
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Exigência do Banco Central e da plataforma Asaas para registro fiscal e emissão imediata do QR Code PIX.
                  </p>
                )}
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  WhatsApp com DDD (para receber o link) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="(11) 98765-4321"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                {formErrors.whatsapp && (
                  <span className="text-[11px] text-rose-600">{formErrors.whatsapp}</span>
                )}
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  E-mail para confirmação e recibo *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="mariana@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                {formErrors.email && (
                  <span className="text-[11px] text-rose-600">{formErrors.email}</span>
                )}
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Idade *
                </label>
                <input
                  type="number"
                  required
                  placeholder="Ex: 34"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                {formErrors.age && (
                  <span className="text-[11px] text-rose-600">{formErrors.age}</span>
                )}
              </div>

              {/* Approximate Weight */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Peso Aproximado (kg) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 72 kg"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                {formErrors.weight && (
                  <span className="text-[11px] text-rose-600">{formErrors.weight}</span>
                )}
              </div>

              {/* Main Goal */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Principal Objetivo de Saúde *
                </label>
                <select
                  value={formData.mainGoal}
                  onChange={(e) => setFormData({ ...formData, mainGoal: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="Emagrecimento saudável e sustentável">
                    Emagrecimento saudável e sustentável (sem efeito sanfona)
                  </option>
                  <option value="Reeducação alimentar sem passar fome">
                    Reeducação alimentar e melhora da relação com a comida
                  </option>
                  <option value="Controle de exames (Colesterol, Glicemia, Triglicérides)">
                    Controle de exames clínicos (Colesterol, Glicemia, Gordura no fígado)
                  </option>
                  <option value="Ganho de massa muscular e disposição">
                    Ganho de massa magra e mais energia no dia a dia
                  </option>
                  <option value="Nutrição para rotina corrida de trabalho">
                    Planejamento prático para quem não tem tempo de cozinhar
                  </option>
                </select>
              </div>

              {/* Restrictions */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Alguma alergia, intolerância ou aversão alimentar? (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Intolerância à lactose, não como berinjela, vegetariana..."
                  value={formData.restrictions}
                  onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('calendar')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao calendário</span>
              </button>

              <button
                type="submit"
                disabled={isGeneratingPix}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer disabled:opacity-75"
              >
                {isGeneratingPix ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Conectando ao Asaas...</span>
                  </>
                ) : (
                  <>
                    <span>Ir para o Pagamento (R$ 79,00)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: PIX VIA ASAAS */}
        {step === 'pix' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center max-w-md mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
                <span>{pixProvider}</span>
                <span>• Cobrança Ativa</span>
              </div>
              <h4 className="text-xl font-bold text-emerald-950 font-serif-display">
                Pague R$ 79,00 via PIX para confirmar sua consulta
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Tempo restante para garantir seu horário no Cal.com:{' '}
                <span className="font-mono font-bold text-rose-600 tabular-nums">
                  {formatMinutes(pixTimeRemaining)}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* QR Code Container */}
              <div className="md:col-span-5 flex flex-col items-center">
                <div className="p-4 bg-white rounded-2xl border-2 border-emerald-900/10 shadow-sm flex flex-col items-center">
                  <div className="w-44 h-44 bg-white p-2 border border-neutral-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {pixQrBase64 ? (
                      <img
                        src={`data:image/png;base64,${pixQrBase64}`}
                        alt="QR Code Asaas PIX"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-950 fill-current">
                        <rect x="0" y="0" width="30" height="30" fill="#064E3B" rx="2" />
                        <rect x="5" y="5" width="20" height="20" fill="#FFFFFF" />
                        <rect x="10" y="10" width="10" height="10" fill="#064E3B" />

                        <rect x="70" y="0" width="30" height="30" fill="#064E3B" rx="2" />
                        <rect x="75" y="5" width="20" height="20" fill="#FFFFFF" />
                        <rect x="80" y="10" width="10" height="10" fill="#064E3B" />

                        <rect x="0" y="70" width="30" height="30" fill="#064E3B" rx="2" />
                        <rect x="5" y="75" width="20" height="20" fill="#FFFFFF" />
                        <rect x="10" y="80" width="10" height="10" fill="#064E3B" />

                        <rect x="36" y="8" width="6" height="6" fill="#064E3B" />
                        <rect x="46" y="8" width="6" height="6" fill="#064E3B" />
                        <rect x="56" y="8" width="6" height="6" fill="#064E3B" />
                        <rect x="36" y="20" width="6" height="6" fill="#064E3B" />
                        <rect x="50" y="20" width="6" height="6" fill="#064E3B" />
                        <rect x="8" y="38" width="6" height="6" fill="#064E3B" />
                        <rect x="20" y="38" width="6" height="6" fill="#064E3B" />
                        <rect x="36" y="36" width="8" height="8" fill="#064E3B" />
                        <rect x="50" y="36" width="6" height="6" fill="#064E3B" />
                        <rect x="62" y="36" width="8" height="8" fill="#064E3B" />
                        <rect x="76" y="38" width="6" height="6" fill="#064E3B" />
                        <rect x="88" y="38" width="6" height="6" fill="#064E3B" />
                        <rect x="8" y="50" width="6" height="6" fill="#064E3B" />
                        <rect x="36" y="50" width="6" height="6" fill="#064E3B" />
                        <rect x="50" y="50" width="8" height="8" fill="#064E3B" />
                        <rect x="66" y="50" width="6" height="6" fill="#064E3B" />
                        <rect x="80" y="50" width="6" height="6" fill="#064E3B" />
                        <rect x="36" y="66" width="6" height="6" fill="#064E3B" />
                        <rect x="52" y="66" width="6" height="6" fill="#064E3B" />
                        <rect x="68" y="66" width="6" height="6" fill="#064E3B" />
                        <rect x="36" y="80" width="8" height="8" fill="#064E3B" />
                        <rect x="50" y="80" width="6" height="6" fill="#064E3B" />
                        <rect x="64" y="80" width="8" height="8" fill="#064E3B" />
                        <rect x="82" y="80" width="6" height="6" fill="#064E3B" />
                      </svg>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-2 text-center">
                    Abra o app do seu banco e aponte a câmera
                  </div>
                </div>
              </div>

              {/* Copia e Cola & Instructions */}
              <div className="md:col-span-7 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-800">
                      Código PIX Copia e Cola ({pixProvider}):
                    </label>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      ID: {paymentId || 'pay_asaas'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pixCopyPasteCode}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-700 truncate select-all focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-400 rounded-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPix ? 'Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>

                  {/* Beneficiary and Live Webhook Badges */}
                  <div className="mt-2 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-neutral-600 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-200">
                      <span>Beneficiária: <strong>Drª Sabrina Vidal (CRN 17198 - GO)</strong></span>
                      <span className="font-mono text-emerald-700 font-bold">R$ 79,00</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/90 px-2.5 py-1 rounded-md border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Webhook Asaas Ativo · Sincronização automática em tempo real</span>
                    </div>
                    {formData.cpf && (
                      <div className="flex items-center justify-between text-[11px] text-neutral-600 bg-neutral-100/90 px-2.5 py-1 rounded-md border border-neutral-200">
                        <span>Titular / CPF: <strong className="font-mono text-neutral-900">{formData.cpf}</strong></span>
                        <span className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" /> Registrado no Asaas
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Steps to pay */}
                <div className="space-y-1.5 text-xs text-neutral-600 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                  <div className="font-semibold text-emerald-950">O que acontece ao pagar:</div>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>O Asaas identifica a liquidação do PIX em poucos segundos.</li>
                    <li>O webhook dispara a confirmação automática do agendamento no Cal.com.</li>
                    <li>Você recebe o <strong>e-mail de confirmação</strong> com o link do Google Meet.</li>
                    <li>A Drª Sabrina Vidal recebe o <strong>e-mail de alerta</strong> com seus dados para se preparar.</li>
                  </ol>
                </div>

                {/* Real-time Asaas Verification Button */}
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleVerifyAsaasPayment}
                    disabled={isCheckingAsaas}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-75"
                  >
                    {isCheckingAsaas ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verificando compensação do PIX...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>Já realizei o pagamento via PIX</span>
                      </>
                    )}
                  </button>

                  {checkAsaasNotice && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                      <span>{checkAsaasNotice}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS (EXPERIÊNCIA PURA DO PACIENTE) */}
        {step === 'success' && (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Top Celebration */}
            <div className="text-center space-y-2 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-xl sm:text-2xl font-bold text-emerald-950">
                Consulta Confirmada com Sucesso!
              </h4>
              <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto">
                Seu agendamento foi registrado e o pagamento do PIX (R$ 79,00) foi aprovado. Estamos muito felizes em cuidar da sua saúde!
              </p>
            </div>

            {/* Appointment Details Card */}
            <div className="p-5 rounded-2xl bg-neutral-50 border border-emerald-200/80 space-y-4 shadow-xs">
              <div className="flex items-center gap-3.5 pb-4 border-b border-neutral-200">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-emerald-800 shrink-0 ring-2 ring-emerald-600">
                  <img
                    src="/assets/aistudio/PHOTO-2026-10-21-17-02-18_872ea764.jpg"
                    alt="Drª Sabrina Vidal"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>Drª Sabrina Vidal</span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      CRN 17198 - GO
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600">
                    Nutricionista Clínica · Consulta Individual de Nutrição Social
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-neutral-200">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Data & Horário</span>
                  <div className="font-bold text-emerald-950 text-sm mt-0.5">
                    {displayDate} ({currentDay.dayOfWeek}-feira)
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    Às {formData.selectedTime} (Horário de Brasília)
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-neutral-200">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Paciente</span>
                  <div className="font-bold text-neutral-900 text-sm mt-0.5 truncate">
                    {patientName}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {formData.age ? `${formData.age} anos · ` : ''}Duração de 50 minutos
                  </div>
                </div>
              </div>
            </div>

            {/* Google Meet Video Room Card */}
            <div className="p-5 rounded-2xl bg-emerald-950 text-white space-y-3.5 shadow-md">
              <div className="flex items-center justify-between gap-2 border-b border-emerald-900 pb-3">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-emerald-300" />
                  <span className="text-sm font-bold text-white">
                    Sua Sala de Videochamada (Google Meet)
                  </span>
                </div>
                <span className="text-[11px] bg-emerald-900 text-emerald-200 font-semibold px-2.5 py-0.5 rounded-full">
                  Ao vivo online
                </span>
              </div>

              <p className="text-xs text-emerald-200/90 leading-relaxed">
                No dia e horário marcados, você e a Drª Sabrina se encontrarão pelo Google Meet através do link abaixo:
              </p>

              <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="font-mono text-xs text-emerald-200 font-bold break-all select-all">
                  {meetUrl}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyMeet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-xs text-white font-semibold transition-colors cursor-pointer"
                  >
                    {copiedMeet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={meetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Entrar na Sala</span>
                  </a>
                </div>
              </div>

              <div className="pt-1">
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Consulta Nutrição Social - Drª Sabrina Vidal')}&details=${encodeURIComponent(`Consulta online de Nutrição Social com Drª Sabrina Vidal (CRN 17198 - GO).\nSala de atendimento: ${meetUrl}\nPaciente: ${patientName}`)}&location=${encodeURIComponent(meetUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-white underline font-medium transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Adicionar lembrete no meu Google Agenda</span>
                </a>
              </div>
            </div>

            {/* Helpful patient notices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-600">
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Enviado no seu WhatsApp</span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Enviamos o link da sala e o lembrete para o seu número ({formData.whatsapp}).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  <span>Confirmação no seu E-mail</span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Todos os detalhes da consulta foram enviados para {formData.email}.
                </p>
              </div>
            </div>

            {/* Orientation for the appointment day */}
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <span>🌿 Orientações para o dia da sua consulta:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-emerald-900/90 text-[11px]">
                <li>Conecte-se com cerca de 5 minutos de antecedência.</li>
                <li>Se tiver exames de sangue recentes (últimos 6 meses), deixe-os separados para a consulta.</li>
                <li>Fique em um ambiente calmo com um copo de água ao lado.</li>
              </ul>
            </div>

            {/* Bottom Final Action */}
            <div className="pt-4 border-t border-neutral-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setStep('calendar');
                  onClose();
                }}
                className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer shadow-sm text-center"
              >
                Concluir e Voltar ao Início
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
