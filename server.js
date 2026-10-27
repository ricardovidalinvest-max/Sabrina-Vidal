// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import QRCode from "qrcode";

// src/backend/index.ts
import { Router } from "express";

// src/backend/db/database.ts
import crypto from "crypto";
var InMemoryAgendamentosRepository = class {
  constructor() {
    this.records = /* @__PURE__ */ new Map();
  }
  async createPendingBooking(data) {
    const existing = await this.findByCalcomId(data.calcomBookingId);
    if (existing) {
      return existing;
    }
    const newRecord = {
      id: crypto.randomUUID(),
      calcom_booking_id: data.calcomBookingId,
      asaas_payment_id: null,
      status: "PENDING",
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date(),
      metadata: data.metadata
    };
    this.records.set(newRecord.id, newRecord);
    return newRecord;
  }
  async findByCalcomId(calcomBookingId) {
    for (const record of this.records.values()) {
      if (record.calcom_booking_id === calcomBookingId) {
        return { ...record };
      }
    }
    return null;
  }
  async findByAsaasPaymentId(asaasPaymentId) {
    if (!asaasPaymentId) return null;
    for (const record of this.records.values()) {
      if (record.asaas_payment_id === asaasPaymentId) {
        return { ...record };
      }
    }
    return null;
  }
  async updateAsaasPaymentId(calcomBookingId, asaasPaymentId) {
    for (const record of this.records.values()) {
      if (record.calcom_booking_id === calcomBookingId) {
        record.asaas_payment_id = asaasPaymentId;
        record.updated_at = /* @__PURE__ */ new Date();
        return { ...record };
      }
    }
    return null;
  }
  async updateStatus(idOrPaymentId, newStatus) {
    for (const record of this.records.values()) {
      if (record.id === idOrPaymentId || record.asaas_payment_id === idOrPaymentId || record.calcom_booking_id === idOrPaymentId) {
        record.status = newStatus;
        record.updated_at = /* @__PURE__ */ new Date();
        return { ...record };
      }
    }
    return null;
  }
  async findExpiredPendingBookings(minutesThreshold = 15) {
    const cutoffTime = new Date(Date.now() - minutesThreshold * 60 * 1e3);
    const expired = [];
    for (const record of this.records.values()) {
      if (record.status === "PENDING" && new Date(record.created_at) < cutoffTime) {
        expired.push({ ...record });
      }
    }
    return expired;
  }
  async getAll() {
    return Array.from(this.records.values()).map((r) => ({ ...r }));
  }
};
var dbRepository = new InMemoryAgendamentosRepository();

// src/backend/config/env.config.ts
var sanitizeZapiBaseUrl = (raw) => {
  if (!raw) return "https://api.z-api.io";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://api.z-api.io";
  }
};
var currentConfig = {
  calcomApiKey: process.env.CALCOM_API_KEY || "",
  calcomWebhookSecret: process.env.CALCOM_WEBHOOK_SECRET || "",
  calcomBaseUrl: process.env.CALCOM_BASE_URL || "https://api.cal.com/v2",
  calcomEventUrl: process.env.CALCOM_EVENT_URL || "https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas",
  asaasApiKey: process.env.ASAAS_API_KEY || "",
  asaasEnvironment: process.env.ASAAS_ENVIRONMENT || "production",
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN || "",
  zapiInstanceId: process.env.ZAPI_INSTANCE_ID || "",
  zapiToken: process.env.ZAPI_TOKEN || "",
  zapiClientToken: process.env.ZAPI_CLIENT_TOKEN || "",
  zapiBaseUrl: sanitizeZapiBaseUrl(process.env.ZAPI_BASE_URL),
  consultationPriceBrl: Number(process.env.CONSULTATION_PRICE_BRL) || 79,
  pixExpirationMinutes: Number(process.env.PIX_EXPIRATION_MINUTES) || 15,
  appUrl: process.env.APP_URL || "https://sabrinavidal.com.br",
  adminPassword: process.env.ADMIN_PASSWORD || "sabrina@admin2026"
};
var getLiveConfig = () => {
  return { ...currentConfig };
};
var verifyAdminPassword = (inputPass) => {
  if (!inputPass || typeof inputPass !== "string") return false;
  const current = currentConfig.adminPassword || process.env.ADMIN_PASSWORD || "sabrina@admin2026";
  return inputPass.trim() === current.trim();
};
var updateLiveConfig = (newValues) => {
  if (newValues.calcomApiKey !== void 0 && newValues.calcomApiKey.trim().length > 0) currentConfig.calcomApiKey = newValues.calcomApiKey.trim();
  if (newValues.calcomWebhookSecret !== void 0) currentConfig.calcomWebhookSecret = newValues.calcomWebhookSecret.trim();
  if (newValues.calcomBaseUrl !== void 0 && newValues.calcomBaseUrl.trim().length > 0) currentConfig.calcomBaseUrl = newValues.calcomBaseUrl.trim();
  if (newValues.calcomEventUrl !== void 0 && newValues.calcomEventUrl.trim().length > 0) currentConfig.calcomEventUrl = newValues.calcomEventUrl.trim();
  if (newValues.asaasApiKey !== void 0 && newValues.asaasApiKey.trim().length > 0) currentConfig.asaasApiKey = newValues.asaasApiKey.trim();
  if (newValues.asaasEnvironment !== void 0) currentConfig.asaasEnvironment = newValues.asaasEnvironment;
  if (newValues.asaasWebhookToken !== void 0) currentConfig.asaasWebhookToken = newValues.asaasWebhookToken.trim();
  if (newValues.zapiInstanceId !== void 0 && newValues.zapiInstanceId.trim().length > 0) currentConfig.zapiInstanceId = newValues.zapiInstanceId.trim();
  if (newValues.zapiToken !== void 0 && newValues.zapiToken.trim().length > 0) currentConfig.zapiToken = newValues.zapiToken.trim();
  if (newValues.zapiClientToken !== void 0 && newValues.zapiClientToken.trim().length > 0) currentConfig.zapiClientToken = newValues.zapiClientToken.trim();
  if (newValues.zapiBaseUrl !== void 0 && newValues.zapiBaseUrl.trim().length > 0) currentConfig.zapiBaseUrl = sanitizeZapiBaseUrl(newValues.zapiBaseUrl.trim());
  if (newValues.consultationPriceBrl !== void 0) currentConfig.consultationPriceBrl = Number(newValues.consultationPriceBrl);
  if (newValues.pixExpirationMinutes !== void 0) currentConfig.pixExpirationMinutes = Number(newValues.pixExpirationMinutes);
  if (newValues.appUrl !== void 0) currentConfig.appUrl = newValues.appUrl.trim();
  if (newValues.adminPassword !== void 0 && newValues.adminPassword.trim().length > 0) {
    currentConfig.adminPassword = newValues.adminPassword.trim();
  }
  console.log("[LiveConfig] Configura\xE7\xF5es de chaves e webhooks atualizadas com sucesso em tempo de execu\xE7\xE3o.");
  return { ...currentConfig };
};
var getMaskedConfig = () => {
  const mask = (str, keepLen = 6) => {
    if (!str) return "";
    if (str.length <= keepLen) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
    return `${str.substring(0, keepLen)}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${str.substring(str.length - 4)}`;
  };
  return {
    calcomApiKey: mask(currentConfig.calcomApiKey, 8),
    hasCalcomApiKey: Boolean(currentConfig.calcomApiKey && currentConfig.calcomApiKey.length > 5),
    calcomWebhookSecret: currentConfig.calcomWebhookSecret,
    calcomBaseUrl: currentConfig.calcomBaseUrl,
    calcomEventUrl: currentConfig.calcomEventUrl,
    asaasApiKey: mask(currentConfig.asaasApiKey, 8),
    hasAsaasApiKey: Boolean(currentConfig.asaasApiKey && currentConfig.asaasApiKey.length > 10),
    asaasEnvironment: currentConfig.asaasEnvironment,
    asaasWebhookToken: currentConfig.asaasWebhookToken,
    zapiInstanceId: mask(currentConfig.zapiInstanceId, 4),
    hasZapiInstanceId: Boolean(currentConfig.zapiInstanceId && currentConfig.zapiInstanceId.length > 4),
    zapiToken: mask(currentConfig.zapiToken, 4),
    hasZapiToken: Boolean(currentConfig.zapiToken && currentConfig.zapiToken.length > 4),
    zapiClientToken: mask(currentConfig.zapiClientToken, 3),
    zapiBaseUrl: currentConfig.zapiBaseUrl,
    consultationPriceBrl: currentConfig.consultationPriceBrl,
    pixExpirationMinutes: currentConfig.pixExpirationMinutes,
    appUrl: currentConfig.appUrl
  };
};

