export interface MakeScenarioStep {
  stepNumber: number;
  moduleId: string;
  moduleName: string;
  app: string;
  iconType: 'webhook' | 'router' | 'calendar' | 'whatsapp' | 'email' | 'sheets';
  role: string;
  color: string;
  config: {
    label: string;
    description: string;
    fieldsMapped: Array<{ field: string; source: string; example: string }>;
    instructions: string[];
  };
}

export const MAKE_SCENARIO_STEPS: MakeScenarioStep[] = [
  {
    stepNumber: 1,
    moduleId: 'gateway_webhook',
    moduleName: 'Custom Webhook (Gatilho Inicial)',
    app: 'Webhooks by Make',
    iconType: 'webhook',
    role: 'Recebe os dados do agendamento pago via Asaas ou diretamente do app em tempo real',
    color: 'emerald',
    config: {
      label: 'Módulo de Entrada (Trigger)',
      description: 'Gera a URL única no Make.com que escuta as notificações instantâneas de pagamento confirmado e agendamento.',
      fieldsMapped: [
        { field: 'event', source: '{{event}}', example: 'PAYMENT_CONFIRMED' },
        { field: 'patient.fullName', source: '{{patient.fullName}}', example: 'Mariana Alencar' },
        { field: 'patient.whatsapp', source: '{{patient.whatsapp}}', example: '5511987654321' },
        { field: 'patient.email', source: '{{patient.email}}', example: 'mariana.alencar@exemplo.com' },
        { field: 'patient.selectedDate', source: '{{patient.selectedDate}}', example: '2026-10-25' },
        { field: 'patient.selectedTime', source: '{{patient.selectedTime}}', example: '14:00' },
        { field: 'payment.value', source: '{{payment.value}}', example: '79.00' },
        { field: 'meeting.googleMeetUrl', source: '{{meeting.googleMeetUrl}}', example: 'https://meet.google.com/sab-vidal-79' },
      ],
      instructions: [
        'No Make.com, adicione o módulo "Webhooks" > "Custom Webhook".',
        'Clique em "Add" e dê o nome de "Webhook Consultas Sabrina Nutricionista".',
        'Copie a URL gerada (ex: https://hook.eu1.make.com/...) e cole no campo "URL do Webhook do Make" deste aplicativo.',
        'Envie o disparo de teste pelo botão deste aplicativo para o Make determinar a estrutura (Determine Data Structure).',
      ],
    },
  },
  {
    stepNumber: 2,
    moduleId: 'router_decision',
    moduleName: 'Router (Roteador de Fluxo)',
    app: 'Flow Control by Make',
    iconType: 'router',
    role: 'Distribui a automação em ramificações condicionais com base no status da consulta',
    color: 'violet',
    config: {
      label: 'Controle de Fluxo e Decisão',
      description: 'Permite tratar pagamentos aprovados, gerar lembretes programados e isolar eventuais falhas sem travar o cenário.',
      fieldsMapped: [
        { field: 'Filtro Rota 1 (Principal)', source: '{{event}} = PAYMENT_CONFIRMED', example: 'Disparo de confirmação imediata' },
        { field: 'Filtro Rota 2 (Lembrete)', source: '{{event}} = REMINDER_24H', example: 'Lembrete no WhatsApp na véspera' },
      ],
      instructions: [
        'Adicione o módulo "Flow Control" > "Router" conectado logo após o Webhook.',
        'Crie 3 saídas no roteador:',
        'Rota A (Principal): Confirmação de Consulta e Entregas (Google Meet + WhatsApp + E-mail + Planilha).',
        'Rota B: Lembrete automático com módulo "Sleep" ou agendamento de 24 horas antes.',
        'Rota C: Contingência de erro com notificação silenciosa para a Dra. Sabrina.',
      ],
    },
  },
  {
    stepNumber: 3,
    moduleId: 'google_calendar_meet',
    moduleName: 'Google Calendar (Criar Evento com Google Meet)',
    app: 'Google Calendar',
    iconType: 'calendar',
    role: 'Garante o bloqueio da agenda da Drª Sabrina e cria o link oficial do Google Meet',
    color: 'blue',
    config: {
      label: 'Sincronização de Agenda & Telemedicina',
      description: 'Cria o evento na agenda com fuso horário de Brasília, convida o paciente e ativa a sala virtual.',
      fieldsMapped: [
        { field: 'Event Name', source: 'Consulta Nutrição Social - {{1.patient.fullName}}', example: 'Consulta Nutrição Social - Mariana Alencar' },
        { field: 'Start Date/Time', source: '{{1.patient.selectedDate}} {{1.patient.selectedTime}}', example: '2026-10-25 14:00' },
        { field: 'Duration', source: '50 minutos', example: '50 min' },
        { field: 'Attendees', source: '{{1.patient.email}}, nutricionistasabrinaamorim@gmail.com', example: 'Convites enviados aos e-mails' },
        { field: 'Conference Solution', source: 'Google Meet', example: 'Criação automática do link de vídeo' },
      ],
      instructions: [
        'Conecte a conta Google de atendimentos da Dra. Sabrina (Gmail / Google Workspace).',
        'Selecione a agenda principal "Consultas Nutricionais".',
        'Em "Conference Data", selecione "Create Hangouts Meet / Google Meet conference".',
        'No corpo da descrição, inclua: Nome do paciente, WhatsApp, Idade, Peso e Objetivo.',
      ],
    },
  },
  {
    stepNumber: 4,
    moduleId: 'whatsapp_evolution',
    moduleName: 'WhatsApp API (Evolution API ou Z-API)',
    app: 'HTTP / WhatsApp Gateway',
    iconType: 'whatsapp',
    role: 'Dispara a mensagem humanizada de confirmação no WhatsApp com o link do Google Meet',
    color: 'emerald',
    config: {
      label: 'Comunicação Instantânea no WhatsApp',
      description: 'Taxa de abertura superior a 95%. O paciente recebe as boas-vindas com o link de acesso direto da chamada.',
      fieldsMapped: [
        { field: 'URL', source: '{{evolution_url}}/message/sendText/instancia', example: 'https://api.evolution.io/message/sendText/dra-sabrina' },
        { field: 'Method', source: 'POST', example: 'POST JSON' },
        { field: 'Number', source: '{{1.patient.whatsapp}}', example: '5511987654321' },
        { field: 'Text', source: 'Template humanizado da Dra. Sabrina com Meet e dicas', example: 'Mensagem com formatação e emojis' },
      ],
      instructions: [
        'No Make, utilize o módulo "HTTP" > "Make a request" ou a integração da Z-API.',
        'Insira a URL da sua Evolution API ou Z-API no campo de WhatsApp do Hub de Webhooks.',
        'Adicione o cabeçalho "apikey: SUA_CHAVE".',
        'Mapeie o número de telefone e o corpo com o template pronto da Dra. Sabrina Vidal.',
      ],
    },
  },
  {
    stepNumber: 5,
    moduleId: 'email_confirmation',
    moduleName: 'E-mail Transacional (Gmail / Resend / SendGrid)',
    app: 'Gmail ou Resend',
    iconType: 'email',
    role: 'Envia e-mail de confirmação elegante ao paciente e cópia de prontuário à Dra. Sabrina',
    color: 'amber',
    config: {
      label: 'Confirmação Formal e Registro',
      description: 'Envia comprovante por e-mail com botão para adicionar ao Google Agenda / Apple Calendar e formulário de orientações.',
      fieldsMapped: [
        { field: 'To', source: '{{1.patient.email}}', example: 'mariana.alencar@exemplo.com' },
        { field: 'Bcc / Alert', source: 'nutricionistasabrinaamorim@gmail.com', example: 'Dra. Sabrina recebe cópia instantânea' },
        { field: 'Subject', source: '✅ Consulta Confirmada: Nutrição Social com Dra. Sabrina Vidal', example: 'Assunto com identificação clara' },
        { field: 'Content (HTML)', source: 'Template HTML transacional responsivo', example: 'Layout profissional com verde botânico e dourado' },
      ],
      instructions: [
        'Conecte o módulo "Gmail" > "Send an Email" ou "Resend" > "Send Email".',
        'Defina o destinatário como {{1.patient.email}}.',
        'Insira nutricionistasabrinaamorim@gmail.com em Cópia Oculta (Bcc) para a Dra. Sabrina acompanhar.',
        'Cole o código do Template HTML disponível na aba "Templates Prontos" deste guia.',
      ],
    },
  },
  {
    stepNumber: 6,
    moduleId: 'google_sheets_crm',
    moduleName: 'Google Sheets (Prontuário & Controle Financeiro)',
    app: 'Google Sheets',
    iconType: 'sheets',
    role: 'Registra uma nova linha no CRM de pacientes com todos os dados da anamnese e pagamento',
    color: 'teal',
    config: {
      label: 'Armazenamento Centralizado e Histórico',
      description: 'Gera uma planilha organizada sem necessidade de alimentar nada manualmente.',
      fieldsMapped: [
        { field: 'Coluna A (Data/Hora Inscrição)', source: '{{now}}', example: '2026-10-23 15:30' },
        { field: 'Coluna B (Nome Completo)', source: '{{1.patient.fullName}}', example: 'Mariana Alencar' },
        { field: 'Coluna C (WhatsApp)', source: '{{1.patient.whatsapp}}', example: '(11) 98765-4321' },
        { field: 'Coluna D (E-mail)', source: '{{1.patient.email}}', example: 'mariana.alencar@exemplo.com' },
        { field: 'Coluna E (Data Consulta)', source: '{{1.patient.selectedDate}}', example: '25/10/2026' },
        { field: 'Coluna F (Horário)', source: '{{1.patient.selectedTime}}', example: '14:00' },
        { field: 'Coluna G (Valor)', source: 'R$ {{1.payment.value}}', example: 'R$ 79,00' },
        { field: 'Coluna H (Status)', source: 'CONFIRMADO_PAGO', example: 'CONFIRMADO_PAGO' },
        { field: 'Coluna I (Objetivo Principal)', source: '{{1.patient.mainGoal}}', example: 'Emagrecimento saudável' },
        { field: 'Coluna J (Restrições)', source: '{{1.patient.restrictions}}', example: 'Intolerância a lactose' },
        { field: 'Coluna K (Link Google Meet)', source: '{{3.meetUrl}}', example: 'https://meet.google.com/sab-vidal-79' },
      ],
      instructions: [
        'Crie uma planilha no Google Drive com o nome "Controle_Pacientes_Dra_Sabrina".',
        'Nomeie a primeira aba como "Consultas_Pagas" com os cabeçalhos acima.',
        'No Make, conecte o módulo "Google Sheets" > "Add a Row".',
        'Selecione a planilha e mapeie as colunas com os dados recebidos nos passos anteriores.',
      ],
    },
  },
];