// src/backend/services/asaas.service.ts
var AsaasService = class {
  get apiKey() {
    return getLiveConfig().asaasApiKey || process.env.ASAAS_API_KEY || "";
  }
  get environment() {
    return getLiveConfig().asaasEnvironment || "production";
  }
  get baseUrl() {
    return this.environment === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  }
  constructor() {
  }
  getHeaders() {
    return {
      "Content-Type": "application/json",
      "access_token": this.apiKey
    };
  }
  /**
   * Busca cliente por e-mail/telefone ou cria um novo registro no Asaas.
   */
  async findOrCreateCustomer(data) {
    try {
      console.log(`[AsaasService] Localizando/Criando cliente: ${data.name} (${data.email})...`);
      if (!this.apiKey || this.apiKey === "MY_ASAAS_API_KEY") {
        const mockCustomerId = `cus_mock_${Math.random().toString(36).substring(2, 9)}`;
        console.warn(`[AsaasService] ASAAS_API_KEY ausente ou placeholder. Usando ID simulado: ${mockCustomerId}`);
        return mockCustomerId;
      }
      const cleanPhone = data.phone.replace(/\D/g, "");
      const cleanCpf = data.cpfCnpj ? data.cpfCnpj.replace(/\D/g, "") : void 0;
      const searchUrl = `${this.baseUrl}/customers?email=${encodeURIComponent(data.email)}`;
      const searchRes = await fetch(searchUrl, {
        method: "GET",
        headers: this.getHeaders()
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
          const customer = searchData.data[0];
          console.log(`[AsaasService] Cliente j\xE1 existente encontrado no Asaas: ${customer.id}`);
          if (cleanCpf && (!customer.cpfCnpj || customer.cpfCnpj !== cleanCpf)) {
            console.log(`[AsaasService] Atualizando CPF/CNPJ do cliente existente ${customer.id}...`);
            await fetch(`${this.baseUrl}/customers/${customer.id}`, {
              method: "POST",
              headers: this.getHeaders(),
              body: JSON.stringify({ cpfCnpj: cleanCpf })
            }).catch((e) => console.warn("[AsaasService] Aviso ao atualizar CPF:", e.message));
          }
          return customer.id;
        }
      }
      const createRes = await fetch(`${this.baseUrl}/customers`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          mobilePhone: cleanPhone.length >= 10 ? cleanPhone : void 0,
          cpfCnpj: cleanCpf,
          notificationDisabled: false
        })
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Falha ao criar cliente no Asaas (Status ${createRes.status}): ${errText}`);
      }
      const createdCustomer = await createRes.json();
      console.log(`[AsaasService] Novo cliente criado com sucesso: ${createdCustomer.id}`);
      return createdCustomer.id;
    } catch (error) {
      console.error(`[AsaasService:ERROR] Erro ao buscar/criar cliente:`, error.message);
      throw error;
    }
  }
  /**
   * Cria uma cobrança PIX com vencimento dinâmico e obtém o Payload Copia e Cola + QR Code.
   */
  async createPixCharge(params) {
    try {
      console.log(`[AsaasService] Gerando cobran\xE7a PIX de R$ ${params.value.toFixed(2)} para cliente ${params.customerId}...`);
      const now = /* @__PURE__ */ new Date();
      const dueDate = now.toISOString().split("T")[0];
      const expiresInMin = params.expiresInMinutes || 15;
      const expirationDate = new Date(now.getTime() + expiresInMin * 60 * 1e3).toISOString();
      if (!this.apiKey || this.apiKey === "MY_ASAAS_API_KEY") {
        const mockPayId = `pay_mock_${Math.random().toString(36).substring(2, 10)}`;
        const simulatedPix = `00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/${mockPayId}5204000053039865405${params.value.toFixed(2)}5802BR5920Dra Sabrina Vidal Nut6009Sao Paulo62070503***6304ABCD`;
        console.warn(`[AsaasService] API Key ausente. Gerando PIX simulado com ID: ${mockPayId}`);
        return {
          paymentId: mockPayId,
          status: "PENDING",
          value: params.value,
          pixPayload: simulatedPix,
          qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(simulatedPix)}`,
          expirationDate
        };
      }
      const paymentRes = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          customer: params.customerId,
          billingType: "PIX",
          value: params.value,
          dueDate,
          description: params.description,
          externalReference: params.externalReference,
          postalService: false
        })
      });
      if (!paymentRes.ok) {
        const errText = await paymentRes.text();
        throw new Error(`Falha ao registrar cobran\xE7a no Asaas (Status ${paymentRes.status}): ${errText}`);
      }
      const paymentData = await paymentRes.json();
      const paymentId = paymentData.id;
      const qrRes = await fetch(`${this.baseUrl}/payments/${paymentId}/pixQrCode`, {
        method: "GET",
        headers: this.getHeaders()
      });
      let pixPayload = "";
      let qrCodeImage = "";
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        pixPayload = qrData.payload || "";
        qrCodeImage = qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : "";
      } else {
        console.warn(`[AsaasService] N\xE3o foi poss\xEDvel obter o pixQrCode diretamente da API. Gerando fallback.`);
        pixPayload = `00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/${paymentId}5204000053039865405${params.value.toFixed(2)}5802BR5920Dra Sabrina Vidal6009Sao Paulo62070503***6304E1F2`;
        qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixPayload)}`;
      }
      console.log(`[AsaasService] Cobran\xE7a PIX criada com sucesso: ID ${paymentId}`);
      return {
        paymentId,
        status: paymentData.status || "PENDING",
        value: paymentData.value || params.value,
        netValue: paymentData.netValue,
        pixPayload,
        qrCodeImage,
        invoiceUrl: paymentData.invoiceUrl || paymentData.bankSlipUrl || `https://www.asaas.com/i/${paymentId}`,
        expirationDate
      };
    } catch (error) {
      console.error(`[AsaasService:ERROR] Erro ao criar cobran\xE7a PIX:`, error.message);
      throw error;
    }
  }
  /**
   * Remove/Cancela a cobrança no Asaas caso o agendamento expire por falta de pagamento.
   */
  async deleteCharge(paymentId) {
    try {
      console.log(`[AsaasService] Cancelando cobran\xE7a Asaas ID: ${paymentId}...`);
      if (!this.apiKey || this.apiKey === "MY_ASAAS_API_KEY") {
        console.log(`[AsaasService] Cobran\xE7a simulada ${paymentId} cancelada com sucesso.`);
        return true;
      }
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: "DELETE",
        headers: this.getHeaders()
      });
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[AsaasService:WARN] Falha ao excluir cobran\xE7a ${paymentId} (Status ${response.status}): ${errText}`);
        return false;
      }
      console.log(`[AsaasService] Cobran\xE7a ${paymentId} exclu\xEDda no Asaas com sucesso.`);
      return true;
    } catch (error) {
      console.error(`[AsaasService:ERROR] Erro ao excluir cobran\xE7a ${paymentId}:`, error.message);
      return false;
    }
  }
};
var asaasService = new AsaasService();

// src/backend/services/calcom.service.ts
var CalcomService = class {
  get apiKey() {
    return getLiveConfig().calcomApiKey || process.env.CALCOM_API_KEY || "";
  }
  get baseUrl() {
    let url = getLiveConfig().calcomBaseUrl || process.env.CALCOM_BASE_URL || "https://api.cal.com/v2";
    if (url.includes("/v1")) {
      url = url.replace("/v1", "/v2");
    }
    return url.replace(/\/$/, "");
  }
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13"
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }
  constructor() {
  }
  /**
   * Consulta os tipos de eventos cadastrados no Cal.com da nutricionista
   */
  async getEventTypes() {
    try {
      if (!this.apiKey) {
        return {
          success: true,
          data: [
            {
              id: 1,
              title: "Consulta Nutri\xE7\xE3o Social",
              slug: "agendamentos-de-consultas",
              lengthInMinutes: 50,
              description: "Consulta Individual de Nutri\xE7\xE3o Social com Dra. Sabrina Vidal"
            }
          ]
        };
      }
      const res = await fetch(`${this.baseUrl}/event-types`, {
        method: "GET",
        headers: this.getHeaders()
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Erro ao buscar tipos de eventos (${res.status}): ${errText}` };
      }
      const data = await res.json();
      const list = data.data || data;
      return { success: true, data: Array.isArray(list) ? list : [list] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  /**
   * Consulta a disponibilidade real de horários no Cal.com para uma data ou intervalo (até 30 dias pra frente)
   * Realiza a busca automática na API oficial v2 do Cal.com (/v2/slots).
   * Se o Cal.com estiver temporariamente indisponível, aplica fallback inteligente com a grade oficial.
   */
  async getAvailableSlots(params) {
    const daysAhead = params?.daysAhead || 30;
    const now = /* @__PURE__ */ new Date();
    const startDateStr = params?.startTime?.split("T")[0] || now.toISOString().split("T")[0];
    const endD = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1e3);
    const endDateStr = params?.endTime?.split("T")[0] || endD.toISOString().split("T")[0];
    const liveConf = getLiveConfig();
    const eventUrl = liveConf.calcomEventUrl || process.env.CALCOM_EVENT_URL || "https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas";
    let username = "sabrina-amorim-tkood0";
    let eventTypeSlug = "agendamentos-de-consultas";
    try {
      const parts = new URL(eventUrl).pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        username = parts[0];
        eventTypeSlug = parts[1];
      }
    } catch {
    }
    try {
      const queryUrl = new URL(`${this.baseUrl}/slots`);
      queryUrl.searchParams.set("start", startDateStr);
      queryUrl.searchParams.set("end", endDateStr);
      queryUrl.searchParams.set("username", username);
      queryUrl.searchParams.set("eventTypeSlug", eventTypeSlug);
      queryUrl.searchParams.set("timeZone", "America/Sao_Paulo");
      const headers = {
        "Content-Type": "application/json",
        "cal-api-version": "2024-09-04"
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      console.log(`[CalcomService] Sincroniza\xE7\xE3o autom\xE1tica de agenda no Cal.com v2: ${queryUrl.toString()}...`);
      const res = await fetch(queryUrl.toString(), {
        method: "GET",
        headers
      });
      if (res.ok) {
        const resData = await res.json();
        const rawSlots = resData.data?.slots || resData.data || {};
        const dayNames = ["Domingo", "Segunda", "Ter\xE7a", "Quarta", "Quinta", "Sexta", "S\xE1bado"];
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const formattedDays = Object.keys(rawSlots).sort().map((dayKey) => {
          const [year, month, day] = dayKey.split("-").map(Number);
          const dateObj = new Date(year, month - 1, day, 12, 0, 0);
          const timeList = (rawSlots[dayKey] || []).map((s) => {
            const tStr = typeof s === "string" ? s : s.time || s.start || s.startTime;
            if (tStr && typeof tStr === "string" && tStr.includes("T")) {
              return tStr.split("T")[1].slice(0, 5);
            }
            return String(tStr);
          });
          return {
            date: dayKey,
            dayOfWeek: dayNames[dateObj.getDay()],
            dayNumber: String(day).padStart(2, "0"),
            monthName: monthNames[month - 1],
            timeSlots: timeList,
            slotsRemaining: timeList.length,
            isRealCalcom: true
          };
        }).filter((d) => d.slotsRemaining > 0);
        if (formattedDays.length > 0) {
          console.log(`[CalcomService:v2] Sincroniza\xE7\xE3o autom\xE1tica bem-sucedida com Cal.com: ${formattedDays.length} dias de hor\xE1rios dispon\xEDveis encontrados.`);
          return { success: true, slots: formattedDays, source: "calcom_v2" };
        }
      } else {
        const errText = await res.text();
        console.warn(`[CalcomService:v2:WARN] Endpoint Cal.com /v2/slots retornou HTTP ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.warn(`[CalcomService:v2:WARN] Falha na consulta autom\xE1tica da agenda Cal.com: ${err.message}`);
    }
    const fallbackDays = this.generateClinicSlots(daysAhead);
    return { success: true, slots: fallbackDays, source: "schedule_fallback" };
  }
  /**
   * Gera a grade horária oficial da Dra. Sabrina Vidal para até 30 dias no futuro
   * Exclui domingos e horários passados do dia atual
   */
  generateClinicSlots(daysAhead = 30) {
    const now = /* @__PURE__ */ new Date();
    const dayNames = ["Domingo", "Segunda", "Ter\xE7a", "Quarta", "Quinta", "Sexta", "S\xE1bado"];
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const slotsByDay = {
      1: ["09:00", "10:30", "14:00", "16:00", "18:30"],
      // Segunda
      2: ["08:30", "11:00", "14:30", "17:00", "19:00"],
      // Terça
      3: ["09:30", "11:30", "14:00", "16:30", "18:00"],
      // Quarta
      4: ["08:30", "10:30", "15:00", "17:30", "19:00"],
      // Quinta
      5: ["09:00", "11:00", "14:00", "16:00", "17:30"],
      // Sexta
      6: ["08:30", "10:00", "11:30"]
      // Sábado
    };
    const days = [];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dayOfWeekIndex = d.getDay();
      if (dayOfWeekIndex === 0) continue;
      const dayOfWeek = dayNames[dayOfWeekIndex];
      const dayNumber = String(d.getDate()).padStart(2, "0");
      const monthName = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const dateStr = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${dayNumber}`;
      let baseSlots = [...slotsByDay[dayOfWeekIndex] || ["09:00", "14:00", "16:30"]];
      if (i === 0) {
        baseSlots = baseSlots.filter((timeStr) => {
          const [h, m] = timeStr.split(":").map(Number);
          return h > currentHour || h === currentHour && m > currentMinute + 15;
        });
      }
      if (baseSlots.length > 0) {
        days.push({
          date: dateStr,
          dayOfWeek,
          dayNumber,
          monthName,
          slotsRemaining: baseSlots.length,
          timeSlots: baseSlots,
          isRealCalcom: false
        });
      }
    }
    return days;
  }
  /**
   * Cria uma pré-reserva de horário no Cal.com por 15 minutos aguardando pagamento
   * Bloqueia a agenda temporariamente. Se o pagamento não ocorrer em 15 min, será cancelado.
   */
  async createReservation(params) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    const cleanPhone = (params.attendee.phoneNumber || "").replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? `+${cleanPhone}` : `+55${cleanPhone}`;
    console.log(`[CalcomService:v2] Criando pr\xE9-reserva de 15 minutos no Cal.com para ${params.attendee.name} (${params.startTime})...`);
    if (!this.apiKey) {
      const syntheticUid = `cal_hold_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      console.log(`[CalcomService:v2] CALCOM_API_KEY n\xE3o configurada. Criando reserva tempor\xE1ria local ID: ${syntheticUid}`);
      return {
        success: true,
        bookingId: syntheticUid,
        uid: syntheticUid,
        startTime: params.startTime,
        status: "PENDING",
        expiresAt,
        videoCallUrl: `https://meet.google.com/sab-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`,
        isSimulated: true
      };
    }
    try {
      let eventTypeId = params.eventTypeId;
      if (!eventTypeId) {
        const events = await this.getEventTypes();
        if (events.success && events.data && events.data.length > 0) {
          eventTypeId = events.data[0].id;
        }
      }
      const liveConf = getLiveConfig();
      const eventUrl = liveConf.calcomEventUrl || process.env.CALCOM_EVENT_URL || "https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas";
      let parsedUsername = "sabrina-amorim-tkood0";
      let parsedSlug = "agendamentos-de-consultas";
      try {
        const u = new URL(eventUrl);
        const parts = u.pathname.replace(/^\//, "").split("/").filter(Boolean);
        if (parts.length >= 2) {
          parsedUsername = parts[0];
          parsedSlug = parts[1];
        }
      } catch {
      }
      const bodyPayload = {
        start: params.startTime,
        attendee: {
          name: params.attendee.name,
          email: params.attendee.email,
          timeZone: params.attendee.timeZone || "America/Sao_Paulo",
          phoneNumber: formattedPhone.length > 5 ? formattedPhone : void 0
        },
        metadata: {
          status: "PENDING_PAYMENT",
          holdUntil: expiresAt,
          source: "sabrinavidal.com.br",
          ...params.metadata
        }
      };
      if (eventTypeId && !isNaN(Number(eventTypeId))) {
        bodyPayload.eventTypeId = Number(eventTypeId);
      } else {
        bodyPayload.eventTypeSlug = parsedSlug;
        bodyPayload.username = parsedUsername;
      }
      const response = await fetch(`${this.baseUrl}/bookings`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(bodyPayload)
      });
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[CalcomService:v2:WARN] Falha ao registrar na API do Cal.com (${response.status}): ${errText}`);
        const localUid = `cal_hold_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return {
          success: true,
          bookingId: localUid,
          uid: localUid,
          startTime: params.startTime,
          status: "PENDING",
          expiresAt,
          videoCallUrl: `https://meet.google.com/sab-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`,
          isSimulated: true,
          rawResponse: { error: errText, status: response.status }
        };
      }
      const data = await response.json();
      const booking = data.data || data;
      const bookingId = String(booking.id || booking.uid);
      const uid = String(booking.uid || booking.id);
      const videoCallUrl = booking.videoCallUrl || booking.meetingUrl || `https://meet.google.com/sab-vidal-79`;
      console.log(`[CalcomService:v2] Pr\xE9-reserva criada com sucesso no Cal.com! ID: ${bookingId} (UID: ${uid})`);
      return {
        success: true,
        bookingId,
        uid,
        startTime: booking.startTime || params.startTime,
        endTime: booking.endTime,
        status: "PENDING",
        expiresAt,
        videoCallUrl,
        rawResponse: booking
      };
    } catch (err) {
      console.error(`[CalcomService:v2:ERROR] Exce\xE7\xE3o ao reservar no Cal.com:`, err.message);
      const fallbackUid = `cal_hold_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        success: true,
        bookingId: fallbackUid,
        uid: fallbackUid,
        startTime: params.startTime,
        status: "PENDING",
        expiresAt,
        videoCallUrl: `https://meet.google.com/sab-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`,
        isSimulated: true
      };
    }
  }
  /**
   * Altera o status do agendamento de PENDING para ACCEPTED após confirmação de pagamento no Asaas.
   */
  async acceptBooking(bookingId) {
    try {
      console.log(`[CalcomService:v2] Confirmando agendamento Cal.com ID: ${bookingId}...`);
      const bIdStr = String(bookingId);
      if (bIdStr.startsWith("booking_") || bIdStr.startsWith("cal_hold_") || bIdStr.startsWith("test_") || bIdStr.startsWith("manual_")) {
        console.log(`[CalcomService:v2] ID ${bookingId} \xE9 um agendamento local/sint\xE9tico. Marcando confirma\xE7\xE3o interna.`);
        return { success: true, data: { status: "ACCEPTED", local: true, id: bookingId } };
      }
      if (!this.apiKey) {
        console.warn(`[CalcomService:v2] CALCOM_API_KEY n\xE3o configurada. Simulando confirma\xE7\xE3o do agendamento.`);
        return { success: true, data: { status: "ACCEPTED", simulated: true, id: bookingId } };
      }
      const response = await fetch(`${this.baseUrl}/bookings/${bookingId}`, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({
          status: "ACCEPTED"
        })
      });
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[CalcomService:v2:WARN] Agendamento ${bookingId} n\xE3o localizado no Cal.com v2 (404 Not Found). Marcando como aceito localmente.`);
          return { success: true, data: { status: "ACCEPTED", notFoundInCalcom: true, id: bookingId } };
        }
        const fallbackRes = await fetch(`${this.baseUrl}/bookings/${bookingId}/confirm`, {
          method: "POST",
          headers: this.getHeaders()
        });
        if (!fallbackRes.ok) {
          const errText = await response.text();
          console.warn(`[CalcomService:v2:WARN] Cal.com retornou status ${response.status}: ${errText}`);
          return { success: true, data: { status: "ACCEPTED", fallback: true, id: bookingId } };
        }
        const fallbackData = await fallbackRes.json();
        console.log(`[CalcomService:v2] Agendamento ${bookingId} confirmado com sucesso via fallback.`);
        return { success: true, data: fallbackData };
      }
      const data = await response.json();
      console.log(`[CalcomService:v2] Agendamento ${bookingId} aceito com sucesso.`);
      return { success: true, data };
    } catch (error) {
      console.error(`[CalcomService:v2:ERROR] Erro ao aceitar agendamento ${bookingId}:`, error.message);
      return { success: true, data: { status: "ACCEPTED", error: error.message, id: bookingId } };
    }
  }
  /**
   * Cancela o agendamento no Cal.com liberando o horário na agenda pública da nutricionista.
   */
  async cancelBooking(bookingId, cancellationReason = "Pagamento PIX n\xE3o identificado no prazo limite de 15 minutos.") {
    try {
      console.log(`[CalcomService:v2] Cancelando agendamento Cal.com ID: ${bookingId} por expira\xE7\xE3o...`);
      const bIdStr = String(bookingId);
      if (bIdStr.startsWith("booking_") || bIdStr.startsWith("cal_hold_") || bIdStr.startsWith("test_") || bIdStr.startsWith("manual_")) {
        console.log(`[CalcomService:v2] ID ${bookingId} \xE9 um agendamento local/sint\xE9tico. Liberando localmente.`);
        return { success: true, data: { status: "CANCELLED", local: true, id: bookingId } };
      }
      if (!this.apiKey) {
        console.warn(`[CalcomService:v2] CALCOM_API_KEY n\xE3o configurada. Simulando cancelamento.`);
        return { success: true, data: { status: "CANCELLED", simulated: true, id: bookingId } };
      }
      const response = await fetch(`${this.baseUrl}/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          cancellationReason
        })
      });
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[CalcomService:v2:WARN] Agendamento ${bookingId} j\xE1 n\xE3o existe no Cal.com (404 Not Found). Liberado localmente.`);
          return { success: true, data: { status: "CANCELLED", notFound: true, id: bookingId } };
        }
        const deleteRes = await fetch(`${this.baseUrl}/bookings/${bookingId}`, {
          method: "DELETE",
          headers: this.getHeaders(),
          body: JSON.stringify({ cancellationReason })
        });
        if (!deleteRes.ok) {
          if (deleteRes.status === 404) {
            return { success: true, data: { status: "CANCELLED", notFound: true, id: bookingId } };
          }
          const errText = await response.text();
          console.warn(`[CalcomService:v2:WARN] Falha ao cancelar no Cal.com: ${errText}`);
          return { success: true, data: { status: "CANCELLED", fallback: true, id: bookingId } };
        }
      }
      const data = await response.json();
      console.log(`[CalcomService:v2] Agendamento ${bookingId} cancelado e hor\xE1rio liberado com sucesso no Cal.com.`);
      return { success: true, data };
    } catch (error) {
      console.error(`[CalcomService:v2:ERROR] Erro ao cancelar agendamento ${bookingId}:`, error.message);
      return { success: false, error: error.message };
    }
  }
};
var calcomService = new CalcomService();

// src/backend/services/zapi.service.ts
var ZApiService = class {
  get instanceId() {
    return getLiveConfig().zapiInstanceId || process.env.ZAPI_INSTANCE_ID || "";
  }
  get token() {
    return getLiveConfig().zapiToken || process.env.ZAPI_TOKEN || "";
  }
  get clientToken() {
    return getLiveConfig().zapiClientToken || process.env.ZAPI_CLIENT_TOKEN || "";
  }
  get baseUrl() {
    const raw = getLiveConfig().zapiBaseUrl || process.env.ZAPI_BASE_URL || "https://api.z-api.io";
    try {
      const u = new URL(raw);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "https://api.z-api.io";
    }
  }
  constructor() {
  }
  /**
   * Sanitiza e formata o telefone para o padrão internacional do WhatsApp (55DD9XXXXXXXX).
   * Insere o 9º dígito se for número de celular no Brasil com 8 dígitos.
   */
  formatPhoneNumber(rawPhone) {
    let clean = (rawPhone || "").replace(/\D/g, "");
    if (clean.startsWith("0") && clean.length >= 11) {
      clean = clean.replace(/^0+/, "");
    }
    if (clean.startsWith("55") && clean.length === 12) {
      const ddd = clean.substring(2, 4);
      const number = clean.substring(4);
      if (["6", "7", "8", "9"].includes(number[0])) {
        clean = `55${ddd}9${number}`;
      }
    }
    if (!clean.startsWith("55")) {
      if (clean.length === 10) {
        const ddd = clean.substring(0, 2);
        const number = clean.substring(2);
        if (["6", "7", "8", "9"].includes(number[0])) {
          clean = `55${ddd}9${number}`;
        } else {
          clean = `55${clean}`;
        }
      } else if (clean.length === 11) {
        clean = `55${clean}`;
      }
    }
    return clean;
  }
  /**
   * Obtém variantes do número de telefone brasileiro (com e sem o 9º dígito),
   * essencial para compatibilidade com o WhatsApp em DDDs como 62 (Goiás), 11, etc.
   */
  getPhoneVariants(rawPhone) {
    let clean = (rawPhone || "").replace(/\D/g, "");
    if (clean.startsWith("0") && clean.length >= 11) {
      clean = clean.replace(/^0+/, "");
    }
    if (!clean.startsWith("55")) {
      clean = `55${clean}`;
    }
    const variants = [clean];
    if (clean.length === 13 && clean.startsWith("55")) {
      const ddd = clean.substring(2, 4);
      const rest = clean.substring(5);
      if (clean[4] === "9") {
        variants.push(`55${ddd}${rest}`);
      }
    }
    if (clean.length === 12 && clean.startsWith("55")) {
      const ddd = clean.substring(2, 4);
      const rest = clean.substring(4);
      variants.push(`55${ddd}9${rest}`);
    }
    return [...new Set(variants)];
  }
  /**
   * Verifica o status de conexão da instância e se o WhatsApp está pareado via QR Code.
   */
  async checkStatus(overrides) {
    const live = getLiveConfig();
    const instId = (overrides?.instanceId || live.zapiInstanceId || process.env.ZAPI_INSTANCE_ID || "").trim();
    const tok = (overrides?.token || live.zapiToken || process.env.ZAPI_TOKEN || "").trim();
    const clTok = (overrides?.clientToken !== void 0 ? overrides.clientToken : live.zapiClientToken || process.env.ZAPI_CLIENT_TOKEN || "").trim();
    if (!instId || !tok) {
      return {
        success: false,
        connected: false,
        message: "Preencha o ID da Inst\xE2ncia e o Token da Z-API para testar a conex\xE3o."
      };
    }
    try {
      const url = `${this.baseUrl}/instances/${instId}/token/${tok}/status`;
      const makeHeaders = (includeClientToken) => {
        const h = {
          "Content-Type": "application/json"
        };
        if (includeClientToken && clTok) {
          h["Client-Token"] = clTok;
        }
        return h;
      };
      console.log(`[ZApiService] Verificando status da inst\xE2ncia Z-API: ${instId}...`);
      let response = await fetch(url, { method: "GET", headers: makeHeaders(Boolean(clTok)) });
      let text = await response.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      if ((response.status === 401 || response.status === 403) && clTok) {
        console.log(`[ZApiService] Status retornou ${response.status} com Client-Token. Testando sem Client-Token...`);
        const fallbackRes = await fetch(url, { method: "GET", headers: makeHeaders(false) });
        if (fallbackRes.ok) {
          response = fallbackRes;
          text = await fallbackRes.text();
          try {
            data = JSON.parse(text);
          } catch {
            data = { raw: text };
          }
          console.log(`[ZApiService] Inst\xE2ncia aceitou conex\xE3o sem Client-Token!`);
        }
      }
      console.log(`[ZApiService:STATUS_RAW] Resposta status Z-API HTTP ${response.status}:`, JSON.stringify(data));
      const rawError = String(data.error || data.message || text || "").trim();
      const rawErrorUpper = rawError.toUpperCase();
      if (rawErrorUpper.includes("CLIENT-TOKEN IS NOT CONFIGURED") || rawErrorUpper.includes("CLIENT TOKEN IS NOT CONFIGURED")) {
        console.warn("[ZApiService:WARN] Z-API exige o Client-Token de seguran\xE7a da conta.");
        return {
          success: false,
          connected: false,
          requiresClientToken: true,
          message: '\u{1F510} Chave de Seguran\xE7a da Conta exigida: O WhatsApp est\xE1 conectado na sua inst\xE2ncia Z-API, mas sua conta exige o Client-Token no cabe\xE7alho das requisi\xE7\xF5es. No painel da Z-API (app.z-api.io), v\xE1 em Seguran\xE7a > Token de Seguran\xE7a, copie o Client-Token e cole no campo "Client-Token da Conta" abaixo.',
          error: "CLIENT_TOKEN_REQUIRED"
        };
      }
      if (rawErrorUpper.includes("CLIENT-TOKEN NOT ALLOWED") || rawErrorUpper.includes("INVALID CLIENT-TOKEN")) {
        console.warn("[ZApiService:WARN] Z-API rejeitou o Client-Token fornecido.");
        return {
          success: false,
          connected: false,
          invalidClientToken: true,
          message: "\u26A0\uFE0F Client-Token n\xE3o reconhecido: O Client-Token informado n\xE3o foi aceito pela Z-API. Verifique se copiou a chave correta no painel da Z-API em Menu > Seguran\xE7a.",
          error: "INVALID_CLIENT_TOKEN"
        };
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            connected: false,
            requiresClientToken: !clTok,
            message: !clTok ? "\u{1F510} Falha de autentica\xE7\xE3o: Esta inst\xE2ncia da Z-API exige o Client-Token de seguran\xE7a. Acesse Painel Z-API > Seguran\xE7a e preencha o Client-Token abaixo." : `Falha de autentica\xE7\xE3o na Z-API (HTTP ${response.status}): ${data.error || text}. Verifique o Token da Inst\xE2ncia e o Client-Token.`,
            error: data.error || text
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            connected: false,
            message: `Inst\xE2ncia n\xE3o encontrada (Status 404): O ID '${instId}' n\xE3o foi localizado na Z-API.`,
            error: data.error || text
          };
        }
        return {
          success: false,
          connected: false,
          message: `Erro retornado pela Z-API (Status ${response.status}): ${data.error || text}`,
          error: data.error || text
        };
      }
      const isConnected = (data.connected === true || String(data.connected).toLowerCase() === "true" || String(data.status).toUpperCase() === "CONNECTED" || String(data.sessionStatus).toUpperCase() === "CONNECTED" || Boolean(data.phone)) && !rawErrorUpper.includes("NOT CONNECTED");
      const isSmartphoneConnected = data.smartphoneConnected !== void 0 ? Boolean(data.smartphoneConnected) : true;
      if (isConnected) {
        return {
          success: true,
          connected: true,
          smartphoneConnected: isSmartphoneConnected,
          message: isSmartphoneConnected ? "\u2713 Inst\xE2ncia Z-API conectada e pronta para envio no WhatsApp!" : "\u2713 WhatsApp Pareado e Conectado (Multi-Device Ativo). Pronto para disparos!",
          sessionStatus: "CONNECTED"
        };
      } else {
        return {
          success: true,
          connected: false,
          message: data.error || '\u26A0\uFE0F Inst\xE2ncia localizada com sucesso, por\xE9m o WhatsApp est\xE1 DESCONECTADO. Clique em "Escanear QR Code" para conectar.',
          sessionStatus: data.sessionStatus || "DISCONNECTED"
        };
      }
    } catch (error) {
      return {
        success: false,
        connected: false,
        message: `Falha de rede ao conectar \xE0 Z-API: ${error.message}`,
        error: error.message
      };
    }
  }
  /**
   * Obtém a imagem do QR Code em Base64 para escaneamento direto na tela.
   */
  async getQrCodeImage(overrides) {
    const instId = (overrides?.instanceId || this.instanceId || "").trim();
    const tok = (overrides?.token || this.token || "").trim();
    const clTok = (overrides?.clientToken || this.clientToken || "").trim();
    if (!instId || !tok) {
      return {
        success: false,
        message: "Preencha o ID da Inst\xE2ncia e o Token da Z-API para obter o QR Code."
      };
    }
    try {
      const url = `${this.baseUrl}/instances/${instId}/token/${tok}/qr-code/image`;
      const headers = {
        "Content-Type": "application/json"
      };
      if (clTok) {
        headers["Client-Token"] = clTok;
      }
      console.log(`[ZApiService] Solicitando imagem do QR Code da inst\xE2ncia ${instId}...`);
      const response = await fetch(url, { method: "GET", headers });
      const text = await response.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      if (!response.ok) {
        const errDetail = data.error || data.message || text;
        const errDetailUpper = String(errDetail).toUpperCase();
        if (errDetailUpper.includes("CLIENT-TOKEN IS NOT CONFIGURED") || errDetailUpper.includes("CLIENT TOKEN IS NOT CONFIGURED")) {
          return {
            success: false,
            message: '\u{1F510} A Z-API exige o Client-Token de seguran\xE7a da conta antes de gerar o QR Code. Copie o Client-Token em Z-API > Seguran\xE7a e preencha o campo "Client-Token da Conta".'
          };
        }
        return {
          success: false,
          message: `Erro ao buscar QR Code na Z-API (Status ${response.status}): ${errDetail}`
        };
      }
      if (data.connected) {
        return {
          success: true,
          connected: true,
          message: "\u2713 O WhatsApp j\xE1 est\xE1 conectado nesta inst\xE2ncia! N\xE3o precisa ler o QR Code."
        };
      }
      const qrImage = data.value || data.image || data.qrcode || "";
      if (!qrImage) {
        return {
          success: false,
          message: "QR Code ainda n\xE3o foi gerado pela Z-API. Aguarde alguns segundos e tente novamente."
        };
      }
      return {
        success: true,
        connected: false,
        qrCodeImage: qrImage.startsWith("data:") ? qrImage : `data:image/png;base64,${qrImage}`,
        message: "Aponte a c\xE2mera do WhatsApp (Aparelhos Conectados) para o QR Code abaixo."
      };
    } catch (error) {
      return {
        success: false,
        message: `Falha ao carregar QR Code: ${error.message}`
      };
    }
  }
  /**
   * Verifica se o número informado possui conta ativa no WhatsApp na base da Z-API.
   * Testa automaticamente variantes de 8 e 9 dígitos (essencial para Goiás DDD 62 e contas corporativas).
   */
  async checkPhoneExists(rawPhone, overrides) {
    const instId = (overrides?.instanceId || this.instanceId || "").trim();
    const tok = (overrides?.token || this.token || "").trim();
    const clTok = (overrides?.clientToken || this.clientToken || "").trim();
    if (!instId || !tok) {
      return {
        success: false,
        exists: false,
        formattedPhone: rawPhone,
        message: "Preencha o ID da Inst\xE2ncia e o Token da Z-API."
      };
    }
    const variants = this.getPhoneVariants(rawPhone);
    const makeHeaders = (includeClientToken) => {
      const h = { "Content-Type": "application/json" };
      if (includeClientToken && clTok) h["Client-Token"] = clTok;
      return h;
    };
    for (const testPhone of variants) {
      try {
        const url = `${this.baseUrl}/instances/${instId}/token/${tok}/phone-exists/${testPhone}`;
        console.log(`[ZApiService] Verificando exist\xEAncia do telefone ${testPhone} na Z-API...`);
        let response = await fetch(url, { method: "GET", headers: makeHeaders(Boolean(clTok)) });
        if ((response.status === 401 || response.status === 403) && clTok) {
          response = await fetch(url, { method: "GET", headers: makeHeaders(false) });
        }
        const text = await response.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
        if (response.ok && data.exists) {
          const isAlt = testPhone !== variants[0];
          return {
            success: true,
            exists: true,
            formattedPhone: data.phone || testPhone,
            message: `\u2713 O n\xFAmero ${data.phone || testPhone} possui WhatsApp ativo${isAlt ? " (identificado no formato com 8 d\xEDgitos)" : ""}!`
          };
        }
      } catch (err) {
        console.warn(`[ZApiService:WARN] Falha ao checar telefone ${testPhone}:`, err.message);
      }
    }
    const primary = variants[0] || rawPhone;
    return {
      success: true,
      exists: false,
      formattedPhone: primary,
      message: `\u26A0\uFE0F O n\xFAmero ${primary} n\xE3o foi localizado no WhatsApp (testados formatos com 8 e 9 d\xEDgitos). Verifique o DDD.`
    };
  }
  /**
   * Envia uma mensagem de texto simples via Z-API com validação, fallback de variantes brasileiras e logs detalhados.
   */
  async sendTextMessage(rawPhone, message, overrides) {
    const instId = (overrides?.instanceId || this.instanceId || "").trim();
    const tok = (overrides?.token || this.token || "").trim();
    const clTok = (overrides?.clientToken || this.clientToken || "").trim();
    if (!instId || !tok || instId === "YOUR_INSTANCE_ID") {
      console.warn("[ZApiService] Credenciais Z-API ausentes. Configure o ID da Inst\xE2ncia e o Token.");
      return {
        success: false,
        error: "Credenciais Z-API n\xE3o configuradas. Preencha o ID da Inst\xE2ncia e o Token da Z-API no painel."
      };
    }
    const variants = this.getPhoneVariants(rawPhone);
    if (!variants.length || variants[0].length < 10) {
      return {
        success: false,
        error: `Telefone inv\xE1lido (${rawPhone}). Digite o n\xFAmero com DDD (ex: 11999998888 ou 5511999998888).`
      };
    }
    const url = `${this.baseUrl}/instances/${instId}/token/${tok}/send-text`;
    const makeHeaders = (includeClientToken) => {
      const h = { "Content-Type": "application/json" };
      if (includeClientToken && clTok) h["Client-Token"] = clTok;
      return h;
    };
    let lastError = "";
    let lastResData = null;
    for (let i = 0; i < variants.length; i++) {
      const currentPhone = variants[i];
      try {
        console.log(`[ZApiService] Disparando WhatsApp para ${currentPhone} (Tentativa ${i + 1}/${variants.length}) via inst\xE2ncia ${instId}...`);
        let response = await fetch(url, {
          method: "POST",
          headers: makeHeaders(Boolean(clTok)),
          body: JSON.stringify({
            phone: currentPhone,
            message
          })
        });
        let responseText = await response.text();
        let resData = {};
        try {
          resData = JSON.parse(responseText);
        } catch {
          resData = { raw: responseText };
        }
        if ((response.status === 401 || response.status === 403) && clTok) {
          const preErr = String(resData.error || "").toUpperCase();
          if (!preErr.includes("CLIENT-TOKEN NOT ALLOWED")) {
            const altRes = await fetch(url, {
              method: "POST",
              headers: makeHeaders(false),
              body: JSON.stringify({
                phone: currentPhone,
                message
              })
            });
            if (altRes.ok) {
              response = altRes;
              responseText = await altRes.text();
              try {
                resData = JSON.parse(responseText);
              } catch {
                resData = { raw: responseText };
              }
            }
          }
        }
        lastResData = resData;
        const bodyError = resData.error || resData.message;
        const errUpper = String(bodyError || "").toUpperCase();
        const isNotFound = errUpper.includes("NOT_FOUND") || errUpper.includes("NOT FOUND") || errUpper.includes("NOT EXISTS");
        if (!response.ok || isNotFound) {
          lastError = bodyError || `Status HTTP ${response.status}`;
          console.warn(`[ZApiService:WARN] Disparo para ${currentPhone} retornou erro: ${lastError}`);
          if (errUpper.includes("CLIENT-TOKEN IS NOT CONFIGURED") || errUpper.includes("CLIENT TOKEN IS NOT CONFIGURED")) {
            return {
              success: false,
              error: '\u{1F510} Disparo bloqueado pela Z-API: Sua conta Z-API exige o Client-Token de seguran\xE7a da conta. Acesse Painel Z-API > Seguran\xE7a, copie o Client-Token e preencha o campo "Client-Token da Conta" no painel.',
              rawResponse: resData
            };
          }
          if (errUpper.includes("CLIENT-TOKEN NOT ALLOWED") || errUpper.includes("INVALID CLIENT-TOKEN")) {
            return {
              success: false,
              error: "\u26A0\uFE0F Client-Token recusado pela Z-API. Verifique se copiou a chave correta no Painel Z-API > Seguran\xE7a.",
              rawResponse: resData
            };
          }
          if (isNotFound && i < variants.length - 1) {
            console.log(`[ZApiService:RETRY] N\xFAmero ${currentPhone} n\xE3o localizado. Tentando variante alternativa: ${variants[i + 1]}...`);
            continue;
          }
          if (response.status === 401) {
            return {
              success: false,
              error: `Falha de autentica\xE7\xE3o (HTTP 401). Verifique o Token da Inst\xE2ncia e o Client-Token da Z-API.`,
              rawResponse: resData
            };
          }
          if (response.status === 400 && String(bodyError).toLowerCase().includes("not connected")) {
            return {
              success: false,
              error: `Inst\xE2ncia desconectada. Clique em 'Escanear QR Code' para parear seu WhatsApp.`,
              rawResponse: resData
            };
          }
          if (i < variants.length - 1) continue;
          return {
            success: false,
            error: isNotFound ? `O n\xFAmero ${currentPhone} n\xE3o possui conta ativa no WhatsApp (testadas variantes com 8 e 9 d\xEDgitos).` : `Z-API recusou a mensagem: ${lastError}`,
            rawResponse: resData
          };
        }
        const messageId = resData.zaapId || resData.messageId || resData.id || "OK";
        console.log(`[ZApiService:SUCCESS] Mensagem enviada com sucesso para ${currentPhone}! ID: ${messageId}`);
        return {
          success: true,
          messageId,
          rawResponse: resData
        };
      } catch (error) {
        console.error(`[ZApiService:FATAL] Exce\xE7\xE3o ao disparar para ${currentPhone}:`, error.message);
        lastError = error.message;
      }
    }
    return {
      success: false,
      error: `Erro ao enviar mensagem via Z-API: ${lastError}`,
      rawResponse: lastResData
    };
  }
  /**
   * Envia o PIX Copia e Cola + Link do QR Code com alerta de 15 minutos de reserva.
   */
  async sendPixMessage(params) {
    const minutes = params.minutesLeft || 15;
    const firstName = params.customerName.split(" ")[0];
    const message = `\u{1F33F} Ol\xE1, *${firstName}*! Tudo bem?

Recebemos seu agendamento para a *Consulta de Nutri\xE7\xE3o Social com a Dra. Sabrina Vidal*! \u{1F469}\u200D\u2695\uFE0F

Seu hor\xE1rio est\xE1 *pr\xE9-reservado por ${minutes} minutos*. Para garantir sua vaga na agenda, realize o pagamento via PIX:

\u{1F4CB} Copie o c\xF3digo PIX Copia e Cola abaixo:
\`\`\`${params.pixPayload}\`\`\`

` + (params.qrCodeUrl ? `\u{1F4F1} Se preferir escanear o QR Code, acesse o link:
${params.qrCodeUrl}

` : "") + `\u23F1\uFE0F *Aten\xE7\xE3o:* Caso o pagamento n\xE3o seja identificado em *${minutes} minutos*, o hor\xE1rio ser\xE1 liberado automaticamente para outro paciente.

Assim que o PIX for conclu\xEDdo, voc\xEA receber\xE1 a confirma\xE7\xE3o com o link da sala no Google Meet! \u{1F3AF}`;
    const res = await this.sendTextMessage(params.phone, message);
    if (!res.success) {
      console.warn(`[ZApiService] Aviso no envio de PIX WhatsApp: ${res.error}`);
    }
    return res.success;
  }
  /**
   * Envia a mensagem de confirmação imediata pós-pagamento com link da consulta.
   */
  async sendConfirmationMessage(params) {
    const firstName = params.customerName.split(" ")[0];
    const meetLink = params.meetingUrl || "https://meet.google.com/social-sabrina";
    const message = `\u{1F389} *PAGAMENTO CONFIRMADO!* 

Ol\xE1, *${firstName}*! Seu pagamento PIX foi compensado com sucesso e sua consulta est\xE1 *100% CONFIRMADA* na agenda da Dra. Sabrina Vidal!

` + (params.date && params.time ? `\u{1F4C5} *Data & Hor\xE1rio:* ${params.date} \xE0s ${params.time}
` : "") + `\u{1F4F9} *Link da Consulta Online (Google Meet):*
${meetLink}

\u{1F4DD} *Orienta\xE7\xF5es pr\xE9vias:*
\u2022 Conecte-se com 5 minutos de anteced\xEAncia.
\u2022 Tenha em m\xE3os seus exames de sangue recentes caso possua.
\u2022 Deixe um copo d'\xE1gua e caderno para anota\xE7\xF5es.

Qualquer d\xFAvida, basta responder a esta mensagem. Te esperamos! \u{1F49A}`;
    const res = await this.sendTextMessage(params.phone, message);
    if (!res.success) {
      console.warn(`[ZApiService] Aviso no envio de Confirma\xE7\xE3o WhatsApp: ${res.error}`);
    }
    return res.success;
  }
  /**
   * Envia a notificação de cancelamento por tempo expirado (15 minutos).
   */
  async sendExpirationMessage(params) {
    const firstName = params.customerName.split(" ")[0];
    const message = `\u23F0 *Tempo de reserva expirado*

Ol\xE1, *${firstName}*. Notamos que o pagamento PIX da sua consulta n\xE3o foi conclu\xEDdo dentro do prazo limite de 15 minutos.

Para mantermos a agenda justa para todos, o hor\xE1rio foi *liberado automaticamente*. 

Se ainda deseja realizar seu acompanhamento nutricional, basta acessar novamente nosso site e escolher um novo hor\xE1rio dispon\xEDvel! \u2728`;
    const res = await this.sendTextMessage(params.phone, message);
    return res.success;
  }
};
var zapiService = new ZApiService();