// Official Make.com Scenario Blueprint JSON (Ready to Import into Make via "Import Blueprint")
export const MAKE_OFFICIAL_BLUEPRINT_JSON = {
  name: "Automação Completa - Dra Sabrina Vidal Nutrição Social",
  version: 1,
  flow: [
    {
      id: 1,
      module: "gateway:CustomWebhook",
      version: 1,
      parameters: {},
      filter: null,
      metadata: {
        designer: { x: 0, y: 0 },
        restore: {},
      },
    },
    {
      id: 2,
      module: "router:Router",
      version: 1,
      metadata: {
        designer: { x: 300, y: 0 },
      },
    },
    {
      id: 3,
      module: "google-calendar:createEvent",
      version: 1,
      parameters: {
        calendarId: "primary",
        summary: "Consulta Nutrição Social - {{1.patient.fullName}}",
        description: "Paciente: {{1.patient.fullName}}\nWhatsApp: {{1.patient.whatsapp}}\nObjetivo: {{1.patient.mainGoal}}\nRestrições: {{1.patient.restrictions}}",
        conferenceDataVersion: 1,
      },
      metadata: {
        designer: { x: 600, y: -150 },
      },
    },
    {
      id: 4,
      module: "http:ActionSendRequest",
      version: 3,
      parameters: {
        url: "{{evolutionApiUrl}}/message/sendText",
        method: "POST",
        headers: [
          { name: "Content-Type", value: "application/json" },
          { name: "apikey", value: "{{evolutionApiKey}}" },
        ],
      },
      metadata: {
        designer: { x: 900, y: -150 },
      },
    },
    {
      id: 5,
      module: "gmail:ActionSendEmail",
      version: 1,
      parameters: {
        to: "{{1.patient.email}}",
        bcc: "nutricionistasabrinaamorim@gmail.com",
        subject: "✅ Consulta Confirmada: Nutrição Social com Dra. Sabrina Vidal ({{1.patient.selectedDate}})",
      },
      metadata: {
        designer: { x: 1200, y: -150 },
      },
    },
    {
      id: 6,
      module: "google-sheets:addRow",
      version: 2,
      parameters: {
        spreadsheetId: "Controle_Pacientes_Dra_Sabrina",
        sheetId: "Consultas_Pagas",
      },
      metadata: {
        designer: { x: 1500, y: -150 },
      },
    },
  ],
};