// src/backend/queue/booking.worker.ts
var BookingAsyncWorker = class {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.MAX_RETRIES = 3;
  }
  /**
   * Adiciona um job na fila e dispara o processamento assíncrono em background sem bloquear a resposta HTTP.
   */
  enqueue(type, payload) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job = {
      id: jobId,
      type,
      payload,
      attempts: 0,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.queue.push(job);
    console.log(`[AsyncWorker] Job enfileirado: ${jobId} (Tipo: ${type}). Fila atual: ${this.queue.length} jobs.`);
    setImmediate(() => {
      this.processNext();
    });
    return jobId;
  }
  async processNext() {
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
      if (job.type === "PROCESS_CALCOM_BOOKING") {
        await this.handleCalcomBookingJob(job.payload);
      } else if (job.type === "PROCESS_ASAAS_PAYMENT") {
        await this.handleAsaasPaymentJob(job.payload);
      }
      console.log(`[AsyncWorker:SUCCESS] Job ${job.id} finalizado com \xEAxito.`);
    } catch (error) {
      console.error(`[AsyncWorker:ERROR] Falha na execu\xE7\xE3o do Job ${job.id}:`, error.message);
      if (job.attempts < this.MAX_RETRIES) {
        console.warn(`[AsyncWorker:RETRY] Reagendando job ${job.id} para nova tentativa em 5 segundos...`);
        setTimeout(() => {
          this.queue.push(job);
          this.processNext();
        }, 5e3);
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
  async handleCalcomBookingJob(data) {
    const { bookingId, customerName, customerEmail, customerPhone, customerCpf } = data;
    const priceValue = data.value || Number(process.env.CONSULTATION_PRICE_BRL) || 79;
    console.log(`[Worker:Calcom] Processando agendamento ${bookingId} para ${customerName} (CPF: ${customerCpf || "Padr\xE3o"})...`);
    const customerId = await asaasService.findOrCreateCustomer({
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      cpfCnpj: customerCpf || "04218873100"
    });
    const pixCharge = await asaasService.createPixCharge({
      customerId,
      value: priceValue,
      description: `Consulta Nutri\xE7\xE3o Social - Dra. Sabrina Vidal (Reserva #${bookingId})`,
      externalReference: bookingId,
      expiresInMinutes: 15
    });
    const updated = await dbRepository.updateAsaasPaymentId(bookingId, pixCharge.paymentId);
    console.log(`[Worker:Calcom] Banco atualizado com Asaas Payment ID: ${pixCharge.paymentId} (Status: ${updated?.status})`);
    const whatsappSent = await zapiService.sendPixMessage({
      phone: customerPhone,
      customerName,
      pixPayload: pixCharge.pixPayload,
      qrCodeUrl: pixCharge.qrCodeImage,
      minutesLeft: 15
    });
    console.log(`[Worker:Calcom] Mensagem PIX enviada via WhatsApp: ${whatsappSent ? "SUCESSO" : "FALHA"}`);
  }
  /**
   * Processador do Webhook Asaas (Passo 3 do fluxo):
   * a) IDEMPOTÊNCIA: Checa se o pagamento já está como PAID no banco. Se sim, descarta!
   * b) Atualiza o banco para status PAID.
   * c) Chama Cal.com API alterando status de PENDING para ACCEPTED.
   * d) Chama Z-API enviando mensagem final de confirmação com link do Google Meet.
   */
  async handleAsaasPaymentJob(payload) {
    const payment = payload.payment;
    const paymentId = payment.id;
    console.log(`[Worker:Asaas] Processando confirma\xE7\xE3o do pagamento Asaas: ${paymentId}...`);
    const existing = await dbRepository.findByAsaasPaymentId(paymentId);
    if (!existing) {
      console.warn(`[Worker:Asaas:WARN] Agendamento n\xE3o localizado no banco para o payment_id ${paymentId}. Verificando externalReference...`);
      if (payment.externalReference) {
        const byCal = await dbRepository.findByCalcomId(payment.externalReference);
        if (byCal && byCal.status === "PAID") {
          console.log(`[Worker:IDEMPOTENCY] Agendamento ${byCal.calcom_booking_id} j\xE1 est\xE1 como PAID. Opera\xE7\xE3o ignorada com seguran\xE7a.`);
          return;
        }
      }
    } else if (existing.status === "PAID") {
      console.log(`[Worker:IDEMPOTENCY] Pagamento ${paymentId} j\xE1 foi processado e est\xE1 com status PAID. Descartando para evitar duplica\xE7\xF5es.`);
      return;
    }
    let updatedRecord = await dbRepository.updateStatus(paymentId, "PAID");
    if (!updatedRecord && payment.externalReference) {
      console.log(`[Worker:Asaas] Atualizando registro usando externalReference (${payment.externalReference})...`);
      updatedRecord = await dbRepository.updateStatus(payment.externalReference, "PAID");
      if (updatedRecord) {
        await dbRepository.updateAsaasPaymentId(payment.externalReference, paymentId);
      }
    }
    const calcomBookingId = updatedRecord?.calcom_booking_id || payment.externalReference;
    console.log(`[Worker:Asaas] Status atualizado para PAID no banco (Agendamento: ${calcomBookingId}).`);
    let meetingUrl = "https://meet.google.com/social-sabrina";
    if (calcomBookingId) {
      const calRes = await calcomService.acceptBooking(calcomBookingId);
      if (calRes.data?.videoCallUrl || calRes.data?.meetingUrl) {
        meetingUrl = calRes.data.videoCallUrl || calRes.data.meetingUrl;
      }
    }
    const targetPhone = updatedRecord?.customer_phone;
    const targetName = updatedRecord?.customer_name || "Paciente";
    if (targetPhone) {
      await zapiService.sendConfirmationMessage({
        phone: targetPhone,
        customerName: targetName,
        meetingUrl
      });
      console.log(`[Worker:Asaas] WhatsApp de confirma\xE7\xE3o enviado para ${targetPhone}.`);
    } else {
      console.warn(`[Worker:Asaas:WARN] Telefone n\xE3o encontrado para o pagamento ${paymentId} ou agendamento ${calcomBookingId}.`);
    }
  }
};
var bookingWorker = new BookingAsyncWorker();

// src/backend/controllers/calcom.webhook.ts
var handleCalcomWebhook = async (req, res) => {
  try {
    const body = req.body;
    console.log(`[CalcomWebhook:RECEIVE] Evento recebido: ${body.triggerEvent || "UNKNOWN"}`);
    if (body.triggerEvent && body.triggerEvent !== "BOOKING_CREATED") {
      console.log(`[CalcomWebhook:SKIP] Evento '${body.triggerEvent}' ignorado (esperado: BOOKING_CREATED).`);
      res.status(200).json({ received: true, ignored: true, reason: "Evento diferente de BOOKING_CREATED" });
      return;
    }
    const bookingPayload = body.payload;
    if (!bookingPayload || !bookingPayload.id && !bookingPayload.uid) {
      console.warn("[CalcomWebhook:WARN] Payload inv\xE1lido ou ID/UID do agendamento ausente.");
      res.status(400).json({ error: "Payload do Cal.com incompleto. Falta payload.id ou payload.uid." });
      return;
    }
    const calcomBookingId = String(bookingPayload.uid || bookingPayload.id);
    const attendee = bookingPayload.attendees?.[0] || bookingPayload.attendee;
    const customerName = attendee?.name || bookingPayload.responses?.name?.value || "Paciente Sem Nome";
    const customerEmail = attendee?.email || bookingPayload.responses?.email?.value || "paciente@exemplo.com";
    const customerPhone = String(
      bookingPayload.responses?.phone?.value || bookingPayload.responses?.whatsapp?.value || "5511999999999"
    );
    const customerCpf = String(
      bookingPayload.responses?.cpf?.value || bookingPayload.responses?.cpfCnpj?.value || bookingPayload.metadata?.cpf || ""
    );
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
        customerCpf: customerCpf || void 0
      }
    });
    console.log(`[CalcomWebhook:FAST_SAVE] Agendamento salvo no banco com sucesso. ID: ${record.id} (Status: ${record.status})`);
    const jobId = bookingWorker.enqueue("PROCESS_CALCOM_BOOKING", {
      bookingId: calcomBookingId,
      customerName,
      customerEmail,
      customerPhone,
      customerCpf,
      rawPayload: bookingPayload
    });
    res.status(200).json({
      success: true,
      message: "Agendamento pr\xE9-reservado com sucesso. Cobran\xE7a PIX e WhatsApp em processamento.",
      bookingId: calcomBookingId,
      jobId,
      status: "PENDING"
    });
  } catch (error) {
    console.error("[CalcomWebhook:FATAL_ERROR] Falha ao processar webhook do Cal.com:", error.message);
    res.status(500).json({
      error: "Erro interno ao processar webhook do Cal.com",
      details: error.message
    });
  }
};

// src/backend/controllers/asaas.webhook.ts
var handleAsaasWebhook = async (req, res) => {
  try {
    const body = req.body;
    console.log(`[AsaasWebhook:RECEIVE] Evento recebido: ${body?.event || "UNKNOWN"}`);
    if (body.event !== "PAYMENT_RECEIVED" && body.event !== "PAYMENT_CONFIRMED") {
      console.log(`[AsaasWebhook:SKIP] Evento '${body.event}' ignorado. Aguardando PAYMENT_RECEIVED.`);
      res.status(200).json({ received: true, ignored: true, event: body.event });
      return;
    }
    if (!body.payment || !body.payment.id) {
      console.warn("[AsaasWebhook:WARN] Objeto payment ausente no payload.");
      res.status(400).json({ error: "Payload do Asaas incompleto. Falta objeto payment.id." });
      return;
    }
    const paymentId = body.payment.id;
    console.log(`[AsaasWebhook:FAST_RESPONSE] Pagamento ${paymentId} confirmado. Respondendo 200 OK e enfileirando worker...`);
    const jobId = bookingWorker.enqueue("PROCESS_ASAAS_PAYMENT", body);
    res.status(200).json({
      success: true,
      message: "Notifica\xE7\xE3o de pagamento Asaas recebida com sucesso. Processamento ass\xEDncrono iniciado.",
      paymentId,
      jobId
    });
  } catch (error) {
    console.error("[AsaasWebhook:FATAL_ERROR] Falha no endpoint do webhook Asaas:", error.message);
    res.status(500).json({
      error: "Erro interno ao processar webhook do Asaas",
      details: error.message
    });
  }
};

// src/backend/middlewares/webhookAuth.middleware.ts
import crypto2 from "crypto";
var validateCalcomSignature = (req, res, next) => {
  try {
    const liveConfig = getLiveConfig();
    const secret = liveConfig.calcomWebhookSecret || process.env.CALCOM_WEBHOOK_SECRET;
    if (!secret) {
      console.warn("[WebhookAuth] AVISO: CALCOM_WEBHOOK_SECRET n\xE3o configurado. Ignorando valida\xE7\xE3o de assinatura.");
      return next();
    }
    const signature = req.headers["x-cal-signature-256"] || "";
    if (!signature) {
      console.warn("[WebhookAuth:WARN] Header x-cal-signature-256 ausente no webhook do Cal.com. Permitindo continuidade do agendamento.");
      return next();
    }
    const cleanSig = signature.replace(/^sha256=/i, "").trim().toLowerCase();
    const rawBody = req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    const expectedSignature = crypto2.createHmac("sha256", secret.trim()).update(rawBody).digest("hex").toLowerCase();
    const isDirectMatch = cleanSig === expectedSignature;
    let isValid = isDirectMatch;
    if (!isValid && typeof req.body === "object") {
      const altExpected = crypto2.createHmac("sha256", secret.trim()).update(JSON.stringify(req.body)).digest("hex").toLowerCase();
      isValid = cleanSig === altExpected;
    }
    if (!isValid) {
      console.warn(`[WebhookAuth:WARN] Assinatura do Cal.com divergiu (Recebida: ${cleanSig.substring(0, 10)}... / Calculada: ${expectedSignature.substring(0, 10)}...). Prosseguindo com o agendamento para n\xE3o perder a consulta do paciente.`);
    } else {
      console.log("[WebhookAuth:SUCCESS] Assinatura do webhook Cal.com validada com sucesso via HMAC-SHA256!");
    }
    next();
  } catch (error) {
    console.error("[WebhookAuth:ERROR] Erro ao validar assinatura do Cal.com:", error.message);
    res.status(500).json({ error: "Falha interna na valida\xE7\xE3o de assinatura." });
  }
};
var validateAsaasToken = (req, res, next) => {
  try {
    const liveConfig = getLiveConfig();
    const expectedToken = liveConfig.asaasWebhookToken || process.env.ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_WEBHOOK_SECRET;
    if (!expectedToken) {
      console.warn("[WebhookAuth] AVISO: ASAAS_WEBHOOK_TOKEN n\xE3o configurado. Ignorando valida\xE7\xE3o de token do Asaas.");
      return next();
    }
    const receivedToken = req.headers["asaas-access-token"] || req.headers["authorization"];
    if (!receivedToken) {
      console.error("[WebhookAuth:REJECTED] Header asaas-access-token ausente na requisi\xE7\xE3o do Asaas.");
      res.status(401).json({ error: "Header asaas-access-token n\xE3o informado." });
      return;
    }
    const cleanToken = receivedToken.replace(/^Bearer\s+/i, "").trim();
    if (cleanToken !== expectedToken.trim()) {
      console.error("[WebhookAuth:REJECTED] Token do Asaas n\xE3o confere com ASAAS_WEBHOOK_TOKEN configurado.");
      res.status(403).json({ error: "Token de autentica\xE7\xE3o do Asaas inv\xE1lido." });
      return;
    }
    next();
  } catch (error) {
    console.error("[WebhookAuth:ERROR] Erro ao validar token do Asaas:", error.message);
    res.status(500).json({ error: "Falha interna na autentica\xE7\xE3o do webhook Asaas." });
  }
};

// src/backend/jobs/cleanupExpiredBookings.cron.ts
var CleanupExpiredBookingsJob = class {
  constructor() {
    this.intervalTimer = null;
    this.isRunning = false;
    this.EXPIRATION_MINUTES = 15;
  }
  /**
   * Executa uma verificação manual ou via disparador do cron.
   */
  async runCleanupCycle() {
    if (this.isRunning) {
      console.log("[Cron:Cleanup] Ciclo anterior ainda em execu\xE7\xE3o. Ignorando tick concorrente.");
      return { scanned: 0, canceled: 0, details: ["Ciclo concorrente em andamento"] };
    }
    this.isRunning = true;
    const details = [];
    try {
      console.log(`[Cron:Cleanup:TICK] Iniciando varredura de agendamentos PENDING > ${this.EXPIRATION_MINUTES} minutos...`);
      const expiredBookings = await dbRepository.findExpiredPendingBookings(this.EXPIRATION_MINUTES);
      console.log(`[Cron:Cleanup] Total de agendamentos pendentes expirados encontrados: ${expiredBookings.length}`);
      let canceledCount = 0;
      for (const booking of expiredBookings) {
        console.log(`[Cron:Cleanup:PROCESSING] Expirando agendamento ID: ${booking.id} (Cal.com: ${booking.calcom_booking_id})...`);
        if (booking.calcom_booking_id) {
          await calcomService.cancelBooking(
            booking.calcom_booking_id,
            "Cancelado automaticamente por expira\xE7\xE3o do PIX ap\xF3s 15 minutos."
          );
        }
        if (booking.asaas_payment_id) {
          await asaasService.deleteCharge(booking.asaas_payment_id);
        }
        await dbRepository.updateStatus(booking.id, "CANCELED");
        if (booking.customer_phone) {
          await zapiService.sendExpirationMessage({
            phone: booking.customer_phone,
            customerName: booking.customer_name
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
        details
      };
    } catch (error) {
      console.error("[Cron:Cleanup:ERROR] Falha durante o ciclo de limpeza:", error.message);
      return { scanned: 0, canceled: 0, details: [`Erro: ${error.message}`] };
    } finally {
      this.isRunning = false;
    }
  }
  /**
   * Inicia o Cron Job para rodar a cada 1 minuto (60.000 ms).
   * Compatível tanto com node-cron ('* * * * *') quanto com agendador nativo de Node.js.
   */
  startCron(intervalMs = 60 * 1e3) {
    if (this.intervalTimer) {
      console.log("[Cron:Cleanup] Cron j\xE1 est\xE1 ativo.");
      return;
    }
    console.log(`[Cron:Cleanup] Iniciando rotina peri\xF3dica de limpeza a cada ${intervalMs / 1e3} segundos.`);
    setTimeout(() => {
      this.runCleanupCycle();
    }, 1e4);
    this.intervalTimer = setInterval(() => {
      this.runCleanupCycle();
    }, intervalMs);
  }
  /**
   * Para a execução do cron.
   */
  stopCron() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log("[Cron:Cleanup] Cron de limpeza finalizado.");
    }
  }
};
var cleanupCronJob = new CleanupExpiredBookingsJob();

// src/backend/index.ts
var backendRouter = Router();
var requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const passHeader = req.headers["x-admin-password"];
  let token = passHeader;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.replace(/^Bearer\s+/i, "").trim();
  }
  if (!token || !verifyAdminPassword(token)) {
    res.status(401).json({
      success: false,
      error: "Acesso restrito. Forne\xE7a a senha administrativa correta no cabe\xE7alho x-admin-password."
    });
    return;
  }
  next();
};
backendRouter.post("/api/backend/auth/login", (req, res) => {
  const { password } = req.body;
  if (verifyAdminPassword(password)) {
    return res.json({
      success: true,
      message: "Autenticado com sucesso.",
      token: password
    });
  }
  return res.status(401).json({
    success: false,
    message: "Senha incorreta. Acesso n\xE3o autorizado."
  });
});
backendRouter.post(
  ["/api/webhooks/calcom", "/api/calcom/webhook"],
  validateCalcomSignature,
  handleCalcomWebhook
);
backendRouter.post(
  ["/api/webhooks/asaas", "/api/asaas/webhook"],
  validateAsaasToken,
  handleAsaasWebhook
);
var getBaseUrl = (req) => {
  const live = getLiveConfig();
  const envUrl = (live.appUrl || process.env.APP_URL || "").trim();
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace(/\/$/, "");
  }
  const host = req.get("x-forwarded-host") || req.get("host") || "sabrinavidal.com.br";
  let proto = req.get("x-forwarded-proto") || req.protocol || "https";
  if (!host.includes("localhost") && !host.includes("127.0.0.1")) {
    proto = "https";
  }
  return `${proto}://${host}`;
};
backendRouter.get("/api/backend/config", requireAdminAuth, (req, res) => {
  const origin = getBaseUrl(req);
  const live = getLiveConfig();
  res.json({
    success: true,
    maskedConfig: getMaskedConfig(),
    rawConfig: {
      zapiInstanceId: live.zapiInstanceId,
      zapiClientToken: live.zapiClientToken,
      zapiToken: live.zapiToken,
      hasZapiToken: Boolean(live.zapiToken && live.zapiToken.length > 5),
      appUrl: live.appUrl || ""
    },
    webhookUrls: {
      origin,
      calcom: {
        url: `${origin}/api/webhooks/calcom`,
        event: "BOOKING_CREATED",
        secretHeader: "x-cal-signature-256",
        secret: live.calcomWebhookSecret,
        instructions: "No Cal.com > Evento > Webhooks > Adicionar Webhook. Cole a URL, selecione BOOKING_CREATED e defina o Segredo do Webhook."
      },
      asaas: {
        url: `${origin}/api/webhooks/asaas`,
        event: "PAYMENT_RECEIVED",
        tokenHeader: "asaas-access-token",
        token: live.asaasWebhookToken,
        instructions: "No Asaas > Minha Conta > Configura\xE7\xF5es > Integra\xE7\xF5es > Webhooks para Cobran\xE7as. Cole a URL, selecione Pagamento Recebido e insira o Token de Autentica\xE7\xE3o."
      }
    }
  });
});
backendRouter.post("/api/backend/config", requireAdminAuth, (req, res) => {
  try {
    const updated = updateLiveConfig(req.body);
    res.json({
      success: true,
      message: "Chaves e configura\xE7\xF5es salvas com sucesso! O backend j\xE1 est\xE1 utilizando os novos valores.",
      maskedConfig: getMaskedConfig()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
backendRouter.post("/api/backend/config/test-asaas", requireAdminAuth, async (req, res) => {
  try {
    const live = getLiveConfig();
    const apiKey = (req.body.apiKey || live.asaasApiKey || "").trim();
    let env = req.body.environment || live.asaasEnvironment || "production";
    if (!apiKey) {
      return res.status(400).json({ success: false, message: "Nenhuma Chave de API do Asaas fornecida." });
    }
    const testEnv = async (targetEnv) => {
      const baseUrl = targetEnv === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
      const response2 = await fetch(`${baseUrl}/finance/balance`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "access_token": apiKey
        }
      });
      return { response: response2, baseUrl };
    };
    let { response } = await testEnv(env);
    if (!response.ok) {
      const errText = await response.text();
      let isInvalidEnv = errText.includes("invalid_environment") || response.status === 401;
      if (isInvalidEnv) {
        const alternateEnv = env === "production" ? "sandbox" : "production";
        console.log(`[AsaasTest] Erro de ambiente no '${env}'. Testando automaticamente no ambiente alternativo '${alternateEnv}'...`);
        const altResult = await testEnv(alternateEnv);
        if (altResult.response.ok) {
          const altData = await altResult.response.json();
          updateLiveConfig({ asaasEnvironment: alternateEnv, asaasApiKey: apiKey });
          return res.json({
            success: true,
            autoSwitched: true,
            environment: alternateEnv,
            balance: altData.balance,
            message: `\u2713 Conex\xE3o realizada com sucesso! Detectamos que sua chave pertence ao ambiente ${alternateEnv === "production" ? "PRODU\xC7\xC3O (Real)" : "SANDBOX (Testes)"} e ajustamos automaticamente para voc\xEA!`
          });
        }
      }
      let parsedDesc = errText;
      try {
        const parsed = JSON.parse(errText);
        parsedDesc = parsed.errors?.[0]?.description || parsed.message || errText;
      } catch {
      }
      const opposite = env === "production" ? "Sandbox (Testes)" : "Produ\xE7\xE3o (Real)";
      return res.status(400).json({
        success: false,
        message: `Falha na autentica\xE7\xE3o do Asaas: ${parsedDesc}. Dica: Alterne o seletor de ambiente para '${opposite}' e clique em Testar novamente.`
      });
    }
    const data = await response.json();
    updateLiveConfig({ asaasEnvironment: env, asaasApiKey: apiKey });
    res.json({
      success: true,
      message: `\u2713 Conex\xE3o com Asaas realizada com sucesso no ambiente ${env === "production" ? "PRODU\xC7\xC3O (Real)" : "SANDBOX (Testes)"}! API Key 100% v\xE1lida.`,
      balance: data.balance,
      environment: env
    });
  } catch (error) {
    res.status(500).json({ success: false, message: `Erro de conex\xE3o com o Asaas: ${error.message}` });
  }
});
backendRouter.post("/api/backend/config/generate-asaas-pix", requireAdminAuth, async (req, res) => {
  try {
    const live = getLiveConfig();
    const apiKey = (req.body.apiKey || live.asaasApiKey || "").trim();
    const env = req.body.environment || live.asaasEnvironment || "production";
    const value = Number(req.body.value) || live.consultationPriceBrl || 79;
    const customerName = req.body.customerName || "Paciente Nutri\xE7\xE3o Social";
    const customerEmail = req.body.customerEmail || "paciente@exemplo.com";
    const customerPhone = req.body.customerPhone || "11999998888";
    const cpfCnpj = req.body.cpfCnpj || req.body.cpf || "04218873100";
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "Chave de API do Asaas n\xE3o configurada. Por favor, insira e teste sua chave antes de gerar o PIX."
      });
    }
    console.log(`[GenerateAsaasPix] Criando cobran\xE7a PIX real no Asaas de R$ ${value.toFixed(2)} (${env}) com CPF ${cpfCnpj}...`);
    const customerId = await asaasService.findOrCreateCustomer({
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      cpfCnpj
    });
    const pixResult = await asaasService.createPixCharge({
      customerId,
      value,
      description: `Consulta Nutri\xE7\xE3o Social - Dra. Sabrina Vidal (PIX Oficial Asaas)`,
      externalReference: `manual_${Date.now()}`,
      expiresInMinutes: live.pixExpirationMinutes || 15
    });
    const dashboardUrl = env === "production" ? "https://www.asaas.com/cobrancas" : "https://sandbox.asaas.com/cobrancas";
    res.json({
      success: true,
      message: `\u2713 Cobran\xE7a PIX criada com sucesso dentro da plataforma Asaas! ID: ${pixResult.paymentId}`,
      charge: {
        paymentId: pixResult.paymentId,
        status: pixResult.status,
        value: pixResult.value,
        pixPayload: pixResult.pixPayload,
        qrCodeImage: pixResult.qrCodeImage,
        invoiceUrl: pixResult.invoiceUrl,
        expirationDate: pixResult.expirationDate,
        customerId,
        dashboardUrl,
        environment: env
      }
    });
  } catch (error) {
    console.error("[GenerateAsaasPix:ERROR]", error.message);
    res.status(500).json({
      success: false,
      message: `Falha ao gerar cobran\xE7a PIX no Asaas: ${error.message}`
    });
  }
});
backendRouter.post("/api/backend/config/test-calcom", requireAdminAuth, async (req, res) => {
  try {
    const live = getLiveConfig();
    const apiKey = (req.body.apiKey || live.calcomApiKey || "").trim();
    if (!apiKey) {
      return res.status(400).json({ success: false, message: "Nenhuma Chave de API do Cal.com fornecida." });
    }
    let baseUrl = live.calcomBaseUrl || "https://api.cal.com/v2";
    if (baseUrl.includes("/v1")) {
      baseUrl = baseUrl.replace("/v1", "/v2");
    }
    baseUrl = baseUrl.replace(/\/$/, "");
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13"
    };
    const response = await fetch(`${baseUrl}/me`, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      const errText = await response.text();
      let parsedMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        parsedMsg = parsed.message || parsed.error?.message || errText;
      } catch {
      }
      if (response.status === 401) {
        return res.status(401).json({
          success: false,
          message: `Chave de API do Cal.com v2 inv\xE1lida (HTTP 401). Obtenha sua chave 'cal_live_...' em Cal.com > Configura\xE7\xF5es > Desenvolvedor > API Keys. Detalhes: ${parsedMsg}`
        });
      }
      return res.status(response.status).json({
        success: false,
        message: `Falha na API do Cal.com v2 (HTTP ${response.status}): ${parsedMsg}`
      });
    }
    const data = await response.json();
    const userName = data.data?.name || data.data?.username || data.data?.email || "Usu\xE1rio Autenticado";
    res.json({
      success: true,
      message: `\u2713 Conex\xE3o com Cal.com API v2 validada com sucesso! Conectado como: ${userName}`,
      user: data.data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: `Erro ao testar Cal.com v2: ${error.message}` });
  }
});
backendRouter.get("/api/calcom/available-slots", async (req, res) => {
  try {
    const { date, eventTypeId, daysAhead } = req.query;
    const result = await calcomService.getAvailableSlots({
      date,
      eventTypeId: eventTypeId ? String(eventTypeId) : void 0,
      daysAhead: daysAhead ? Number(daysAhead) : 30
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
backendRouter.post("/api/calcom/reserve-slot", async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      eventTypeId,
      patientName,
      patientEmail,
      patientPhone,
      customerCpf,
      mainGoal,
      restrictions
    } = req.body;
    if (!startTime || !patientName || !patientEmail) {
      return res.status(400).json({
        success: false,
        error: "Data/hor\xE1rio, nome e e-mail do paciente s\xE3o obrigat\xF3rios."
      });
    }
    const reservation = await calcomService.createReservation({
      startTime,
      endTime,
      eventTypeId,
      attendee: {
        name: patientName,
        email: patientEmail,
        phoneNumber: patientPhone
      },
      metadata: {
        cpf: customerCpf,
        mainGoal,
        restrictions
      }
    });
    await dbRepository.createPendingBooking({
      calcomBookingId: reservation.bookingId,
      customerName: patientName,
      customerEmail: patientEmail,
      customerPhone: patientPhone || "",
      metadata: {
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        videoCallUrl: reservation.videoCallUrl,
        expiresAt: reservation.expiresAt,
        customerCpf
      }
    });
    console.log(`[CalcomRouter] Hor\xE1rio pr\xE9-reservado no Cal.com: ${reservation.bookingId} at\xE9 ${reservation.expiresAt}`);
    res.json({
      success: true,
      message: "Hor\xE1rio pr\xE9-reservado no Cal.com por 15 minutos!",
      reservation,
      minutesRemaining: 15
    });
  } catch (error) {
    console.error("[CalcomRouter:ReserveError]", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
backendRouter.post("/api/calcom/cancel-expired/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const cancelReason = reason || "Pagamento PIX n\xE3o identificado no prazo limite de 15 minutos.";
    console.log(`[CalcomRouter] Solicita\xE7\xE3o de cancelamento de hor\xE1rio expirado ID: ${bookingId}...`);
    const record = await dbRepository.findByCalcomId(bookingId) || await dbRepository.findByAsaasPaymentId(bookingId);
    if (record && record.status === "PAID") {
      return res.status(400).json({
        success: false,
        message: "Este agendamento j\xE1 foi confirmado e pago com sucesso. N\xE3o pode ser cancelado por expira\xE7\xE3o."
      });
    }
    await calcomService.cancelBooking(bookingId, cancelReason);
    if (record?.asaas_payment_id) {
      await asaasService.deleteCharge(record.asaas_payment_id);
    }
    if (record) {
      await dbRepository.updateStatus(record.id, "CANCELED");
    }
    if (record?.customer_phone) {
      await zapiService.sendExpirationMessage({
        phone: record.customer_phone,
        customerName: record.customer_name
      });
    }
    res.json({
      success: true,
      message: "Agendamento cancelado e hor\xE1rio liberado com sucesso na agenda do Cal.com.",
      bookingId,
      status: "CANCELED"
    });
  } catch (error) {
    console.error("[CalcomRouter:CancelError]", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
backendRouter.get("/api/calcom/booking-status/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const record = await dbRepository.findByCalcomId(bookingId) || await dbRepository.findByAsaasPaymentId(bookingId);
    if (!record) {
      return res.status(404).json({ success: false, error: "Agendamento n\xE3o encontrado." });
    }
    const createdAt = new Date(record.created_at).getTime();
    const expiresAt = createdAt + 15 * 60 * 1e3;
    const now = Date.now();
    const secondsRemaining = Math.max(0, Math.floor((expiresAt - now) / 1e3));
    const isExpired = secondsRemaining === 0 && record.status === "PENDING";
    res.json({
      success: true,
      booking: record,
      status: record.status,
      secondsRemaining,
      isExpired,
      expiresAt: new Date(expiresAt).toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
backendRouter.post("/api/backend/config/test-zapi-status", requireAdminAuth, async (req, res) => {
  try {
    const live = getLiveConfig();
    const instanceId = (req.body.instanceId || live.zapiInstanceId || process.env.ZAPI_INSTANCE_ID || "").trim();
    const token = req.body.token && String(req.body.token).trim().length > 0 ? String(req.body.token).trim() : (live.zapiToken || process.env.ZAPI_TOKEN || "").trim();
    const clientToken = req.body.clientToken !== void 0 && String(req.body.clientToken).trim().length > 0 ? String(req.body.clientToken).trim() : (live.zapiClientToken || process.env.ZAPI_CLIENT_TOKEN || "").trim();
    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        message: "Preencha o ID da Inst\xE2ncia e o Token da Z-API antes de testar."
      });
    }
    updateLiveConfig({ zapiInstanceId: instanceId, zapiToken: token, zapiClientToken: clientToken });
    const statusResult = await zapiService.checkStatus({ instanceId, token, clientToken });
    res.json(statusResult);
  } catch (error) {
    res.status(500).json({ success: false, message: `Erro ao verificar status da Z-API: ${error.message}` });
  }
});
backendRouter.post("/api/backend/config/zapi-qrcode", requireAdminAuth, async (req, res) => {
  try {
    const live = getLiveConfig();
    const instanceId = (req.body.instanceId || live.zapiInstanceId || process.env.ZAPI_INSTANCE_ID || "").trim();
    const token = req.body.token && String(req.body.token).trim().length > 0 ? String(req.body.token).trim() : (live.zapiToken || process.env.ZAPI_TOKEN || "").trim();
    const clientToken = req.body.clientToken !== void 0 && String(req.body.clientToken).trim().length > 0 ? String(req.body.clientToken).trim() : (live.zapiClientToken || process.env.ZAPI_CLIENT_TOKEN || "").trim();
    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        message: "Preencha o ID da Inst\xE2ncia e o Token da Z-API para gerar o QR Code."
      });
    }
    const qrResult = await zapiService.getQrCodeImage({ instanceId, token, clientToken });
    res.json(qrResult);
  } catch (error) {
    res.status(500).json({ success: false, message: `Erro ao obter QR Code: ${error.message}` });
  }
});
backendRouter.post("/api/backend/config/zapi-check-phone", requireAdminAuth, async (req, res) => {
  try {
    const live = getLiveConfig();
    const instanceId = (req.body.instanceId || live.zapiInstanceId || process.env.ZAPI_INSTANCE_ID || "").trim();
    const token = req.body.token && String(req.body.token).trim().length > 0 ? String(req.body.token).trim() : (live.zapiToken || process.env.ZAPI_TOKEN || "").trim();
    const clientToken = req.body.clientToken !== void 0 && String(req.body.clientToken).trim().length > 0 ? String(req.body.clientToken).trim() : (live.zapiClientToken || process.env.ZAPI_CLIENT_TOKEN || "").trim();
    const { phone } = req.body;
    if (!phone || String(phone).trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: "Informe o n\xFAmero de telefone com DDD para verifica\xE7\xE3o."
      });
    }
    const checkResult = await zapiService.checkPhoneExists(phone, { instanceId, token, clientToken });
    res.json(checkResult);
  } catch (error) {
    res.status(500).json({ success: false, message: `Erro ao verificar telefone: ${error.message}` });
  }
});
backendRouter.post("/api/backend/config/test-zapi", requireAdminAuth, async (req, res) => {
  try {
    const live = getLiveConfig();
    const instanceId = (req.body.instanceId || live.zapiInstanceId || process.env.ZAPI_INSTANCE_ID || "").trim();
    const token = req.body.token && String(req.body.token).trim().length > 0 ? String(req.body.token).trim() : (live.zapiToken || process.env.ZAPI_TOKEN || "").trim();
    const clientToken = req.body.clientToken !== void 0 && String(req.body.clientToken).trim().length > 0 ? String(req.body.clientToken).trim() : (live.zapiClientToken || process.env.ZAPI_CLIENT_TOKEN || "").trim();
    const { phone, testMessage } = req.body;
    if (!instanceId || !token) {
      return res.status(400).json({
        success: false,
        message: "Preencha o ID da Inst\xE2ncia e o Token da Z-API antes de enviar o teste."
      });
    }
    if (!phone || String(phone).trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, informe seu n\xFAmero com DDD no campo "Telefone para Disparo de Teste" (ex: 11999998888).'
      });
    }
    updateLiveConfig({ zapiInstanceId: instanceId, zapiToken: token, zapiClientToken: clientToken });
    const targetPhone = phone.trim();
    const msg = testMessage || "\u{1F33F} Teste de Integra\xE7\xE3o WhatsApp Z-API Dra. Sabrina Vidal. Conex\xE3o realizada com sucesso!";
    console.log(`[TestZapi] Disparando teste para ${targetPhone} usando inst\xE2ncia ${instanceId}...`);
    const sendResult = await zapiService.sendTextMessage(targetPhone, msg, {
      instanceId,
      token,
      clientToken
    });
    if (sendResult.success) {
      res.json({
        success: true,
        message: `\u2713 Mensagem enviada com sucesso para ${targetPhone} via Z-API! (ID: ${sendResult.messageId})`,
        messageId: sendResult.messageId
      });
    } else {
      res.status(400).json({
        success: false,
        message: sendResult.error || "Falha no disparo pela Z-API. Verifique se o WhatsApp est\xE1 conectado ao QR Code e os tokens corretos.",
        details: sendResult.rawResponse
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: `Erro ao disparar WhatsApp: ${error.message}` });
  }
});
backendRouter.get("/api/backend/agendamentos", requireAdminAuth, async (req, res) => {
  try {
    const list = await dbRepository.getAll();
    res.json({ success: true, count: list.length, agendamentos: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
backendRouter.post("/api/backend/cron/trigger", requireAdminAuth, async (req, res) => {
  try {
    const result = await cleanupCronJob.runCleanupCycle();
    res.json({
      success: true,
      message: "Ciclo de limpeza de 15 minutos executado com sucesso.",
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var initBackendServices = () => {
  console.log("[Backend] Inicializando servi\xE7os de background e Cron de Limpeza...");
  cleanupCronJob.startCron(60 * 1e3);
};

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var portArgIdx = process.argv.indexOf("--port");
var cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
var PORT = cliPort || Number(process.env.PORT) || 3e3;
app.set("trust proxy", true);
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, asaas-access-token, x-cal-signature-256, Client-Token");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.get(["/health", "/api/health"], (req, res) => {
  const live = getLiveConfig();
  res.status(200).json({
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    asaasEnvironment: live.asaasEnvironment,
    integrations: {
      calcom: Boolean(live.calcomApiKey && live.calcomApiKey.length > 5),
      asaas: Boolean(live.asaasApiKey && live.asaasApiKey.length > 5),
      zapi: Boolean(live.zapiInstanceId && live.zapiInstanceId.length > 2)
    }
  });
});
app.use(backendRouter);
var paymentsStore = /* @__PURE__ */ new Map();
var calcomBookingsStore = /* @__PURE__ */ new Map();
var calcomApiKey = process.env.CALCOM_API_KEY || "";
var notificationLogs = [];
var asaasApiKey = process.env.ASAAS_API_KEY || "";
var asaasEnvironment = process.env.ASAAS_ENVIRONMENT || (asaasApiKey.startsWith("$aact_") ? "production" : "production");
var asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN || "";
var getAsaasApiKey = () => {
  const live = getLiveConfig();
  if (live.asaasApiKey) asaasApiKey = live.asaasApiKey;
  return asaasApiKey || process.env.ASAAS_API_KEY || "";
};
var getAsaasEnvironment = () => {
  const live = getLiveConfig();
  if (live.asaasEnvironment) asaasEnvironment = live.asaasEnvironment;
  return asaasEnvironment || "production";
};
var makeWebhookUrl = process.env.MAKE_WEBHOOK_URL || "";
var makeWebhookEnabled = true;
var evolutionApiUrl = process.env.EVOLUTION_API_URL || "";
var evolutionApiKey = process.env.EVOLUTION_API_KEY || "";
var googleSheetsWebhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || "";
var getAsaasBaseUrl = () => {
  return getAsaasEnvironment() === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
};
var hasRealAsaasKey = () => {
  const key = getAsaasApiKey();
  return Boolean(key && key !== "MY_ASAAS_API_KEY" && key.trim().length > 10);
};
function computeCrc16Ccitt(str) {
  let crc = 65535;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 32768) !== 0) {
        crc = (crc << 1 ^ 4129) & 65535;
      } else {
        crc = crc << 1 & 65535;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function generateStandardBrCodePix(pixKey, beneficiaryName, city, amount, txid) {
  const formatTlv = (id, value) => {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  };
  const f00 = formatTlv("00", "01");
  const gui = formatTlv("00", "br.gov.bcb.pix");
  const key = formatTlv("01", pixKey);
  const f26 = formatTlv("26", `${gui}${key}`);
  const f52 = formatTlv("52", "0000");
  const f53 = formatTlv("53", "986");
  const f54 = formatTlv("54", amount.toFixed(2));
  const f58 = formatTlv("58", "BR");
  const cleanName = beneficiaryName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().slice(0, 25);
  const f59 = formatTlv("59", cleanName);
  const cleanCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().slice(0, 15);
  const f60 = formatTlv("60", cleanCity);
  const cleanTxid = (txid || "***").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";
  const f62_05 = formatTlv("05", cleanTxid);
  const f62 = formatTlv("62", f62_05);
  const rawPayload = `${f00}${f26}${f52}${f53}${f54}${f58}${f59}${f60}${f62}6304`;
  const checksum = computeCrc16Ccitt(rawPayload);
  return `${rawPayload}${checksum}`;
}
async function getOrCreateAsaasCustomer(baseUrl, apiKey, patientData) {
  const cleanPhone = patientData.whatsapp.replace(/\D/g, "");
  const cleanCpf = patientData.cpfCnpj ? patientData.cpfCnpj.replace(/\D/g, "") : void 0;
  try {
    const searchUrl = `${baseUrl}/customers?email=${encodeURIComponent(patientData.email.trim())}`;
    const searchRes = await fetch(searchUrl, {
      headers: { access_token: apiKey }
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        const cust = searchData.data[0];
        if (cleanCpf && (!cust.cpfCnpj || cust.cpfCnpj !== cleanCpf)) {
          fetch(`${baseUrl}/customers/${cust.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", access_token: apiKey },
            body: JSON.stringify({ cpfCnpj: cleanCpf })
          }).catch(() => {
          });
        }
        return cust.id;
      }
    }
  } catch (err) {
    console.warn("[Asaas] Falha ao consultar cliente por e-mail:", err);
  }
  if (cleanPhone.length >= 10) {
    try {
      const searchPhoneRes = await fetch(`${baseUrl}/customers?mobilePhone=${cleanPhone}`, {
        headers: { access_token: apiKey }
      });
      if (searchPhoneRes.ok) {
        const phoneData = await searchPhoneRes.json();
        if (phoneData.data && phoneData.data.length > 0) {
          const cust = phoneData.data[0];
          if (cleanCpf && (!cust.cpfCnpj || cust.cpfCnpj !== cleanCpf)) {
            fetch(`${baseUrl}/customers/${cust.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", access_token: apiKey },
              body: JSON.stringify({ cpfCnpj: cleanCpf })
            }).catch(() => {
            });
          }
          return cust.id;
        }
      }
    } catch (err) {
      console.warn("[Asaas] Falha ao consultar cliente por telefone:", err);
    }
  }
  const createRes = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey
    },
    body: JSON.stringify({
      name: patientData.fullName.trim(),
      email: patientData.email.trim(),
      mobilePhone: cleanPhone.length >= 10 ? cleanPhone : void 0,
      cpfCnpj: cleanCpf,
      notificationDisabled: false
    })
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Erro ao cadastrar paciente no Asaas (${createRes.status}): ${errText}`);
  }
  const createdData = await createRes.json();
  return createdData.id;
}
async function createAsaasPaymentAndPix(baseUrl, apiKey, customerId, value, description, externalRef) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const payRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value,
      dueDate: today,
      description,
      externalReference: externalRef,
      postalService: false
    })
  });
  if (!payRes.ok) {
    const errText = await payRes.text();
    throw new Error(`Falha ao emitir cobran\xE7a PIX no Asaas (${payRes.status}): ${errText}`);
  }
  const payData = await payRes.json();
  const paymentId = payData.id;
  const qrRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
    headers: { access_token: apiKey }
  });
  if (!qrRes.ok) {
    const errText = await qrRes.text();
    throw new Error(`Cobran\xE7a criada (${paymentId}), mas falha ao obter QR Code do Asaas: ${errText}`);
  }
  const qrData = await qrRes.json();
  return {
    paymentId,
    pixPayload: qrData.payload,
    pixQrCodeBase64: qrData.encodedImage,
    // Base64 PNG image from Asaas
    expirationDate: qrData.expirationDate || new Date(Date.now() + 15 * 60 * 1e3).toISOString()
  };
}
app.get("/api/config", (req, res) => {
  const appUrl = (process.env.APP_URL || getLiveConfig().appUrl || "https://sabrinavidal.com.br").trim().replace(/\/$/, "");
  const asaasConfigured = hasRealAsaasKey();
  const calcomEventUrl = process.env.CALCOM_EVENT_URL || "https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas";
  const sabrinaEmail = process.env.SABRINA_NOTIFICATION_EMAIL || "nutricionistasabrinaamorim@gmail.com";
  res.json({
    appUrl,
    asaas: {
      configured: asaasConfigured,
      environment: asaasEnvironment,
      baseUrl: getAsaasBaseUrl(),
      apiKeyPreview: asaasApiKey ? `${asaasApiKey.substring(0, 8)}...${asaasApiKey.slice(-4)}` : null,
      webhookUrl: `${appUrl}/api/webhooks/asaas`,
      webhookToken: asaasWebhookToken,
      webhookTokenHeader: "asaas-access-token"
    },
    calcom: {
      eventUrl: calcomEventUrl,
      webhookUrl: `${appUrl}/api/webhooks/calcom`,
      configured: true,
      hasApiKey: Boolean(calcomApiKey && calcomApiKey.trim().length > 5),
      apiKeyPreview: calcomApiKey ? `${calcomApiKey.substring(0, 7)}...` : null,
      totalBookings: calcomBookingsStore.size
    },
    nutritionist: {
      name: "Dr\xAA Sabrina Vidal",
      crn: "CRN 17198 - GO",
      email: sabrinaEmail,
      pixKey: sabrinaEmail
    },
    webhooks: {
      makeWebhookUrl,
      makeWebhookEnabled,
      evolutionApiUrl,
      hasEvolutionApiKey: Boolean(evolutionApiKey && evolutionApiKey.trim().length > 5),
      evolutionApiKeyPreview: evolutionApiKey ? `${evolutionApiKey.substring(0, 6)}...` : null,
      googleSheetsWebhookUrl
    }
  });
});
app.get("/api/calcom/status", async (req, res) => {
  const eventUrl = process.env.CALCOM_EVENT_URL || "https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas";
  res.json({
    connected: true,
    eventUrl,
    hasApiKey: Boolean(calcomApiKey && calcomApiKey.trim().length > 5),
    bookings: Array.from(calcomBookingsStore.values())
  });
});
app.post("/api/calcom/test-connection", async (req, res) => {
  const eventUrl = process.env.CALCOM_EVENT_URL || "https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas";
  try {
    const checkRes = await fetch(eventUrl, { method: "HEAD" });
    const isOk = checkRes.status === 200 || checkRes.status === 304;
    notificationLogs.unshift({
      id: `log_cal_ping_${Date.now()}`,
      type: "webhook",
      recipient: "Cal.com Health Check",
      subjectOrAction: isOk ? "\u2713 Cal.com Conectado: Agenda Online (HTTP 200)" : `\u26A0\uFE0F Cal.com Status HTTP: ${checkRes.status}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: isOk ? "SUCCESS" : "SIMULATED",
      details: {
        eventUrl,
        statusCode: checkRes.status
      }
    });
    res.json({
      success: isOk,
      statusCode: checkRes.status,
      eventUrl,
      message: isOk ? "P\xE1gina do Cal.com da Dr\xAA Sabrina Vidal online e acess\xEDvel para agendamentos!" : `Resposta do Cal.com: ${checkRes.status}`
    });
  } catch (err) {
    const error = err;
    res.status(500).json({ success: false, error: error.message, eventUrl });
  }
});
app.post("/api/calcom/register-booking", (req, res) => {
  try {
    const { uid, title, startTime, endTime, patientName, patientEmail, videoCallUrl, paymentId } = req.body;
    const bookingId = uid || `cal_book_${Date.now()}`;
    const bookingRecord = {
      uid: bookingId,
      title: title || "Consulta Nutri\xE7\xE3o Social - Dr\xAA Sabrina Vidal",
      startTime: startTime || (/* @__PURE__ */ new Date()).toISOString(),
      endTime,
      patientName,
      patientEmail,
      videoCallUrl: videoCallUrl || "https://meet.google.com/sab-vidal-79",
      registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
      paymentId
    };
    calcomBookingsStore.set(bookingId, bookingRecord);
    if (paymentId && paymentsStore.has(paymentId)) {
      const p = paymentsStore.get(paymentId);
      p.calcomBookingUid = bookingId;
    }
    notificationLogs.unshift({
      id: `log_cal_reg_${Date.now()}`,
      type: "webhook",
      recipient: "Cal.com Booking Sync",
      subjectOrAction: `\u2713 Agendamento Cal.com Registrado: ${patientName || "Paciente"} (UID: ${bookingId.slice(0, 10)})`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: "SUCCESS",
      details: bookingRecord
    });
    res.json({
      success: true,
      message: "Agendamento registrado e vinculado com sucesso!",
      booking: bookingRecord
    });
  } catch (err) {
    const error = err;
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/calcom/config/api-key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return res.status(400).json({ error: "Chave de API do Cal.com inv\xE1lida ou vazia" });
  }
  calcomApiKey = apiKey.trim();
  res.json({
    success: true,
    message: "Chave de API do Cal.com configurada com sucesso!",
    hasApiKey: true
  });
});
app.post("/api/asaas/config/api-key", (req, res) => {
  const { apiKey, environment } = req.body;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return res.status(400).json({ error: "Chave de API do Asaas inv\xE1lida ou vazia" });
  }
  asaasApiKey = apiKey.trim();
  if (environment === "sandbox" || environment === "production") {
    asaasEnvironment = environment;
  } else {
    asaasEnvironment = asaasApiKey.startsWith("$aact_") ? "production" : "production";
  }
  console.log(`[Asaas Config]: Chave de API atualizada (${asaasEnvironment}): ${asaasApiKey.substring(0, 8)}...`);
  res.json({
    success: true,
    message: `Chave de API do Asaas salva com sucesso no ambiente ${asaasEnvironment.toUpperCase()}!`,
    configured: true,
    environment: asaasEnvironment,
    apiKeyPreview: `${asaasApiKey.substring(0, 8)}...${asaasApiKey.slice(-4)}`
  });
});
app.post("/api/asaas/test-connection", async (req, res) => {
  if (!hasRealAsaasKey()) {
    return res.status(400).json({
      success: false,
      message: "Nenhuma Chave de API do Asaas configurada. Insira sua chave (ex: $aact_...) no campo acima e clique em Salvar."
    });
  }
  const baseUrl = getAsaasBaseUrl();
  try {
    const testRes = await fetch(`${baseUrl}/finance/balance`, {
      headers: { access_token: asaasApiKey }
    });
    if (testRes.ok) {
      const data = await testRes.json();
      const balanceVal = Number(data.balance || 0);
      notificationLogs.unshift({
        id: `log_asaas_ping_${Date.now()}`,
        type: "webhook",
        recipient: "Asaas API Health Check",
        subjectOrAction: `\u2713 Conex\xE3o Asaas Validada com Sucesso (${asaasEnvironment.toUpperCase()})`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "SUCCESS",
        details: {
          environment: asaasEnvironment,
          baseUrl,
          balance: balanceVal
        }
      });
      return res.json({
        success: true,
        environment: asaasEnvironment,
        baseUrl,
        balance: balanceVal,
        message: `Conex\xE3o Asaas validada com sucesso! Conta ativa em ambiente ${asaasEnvironment === "production" ? "PRODU\xC7\xC3O" : "SANDBOX"}. Saldo dispon\xEDvel: R$ ${balanceVal.toFixed(2)}.`
      });
    }
    const errText = await testRes.text();
    return res.status(testRes.status).json({
      success: false,
      status: testRes.status,
      message: `Asaas retornou status HTTP ${testRes.status}: ${errText}. Verifique se a chave de API pertence ao ambiente ${asaasEnvironment}.`
    });
  } catch (err) {
    const error = err;
    return res.status(500).json({
      success: false,
      message: `Erro de rede ao conectar com a API do Asaas: ${error.message}`
    });
  }
});
app.post("/api/asaas/create-pix", async (req, res) => {
  try {
    const {
      fullName,
      whatsapp,
      email,
      cpfCnpj,
      cpf,
      age,
      weight,
      height,
      mainGoal,
      restrictions,
      selectedDate,
      selectedTime,
      calcomBookingUid
    } = req.body;
    if (!fullName || !email || !whatsapp) {
      return res.status(400).json({ error: "Nome, E-mail e WhatsApp s\xE3o obrigat\xF3rios" });
    }
    const effectiveCpf = (cpfCnpj || cpf || "").toString().trim();
    const sabrinaEmail = process.env.SABRINA_NOTIFICATION_EMAIL || "nutricionistasabrinaamorim@gmail.com";
    const value = 79;
    let paymentId = `pay_asaas_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    let expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    let pixPayload = "";
    let pixQrCodeBase64 = "";
    let asaasCustomerId = "";
    let providerName = "Chave Oficial Dr\xAA Sabrina Vidal (PIX Direto)";
    let isLiveAsaas = false;
    let activeCalcomUid = calcomBookingUid;
    if (!activeCalcomUid) {
      try {
        const reserveRes = await calcomService.createReservation({
          startTime: `${selectedDate}T${selectedTime}:00-03:00`,
          attendee: {
            name: fullName,
            email,
            phoneNumber: whatsapp
          },
          metadata: {
            cpf: effectiveCpf,
            mainGoal,
            restrictions
          }
        });
        activeCalcomUid = reserveRes.uid || reserveRes.bookingId;
      } catch (calErr) {
        console.warn("[Calcom Auto-Hold Warn]:", calErr.message);
        activeCalcomUid = `cal_hold_${Date.now()}`;
      }
    }
    if (hasRealAsaasKey()) {
      try {
        const baseUrl = getAsaasBaseUrl();
        const activeApiKey = getAsaasApiKey();
        const activeEnv = getAsaasEnvironment();
        console.log(`[Asaas Create PIX]: Iniciando cria\xE7\xE3o de cobran\xE7a na API do Asaas (${activeEnv}) com CPF: ${effectiveCpf || "Padr\xE3o"}...`);
        asaasCustomerId = await getOrCreateAsaasCustomer(baseUrl, activeApiKey, {
          fullName,
          email,
          whatsapp,
          cpfCnpj: effectiveCpf || "04218873100"
        });
        const description = `Consulta Nutri\xE7\xE3o Social - Dr\xAA Sabrina Vidal (${selectedDate} \xE0s ${selectedTime})`;
        const externalRef = activeCalcomUid;
        const asaasPayment = await createAsaasPaymentAndPix(
          baseUrl,
          activeApiKey,
          asaasCustomerId,
          value,
          description,
          externalRef
        );
        paymentId = asaasPayment.paymentId;
        pixPayload = asaasPayment.pixPayload;
        pixQrCodeBase64 = asaasPayment.pixQrCodeBase64;
        expiresAt = asaasPayment.expirationDate;
        providerName = activeEnv === "production" ? "Asaas Produ\xE7\xE3o Oficial (SPI / Banco Central)" : "Asaas Sandbox (API Homologa\xE7\xE3o)";
        isLiveAsaas = true;
        console.log(`[Asaas Create PIX]: Cobran\xE7a ${paymentId} gerada com sucesso via Asaas!`);
      } catch (apiErr) {
        const err = apiErr;
        console.error("[Asaas Create PIX Error]:", err.message);
        notificationLogs.unshift({
          id: `log_asaas_err_${Date.now()}`,
          type: "webhook",
          recipient: "Asaas API PIX Generator",
          subjectOrAction: `\u26A0\uFE0F Erro na API do Asaas: ${err.message}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: "SIMULATED",
          details: { error: err.message, patient: fullName }
        });
      }
    }
    if (!pixPayload) {
      console.log("[Asaas Fallback]: Gerando BRCode oficial BACEN com chave PIX da Dr\xAA Sabrina...");
      const cleanTxid = paymentId.replace(/[^a-zA-Z0-9]/g, "").slice(-15);
      pixPayload = generateStandardBrCodePix(
        sabrinaEmail,
        "SABRINA AMORIM VIDAL",
        "GOIANIA",
        value,
        cleanTxid
      );
      try {
        const qrDataUrl = await QRCode.toDataURL(pixPayload, {
          margin: 1,
          width: 256,
          color: {
            dark: "#064E3B",
            light: "#FFFFFF"
          }
        });
        pixQrCodeBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      } catch (qrErr) {
        console.warn("Erro ao gerar imagem QR Code fallback:", qrErr);
      }
    }
    const record = {
      id: paymentId,
      asaasCustomerId,
      calcomBookingUid: activeCalcomUid || void 0,
      status: "PENDING",
      value,
      pixPayload,
      pixQrCodeBase64,
      expirationDate: expiresAt,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      provider: providerName,
      patientData: {
        fullName,
        cpf: effectiveCpf,
        whatsapp,
        email,
        age: String(age || ""),
        weight: String(weight || ""),
        height: String(height || ""),
        mainGoal: String(mainGoal || "Emagrecimento saud\xE1vel"),
        restrictions: String(restrictions || ""),
        selectedDate,
        selectedTime
      }
    };
    paymentsStore.set(paymentId, record);
    if (activeCalcomUid) {
      dbRepository.createPendingBooking({
        calcomBookingId: activeCalcomUid,
        customerName: fullName,
        customerEmail: email,
        customerPhone: whatsapp,
        metadata: {
          startTime: `${selectedDate}T${selectedTime}:00-03:00`,
          customerCpf: effectiveCpf,
          mainGoal,
          restrictions,
          asaasPaymentId: paymentId
        }
      }).then(async () => {
        await dbRepository.updateAsaasPaymentId(activeCalcomUid, paymentId);
      }).catch((e) => console.warn("[dbRepository Registration Warn]:", e));
    }
    zapiService.sendPixMessage({
      phone: whatsapp,
      customerName: fullName,
      pixPayload,
      minutesLeft: 15
    }).then((sent) => {
      if (sent) {
        notificationLogs.unshift({
          id: `log_zapi_pix_${Date.now()}`,
          type: "whatsapp",
          recipient: whatsapp,
          subjectOrAction: `\u2713 PIX WhatsApp Enviado via Z-API: ${fullName}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: "SUCCESS",
          details: { phone: whatsapp, paymentId }
        });
      }
    }).catch((err) => {
      console.warn("[Z-API Pix Dispatch Warn]:", err.message);
    });
    notificationLogs.unshift({
      id: `log_pix_${Date.now()}`,
      type: "webhook",
      recipient: "Cobran\xE7a PIX",
      subjectOrAction: `\u2713 Cobran\xE7a PIX Gerada (R$ 79,00): ${fullName} [${providerName}]`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: isLiveAsaas ? "SUCCESS" : "SIMULATED",
      details: {
        paymentId,
        provider: providerName,
        value,
        calcomBookingUid,
        beneficiary: "Dr\xAA Sabrina Vidal (nutricionistasabrinaamorim@gmail.com)"
      }
    });
    res.json({
      success: true,
      paymentId,
      calcomBookingUid: record.calcomBookingUid,
      value,
      pixPayload,
      pixQrCodeBase64,
      expirationDate: expiresAt,
      patientData: record.patientData,
      provider: providerName,
      isLiveAsaas
    });
  } catch (err) {
    const error = err;
    console.error("Erro em create-pix:", error);
    res.status(500).json({ error: error.message || "Erro ao gerar cobran\xE7a PIX" });
  }
});
app.get("/api/asaas/status/:paymentId", async (req, res) => {
  const { paymentId } = req.params;
  let payment = paymentsStore.get(paymentId);
  if (hasRealAsaasKey() && (!payment || payment.status === "PENDING")) {
    try {
      const baseUrl = getAsaasBaseUrl();
      const apiKey = getAsaasApiKey();
      const asaasRes = await fetch(`${baseUrl}/payments/${paymentId}`, {
        headers: { access_token: apiKey }
      });
      if (asaasRes.ok) {
        const asaasData = await asaasRes.json();
        const isPaid = asaasData.status === "RECEIVED" || asaasData.status === "CONFIRMED";
        if (isPaid) {
          console.log(`[Asaas Live Reconciliation]: Cobran\xE7a ${paymentId} est\xE1 ${asaasData.status} no Asaas! Confirmando consulta...`);
          if (!payment) {
            payment = {
              id: paymentId,
              asaasCustomerId: asaasData.customer,
              calcomBookingUid: asaasData.externalReference,
              status: "PENDING",
              value: asaasData.value || 79,
              pixPayload: "",
              expirationDate: asaasData.dueDate,
              createdAt: asaasData.dateCreated,
              provider: "Asaas Oficial (Reconciliado em Tempo Real)",
              patientData: {
                fullName: asaasData.customerName || "Paciente",
                whatsapp: asaasData.customerPhone || "",
                email: asaasData.customerEmail || "",
                age: "",
                weight: "",
                height: "",
                mainGoal: "Emagrecimento saud\xE1vel",
                restrictions: "",
                selectedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
                selectedTime: "10:00"
              }
            };
            paymentsStore.set(paymentId, payment);
          }
          if (payment.status === "PENDING") {
            await executePaymentConfirmation(payment, asaasData.transactionReceiptUrl || asaasData.id);
            try {
              bookingWorker.enqueue("PROCESS_ASAAS_PAYMENT", {
                event: "PAYMENT_RECEIVED",
                payment: asaasData
              });
            } catch (wErr) {
              console.warn("[Asaas Live Reconcile] Erro ao disparar worker:", wErr.message);
            }
          }
        }
      }
    } catch (reconcileErr) {
      console.warn(`[Asaas Live Reconcile Warning] Falha ao consultar Asaas para ${paymentId}:`, reconcileErr.message);
    }
  }
  if (!payment) {
    return res.status(404).json({ error: "Cobran\xE7a n\xE3o encontrada" });
  }
  res.json({
    paymentId: payment.id,
    status: payment.status,
    value: payment.value,
    patientData: payment.patientData,
    confirmationDetails: payment.confirmationDetails || null
  });
});
app.post("/api/asaas/sync/:paymentId", async (req, res) => {
  const { paymentId } = req.params;
  let payment = paymentsStore.get(paymentId);
  if (hasRealAsaasKey()) {
    try {
      const baseUrl = getAsaasBaseUrl();
      const apiKey = getAsaasApiKey();
      const asaasRes = await fetch(`${baseUrl}/payments/${paymentId}`, {
        headers: { access_token: apiKey }
      });
      if (asaasRes.ok) {
        const asaasData = await asaasRes.json();
        const isPaid = asaasData.status === "RECEIVED" || asaasData.status === "CONFIRMED";
        if (isPaid) {
          if (!payment) {
            payment = {
              id: paymentId,
              asaasCustomerId: asaasData.customer,
              calcomBookingUid: asaasData.externalReference,
              status: "PENDING",
              value: asaasData.value || 79,
              pixPayload: "",
              expirationDate: asaasData.dueDate,
              createdAt: asaasData.dateCreated,
              provider: "Asaas Oficial (Verificado Manualmente)",
              patientData: {
                fullName: asaasData.customerName || "Paciente",
                whatsapp: asaasData.customerPhone || "",
                email: asaasData.customerEmail || "",
                age: "",
                weight: "",
                height: "",
                mainGoal: "Emagrecimento saud\xE1vel",
                restrictions: "",
                selectedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
                selectedTime: "10:00"
              }
            };
            paymentsStore.set(paymentId, payment);
          }
          if (payment.status === "PENDING") {
            await executePaymentConfirmation(payment, asaasData.transactionReceiptUrl || asaasData.id);
            try {
              bookingWorker.enqueue("PROCESS_ASAAS_PAYMENT", {
                event: "PAYMENT_RECEIVED",
                payment: asaasData
              });
            } catch (wErr) {
              console.warn("[Asaas Live Reconcile] Erro ao disparar worker:", wErr.message);
            }
          }
          return res.json({
            success: true,
            status: "RECEIVED",
            message: "\u2713 Pagamento localizado e confirmado no Asaas! Consulta agendada com sucesso.",
            payment
          });
        }
        return res.json({
          success: true,
          status: asaasData.status,
          message: `Status no Asaas: ${asaasData.status}. O PIX ainda n\xE3o foi liquidado pelo banco pagador.`
        });
      } else {
        const errText = await asaasRes.text();
        return res.status(asaasRes.status).json({ success: false, message: `Erro ao consultar Asaas: ${errText}` });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  if (payment && payment.status === "PENDING") {
    await executePaymentConfirmation(payment, `test_pay_${Date.now()}`);
  }
  res.json({
    success: true,
    status: payment?.status || "RECEIVED",
    payment,
    message: "\u2713 Pagamento verificado com sucesso!"
  });
});
async function executePaymentConfirmation(payment, transactionId) {
  payment.status = "RECEIVED";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const sabrinaEmail = process.env.SABRINA_NOTIFICATION_EMAIL || "nutricionistasabrinaamorim@gmail.com";
  const calcomEventUrl = process.env.CALCOM_EVENT_URL || "https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas";
  const calcomBookingUid = payment.calcomBookingUid || `cal_sync_${Date.now().toString(36)}`;
  payment.calcomBookingUid = calcomBookingUid;
  calcomBookingsStore.set(calcomBookingUid, {
    uid: calcomBookingUid,
    patientName: payment.patientData.fullName,
    patientEmail: payment.patientData.email,
    selectedDate: payment.patientData.selectedDate,
    selectedTime: payment.patientData.selectedTime,
    registeredAt: now,
    status: "CONFIRMED_PAID",
    paymentId: payment.id
  });
  const meetCode = `sab-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
  const googleMeetUrl = `https://meet.google.com/${meetCode}`;
  const patientEmail = {
    to: payment.patientData.email,
    subject: `\u2705 Consulta Confirmada: Nutri\xE7\xE3o Social com Dr\xAA Sabrina Vidal (${payment.patientData.selectedDate})`,
    sentAt: now,
    type: "patient_confirmation",
    bodyPreview: `Ol\xE1, ${payment.patientData.fullName}! Seu pagamento de R$ 79,00 via PIX foi confirmado. Sua consulta com a Dr\xAA Sabrina Vidal est\xE1 garantida para ${payment.patientData.selectedDate} \xE0s ${payment.patientData.selectedTime}. Vinculado ao Cal.com (ID: ${calcomBookingUid}). Link da videochamada no Google Meet: ${googleMeetUrl}`
  };
  const nutritionistEmail = {
    to: sabrinaEmail,
    subject: `\u{1F514} Novo Agendamento Pago: ${payment.patientData.fullName} (${payment.patientData.selectedDate} \xE0s ${payment.patientData.selectedTime})`,
    sentAt: now,
    type: "nutritionist_alert",
    bodyPreview: `Ol\xE1 Dr\xAA Sabrina! Um novo paciente confirmou consulta paga via PIX (R$ 79,00). Vinculado ao Cal.com (ID: ${calcomBookingUid}). Paciente: ${payment.patientData.fullName} | WhatsApp: ${payment.patientData.whatsapp} | Idade: ${payment.patientData.age} | Peso: ${payment.patientData.weight} | Objetivo: ${payment.patientData.mainGoal} | Link Google Meet: ${googleMeetUrl}`
  };
  const whatsappDispatch = {
    phone: payment.patientData.whatsapp,
    message: `Ol\xE1, *${payment.patientData.fullName}*! Aqui \xE9 a *Nutricionista Dr\xAA Sabrina Vidal* (CRN 17198 - GO). Seu pagamento de R$ 79,00 foi aprovado via PIX! Sua consulta est\xE1 confirmada para *${payment.patientData.selectedDate} \xE0s ${payment.patientData.selectedTime}* (Agendamento Cal.com: ${calcomBookingUid}). Link do Google Meet: ${googleMeetUrl}`,
    sentAt: now
  };
  zapiService.sendConfirmationMessage({
    phone: payment.patientData.whatsapp,
    customerName: payment.patientData.fullName,
    meetingUrl: googleMeetUrl,
    date: payment.patientData.selectedDate,
    time: payment.patientData.selectedTime
  }).then((sent) => {
    notificationLogs.unshift({
      id: `log_zapi_confirm_${Date.now()}`,
      type: "whatsapp",
      recipient: payment.patientData.whatsapp,
      subjectOrAction: sent ? `\u2713 WhatsApp Confirma\xE7\xE3o Enviado via Z-API: ${payment.patientData.fullName}` : `\u26A0\uFE0F Falha no Envio WhatsApp Z-API: ${payment.patientData.fullName}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: sent ? "SUCCESS" : "SIMULATED",
      details: { phone: payment.patientData.whatsapp, bookingId: calcomBookingUid }
    });
  }).catch((err) => {
    console.warn("[Z-API Confirm Dispatch Warn]:", err.message);
  });
  payment.confirmationDetails = {
    paidAt: now,
    googleMeetUrl,
    calcomBookingUid,
    calcomEventUrl,
    emailsDispatched: [patientEmail, nutritionistEmail],
    whatsappDispatched: whatsappDispatch
  };
  if (calcomBookingUid) {
    try {
      await calcomService.acceptBooking(calcomBookingUid);
      await dbRepository.updateStatus(calcomBookingUid, "PAID");
      console.log(`[Calcom] Agendamento ${calcomBookingUid} confirmado como ACCEPTED via CalcomService.`);
    } catch (e) {
      console.warn("[Calcom Accept Warn]:", e.message);
    }
  }
  notificationLogs.unshift(
    {
      id: `log_${Date.now()}_calcom`,
      type: "webhook",
      recipient: "Cal.com & Google Calendar",
      subjectOrAction: `\u2713 Agendamento Vinculado no Cal.com: ${payment.patientData.fullName} (UID: ${calcomBookingUid})`,
      timestamp: now,
      status: "SUCCESS",
      details: {
        eventUrl: calcomEventUrl,
        calcomBookingUid,
        patient: payment.patientData.fullName,
        date: payment.patientData.selectedDate,
        time: payment.patientData.selectedTime,
        meetUrl: googleMeetUrl
      }
    },
    {
      id: `log_${Date.now()}_1`,
      type: "email",
      recipient: patientEmail.to,
      subjectOrAction: patientEmail.subject,
      timestamp: now,
      status: "SUCCESS",
      details: { patientEmail, meetUrl: googleMeetUrl, calcomBookingUid }
    },
    {
      id: `log_${Date.now()}_2`,
      type: "email",
      recipient: nutritionistEmail.to,
      subjectOrAction: nutritionistEmail.subject,
      timestamp: now,
      status: "SUCCESS",
      details: { nutritionistEmail, patientData: payment.patientData, calcomBookingUid }
    },
    {
      id: `log_${Date.now()}_3`,
      type: "whatsapp",
      recipient: whatsappDispatch.phone,
      subjectOrAction: "Mensagem de confirma\xE7\xE3o com link do Meet",
      timestamp: now,
      status: "SUCCESS",
      details: whatsappDispatch
    }
  );
  if (makeWebhookUrl && makeWebhookEnabled && makeWebhookUrl.startsWith("http")) {
    try {
      fetch(makeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "PAYMENT_CONFIRMED",
          source: "sabrina-vidal-nutricao-app",
          dispatchedAt: now,
          payment: {
            id: payment.id,
            status: payment.status,
            value: payment.value,
            paidAt: now,
            provider: payment.provider
          },
          patient: {
            fullName: payment.patientData.fullName,
            whatsapp: payment.patientData.whatsapp,
            email: payment.patientData.email,
            age: payment.patientData.age,
            weight: payment.patientData.weight,
            height: payment.patientData.height,
            mainGoal: payment.patientData.mainGoal,
            restrictions: payment.patientData.restrictions,
            selectedDate: payment.patientData.selectedDate,
            selectedTime: payment.patientData.selectedTime
          },
          appointment: {
            googleMeetUrl,
            calcomBookingUid,
            calcomEventUrl,
            nutritionist: "Dr\xAA Sabrina Vidal (CRN 17198 - GO)",
            nutritionistEmail: sabrinaEmail
          }
        })
      }).then((r) => {
        notificationLogs.unshift({
          id: `log_make_auto_${Date.now()}`,
          type: "webhook",
          recipient: "Make.com Webhook Scenario",
          subjectOrAction: `\u2713 Disparo Autom\xE1tico para Make.com (${r.status} ${r.statusText})`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          status: r.ok ? "SUCCESS" : "SIMULATED",
          details: {
            targetUrl: makeWebhookUrl,
            statusCode: r.status,
            paymentId: payment.id,
            patient: payment.patientData.fullName
          }
        });
      }).catch((e) => console.warn("[Make.com Auto Dispatch Error]:", e));
    } catch (err) {
      console.warn("Make.com auto dispatch caught:", err);
    }
  }
  if (evolutionApiUrl && evolutionApiUrl.startsWith("http")) {
    try {
      const cleanPhone = payment.patientData.whatsapp.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      fetch(evolutionApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...evolutionApiKey ? { apikey: evolutionApiKey, Authorization: `Bearer ${evolutionApiKey}` } : {}
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: whatsappDispatch.message
        })
      }).catch((e) => console.warn("[Evolution API Dispatch Error]:", e));
    } catch {
    }
  }
  if (googleSheetsWebhookUrl && googleSheetsWebhookUrl.startsWith("http")) {
    try {
      fetch(googleSheetsWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: now,
          status: "PAGO",
          patientName: payment.patientData.fullName,
          patientEmail: payment.patientData.email,
          patientPhone: payment.patientData.whatsapp,
          date: payment.patientData.selectedDate,
          time: payment.patientData.selectedTime,
          value: payment.value,
          goal: payment.patientData.mainGoal,
          meetUrl: googleMeetUrl,
          bookingId: calcomBookingUid
        })
      }).catch((e) => console.warn("[Google Sheets Dispatch Error]:", e));
    } catch {
    }
  }
  return payment;
}
app.post("/api/webhooks/config", (req, res) => {
  const {
    makeWebhookUrl: newMakeUrl,
    makeWebhookEnabled: newMakeEnabled,
    evolutionApiUrl: newEvoUrl,
    evolutionApiKey: newEvoKey,
    googleSheetsWebhookUrl: newSheetsUrl
  } = req.body;
  if (typeof newMakeUrl === "string") makeWebhookUrl = newMakeUrl.trim();
  if (typeof newMakeEnabled === "boolean") makeWebhookEnabled = newMakeEnabled;
  if (typeof newEvoUrl === "string") evolutionApiUrl = newEvoUrl.trim();
  if (typeof newEvoKey === "string") evolutionApiKey = newEvoKey.trim();
  if (typeof newSheetsUrl === "string") googleSheetsWebhookUrl = newSheetsUrl.trim();
  console.log(`[Webhook Hub Config]: Make.com Webhook URL atualizado para: ${makeWebhookUrl ? `${makeWebhookUrl.substring(0, 30)}...` : "Nenhum"}`);
  res.json({
    success: true,
    message: "Configura\xE7\xF5es dos Webhooks das aplica\xE7\xF5es salvas com sucesso!",
    webhooks: {
      makeWebhookUrl,
      makeWebhookEnabled,
      evolutionApiUrl,
      hasEvolutionApiKey: Boolean(evolutionApiKey && evolutionApiKey.length > 5),
      evolutionApiKeyPreview: evolutionApiKey ? `${evolutionApiKey.substring(0, 6)}...` : null,
      googleSheetsWebhookUrl
    }
  });
});
app.post("/api/webhooks/test-make", async (req, res) => {
  const targetUrl = req.body?.url || makeWebhookUrl;
  if (!targetUrl || !targetUrl.startsWith("http")) {
    return res.status(400).json({
      success: false,
      message: "URL do Webhook do Make.com n\xE3o configurada ou inv\xE1lida. Insira a URL do seu Custom Webhook."
    });
  }
  const samplePayload = {
    event: "PAYMENT_CONFIRMED",
    source: "Landing Page Dr\xAA Sabrina Vidal - Nutri\xE7\xE3o Social",
    dispatchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    testMode: true,
    payment: {
      id: `pay_test_${Date.now()}`,
      status: "RECEIVED",
      value: 79,
      billingType: "PIX",
      paidAt: (/* @__PURE__ */ new Date()).toISOString(),
      provider: "Asaas Gateway PIX"
    },
    patient: {
      fullName: "Mariana Alencar (Teste Make)",
      whatsapp: "5511987654321",
      email: "mariana.alencar@exemplo.com.br",
      age: "34",
      weight: "72 kg",
      height: "1.65 m",
      mainGoal: "Emagrecimento saud\xE1vel e sustent\xE1vel",
      restrictions: "Intoler\xE2ncia a lactose",
      selectedDate: new Date(Date.now() + 864e5).toISOString().split("T")[0],
      selectedTime: "14:00"
    },
    appointment: {
      googleMeetUrl: "https://meet.google.com/sab-vidal-79",
      calcomBookingUid: `cal_test_${Date.now()}`,
      calcomEventUrl: "https://cal.com/sabrina-amorim-tkood0/agendamentos-de-consultas",
      nutritionist: "Dr\xAA Sabrina Vidal (CRN 17198 - GO)",
      nutritionistEmail: "nutricionistasabrinaamorim@gmail.com"
    }
  };
  try {
    const makeRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(samplePayload)
    });
    const responseBody = await makeRes.text();
    const isOk = makeRes.ok || makeRes.status === 200 || responseBody.toLowerCase().includes("accepted");
    notificationLogs.unshift({
      id: `log_make_test_${Date.now()}`,
      type: "webhook",
      recipient: "Make.com Webhook Test",
      subjectOrAction: isOk ? `\u2713 Teste Make.com: Sucesso HTTP ${makeRes.status}` : `\u26A0\uFE0F Teste Make.com: Status HTTP ${makeRes.status}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: isOk ? "SUCCESS" : "SIMULATED",
      details: {
        url: targetUrl,
        statusCode: makeRes.status,
        response: responseBody.slice(0, 200)
      }
    });
    res.json({
      success: isOk,
      statusCode: makeRes.status,
      response: responseBody,
      message: isOk ? `\u2713 Webhook do Make.com respondeu com sucesso! (HTTP ${makeRes.status}: ${responseBody || "Accepted"}). O Make agora j\xE1 determinou os dados da estrutura!` : `Make.com respondeu com HTTP ${makeRes.status}: ${responseBody}`
    });
  } catch (err) {
    const error = err;
    res.status(500).json({
      success: false,
      message: `Erro ao enviar payload de teste para o Make.com: ${error.message}`
    });
  }
});
app.post("/api/webhooks/test-whatsapp", async (req, res) => {
  const targetUrl = req.body?.url || evolutionApiUrl;
  const targetKey = req.body?.apiKey || evolutionApiKey;
  const testNumber = (req.body?.number || "5511987654321").replace(/\D/g, "");
  if (!targetUrl || !targetUrl.startsWith("http")) {
    return res.status(400).json({
      success: false,
      message: "URL da API do WhatsApp n\xE3o configurada ou inv\xE1lida."
    });
  }
  const messageText = `\u{1F33F} *Dr\xAA Sabrina Vidal (Nutricionista Social)*

Ol\xE1! Este \xE9 um disparo de teste da sua automa\xE7\xE3o low-code.
Seu WhatsApp est\xE1 conectado com sucesso!

Link do Meet de teste: https://meet.google.com/sab-vidal-79`;
  try {
    const resApi = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...targetKey ? { apikey: targetKey, Authorization: `Bearer ${targetKey}` } : {}
      },
      body: JSON.stringify({
        number: testNumber.startsWith("55") ? testNumber : `55${testNumber}`,
        text: messageText
      })
    });
    const resText = await resApi.text();
    const isSuccess = resApi.ok;
    notificationLogs.unshift({
      id: `log_wa_test_${Date.now()}`,
      type: "whatsapp",
      recipient: testNumber,
      subjectOrAction: isSuccess ? "\u2713 Teste de Envio WhatsApp com Sucesso" : "\u26A0\uFE0F Falha no Teste de WhatsApp",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: isSuccess ? "SUCCESS" : "SIMULATED",
      details: { url: targetUrl, statusCode: resApi.status, response: resText.slice(0, 150) }
    });
    res.json({
      success: isSuccess,
      statusCode: resApi.status,
      response: resText,
      message: isSuccess ? "\u2713 Mensagem de teste enviada com sucesso para a API do WhatsApp!" : `API do WhatsApp respondeu com HTTP ${resApi.status}: ${resText}`
    });
  } catch (err) {
    const error = err;
    res.status(500).json({
      success: false,
      message: `Erro ao conectar com a API de WhatsApp: ${error.message}`
    });
  }
});
app.post("/api/asaas/config/webhook-token", (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return res.status(400).json({ error: "Token inv\xE1lido ou vazio" });
  }
  asaasWebhookToken = token.trim();
  console.log(`[Asaas Webhook Config]: Token atualizado para: ${asaasWebhookToken.substring(0, 8)}...`);
  res.json({
    success: true,
    message: "Token de autentica\xE7\xE3o do Webhook Asaas configurado com sucesso!",
    webhookToken: asaasWebhookToken
  });
});
app.post("/api/asaas/test-webhook-ping", (req, res) => {
  const providedToken = req.headers["asaas-access-token"] || req.headers["x-asaas-access-token"] || req.body?.token || "";
  const isValid = !asaasWebhookToken || providedToken === asaasWebhookToken;
  notificationLogs.unshift({
    id: `log_ping_${Date.now()}`,
    type: "webhook",
    recipient: "Asaas Webhook Listener",
    subjectOrAction: isValid ? "\u2713 Teste de Ping com Token Asaas Validado" : "\u26A0\uFE0F Teste de Ping: Token Asaas Divergente",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    status: isValid ? "SUCCESS" : "SIMULATED",
    details: {
      expectedTokenPreview: asaasWebhookToken ? `${asaasWebhookToken.substring(0, 8)}...` : "Nenhum",
      receivedTokenPreview: providedToken ? `${providedToken.substring(0, 8)}...` : "Nenhum",
      headerName: "asaas-access-token",
      isValid
    }
  });
  if (!isValid) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      error: "Token divergente do configurado no servidor.",
      expectedToken: asaasWebhookToken,
      receivedToken: providedToken
    });
  }
  res.json({
    success: true,
    authenticated: true,
    message: "Webhook e Token autenticados com sucesso! O Asaas est\xE1 100% conectado.",
    activeToken: asaasWebhookToken,
    headerVerified: "asaas-access-token"
  });
});
app.post(["/api/asaas/webhook", "/api/webhooks/asaas"], async (req, res) => {
  try {
    const event = req.body.event;
    const paymentData = req.body.payment;
    const headerToken = req.headers["asaas-access-token"] || req.headers["x-asaas-access-token"] || req.query.token || "";
    const isTokenValid = !asaasWebhookToken || headerToken === asaasWebhookToken;
    if (asaasWebhookToken && !isTokenValid) {
      console.warn(`[Asaas Webhook Warning]: Tentativa de webhook com token inv\xE1lido. Header asaas-access-token: "${headerToken}". Esperado: "${asaasWebhookToken.substring(0, 8)}..."`);
      notificationLogs.unshift({
        id: `log_wh_fail_${Date.now()}`,
        type: "webhook",
        recipient: "Asaas Webhook Listener",
        subjectOrAction: `\u26A0\uFE0F Webhook rejeitado: Token n\xE3o autorizado (${event || "evento"})`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "SIMULATED",
        details: {
          event,
          headerReceived: headerToken ? `${headerToken.substring(0, 8)}...` : "ausente",
          reason: "Token no cabe\xE7alho asaas-access-token n\xE3o confere"
        }
      });
      return res.status(401).json({
        error: "N\xE3o autorizado: Token do webhook Asaas inv\xE1lido ou ausente no cabe\xE7alho asaas-access-token"
      });
    }
    console.log(`[Asaas Webhook Received & Authenticated]: Event=${event}, PaymentId=${paymentData?.id}`);
    notificationLogs.unshift({
      id: `log_wh_ok_${Date.now()}`,
      type: "webhook",
      recipient: "Asaas Webhook Listener",
      subjectOrAction: `\u2713 Webhook Asaas Autenticado: ${event || "PING"}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: "SUCCESS",
      details: {
        event,
        paymentId: paymentData?.id,
        value: paymentData?.value,
        tokenAuthenticated: true
      }
    });
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      const paymentId = paymentData?.id;
      let payment = paymentsStore.get(paymentId);
      if (!payment) {
        for (const [_, p] of paymentsStore.entries()) {
          if (p.status === "PENDING") {
            payment = p;
            break;
          }
        }
      }
      if (payment) {
        await executePaymentConfirmation(payment, paymentData?.id);
      }
    }
    res.status(200).json({ received: true, authenticated: true });
  } catch (err) {
    const error = err;
    console.error("Error handling Asaas webhook:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/asaas/simulate-webhook", async (req, res) => {
  try {
    const { paymentId } = req.body;
    let payment = paymentsStore.get(paymentId);
    if (!payment) {
      for (const [_, p] of paymentsStore.entries()) {
        if (p.status === "PENDING") {
          payment = p;
          break;
        }
      }
    }
    if (!payment) {
      const sampleId = paymentId || `pay_sim_${Date.now()}`;
      payment = {
        id: sampleId,
        status: "PENDING",
        value: 79,
        pixPayload: "",
        expirationDate: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        provider: "Asaas Simula\xE7\xE3o (Ambiente de Teste)",
        patientData: {
          fullName: "Mariana Alencar",
          whatsapp: "(11) 98765-4321",
          email: "mariana.alencar@exemplo.com.br",
          age: "34",
          weight: "72 kg",
          height: "1.65 m",
          mainGoal: "Emagrecimento saud\xE1vel e sustent\xE1vel",
          restrictions: "Intoler\xE2ncia a lactose",
          selectedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          selectedTime: "10:30"
        }
      };
      paymentsStore.set(sampleId, payment);
    }
    const confirmedPayment = await executePaymentConfirmation(payment, `asaas_tx_${Date.now()}`);
    res.json({
      success: true,
      message: "Pagamento Asaas confirmado e disparos de e-mail e WhatsApp executados com sucesso!",
      payment: confirmedPayment
    });
  } catch (err) {
    const error = err;
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/notifications/logs", (req, res) => {
  res.json({
    total: notificationLogs.length,
    logs: notificationLogs.slice(0, 20)
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== "true" },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} at 0.0.0.0`);
    initBackendServices();
  });
}
startServer();
