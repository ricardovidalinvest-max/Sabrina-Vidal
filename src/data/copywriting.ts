import { DayOption, FaqItem, Testimonial } from '../types';

export const COPY_CONTENT = {
  hero: {
    kicker: "Nutrição Social Acessível • Atendimento Individual Online",
    headline: "Emagreça comendo comida de verdade, sem passar fome e sem gastar rios de dinheiro.",
    subheadline:
      "Chega de dietas malucas de internet e consultas de R$ 400. Tenha uma consulta individual por vídeo comigo, plano alimentar 100% sob medida para sua rotina e receitas fáceis — por um valor que cabe de verdade no seu bolso.",
    cta: "Agendar Minha Consulta por R$ 79",
    ctaMicrocopy: "Agendamento automático em 2 min · Vagas limitadas por semana · Sem mensalidade",
    socialProofSnippet: "+1.840 pacientes transformados com alimentação consciente e sem neura",
    badgeCRN: "Drª Sabrina Vidal | CRN 17198 - GO",
    email: "nutricionistasabrinaamorim@gmail.com",
    photoUrl: "/assets/aistudio/PHOTO-2026-10-21-17-02-18_872ea764.jpg",
  },

  pains: {
    title: "Por que tentar emagrecer sozinho(a) tem sido tão exaustivo e frustrante?",
    subtitle:
      "Se você já tentou várias dietas e sempre volta ao ponto de partida, a culpa não é da sua força de vontade. É o método tradicional que está quebrado.",
    items: [
      {
        number: "01",
        title: "Dietas restritivas e o terrorismo alimentar",
        description:
          "Cortar carboidratos, viver de salada e passar fome geram ansiedade e compulsão. Seu corpo entra em estado de alerta e o efeito sanfona é quase inevitável.",
      },
      {
        number: "02",
        title: "Consultas tradicionais caras e inacessíveis",
        description:
          "A maioria das clínicas particulares cobra de R$ 350 a R$ 500 por uma única consulta. Fazer acompanhamento regular se torna um luxo para poucos.",
      },
      {
        number: "03",
        title: "Cardápios com ingredientes caros e complicados",
        description:
          "Dietas que exigem farinhas importadas, suplementos caríssimos e receitas demoradas não combinam com a realidade de quem trabalha e cuida da casa.",
      },
      {
        number: "04",
        title: "Solidão e falta de direcionamento individual",
        description:
          "Sem alguém para ajustar as quantidades ao seu metabolismo e rotina, você fica perdido em dicas contraditórias de redes sociais.",
      },
    ],
  },

  solution: {
    badge: "O Movimento da Nutrição Social",
    title: "Uma nutrição humanizada, prática e verdadeiramente possível.",
    paragraph1:
      "Meu nome é Drª Sabrina Vidal (CRN 17198 - GO), sou nutricionista clínica apaixonada por transformar vidas através da comida acessível e sem neuroses. Criei o projeto de Nutrição Social porque acredito na saúde de qualidade para todos.",
    paragraph2:
      "Aqui você não vai encontrar proibições radicais, nem suplementos desnecessários. Nós vamos montar juntos um plano alimentar com arroz, feijão, ovos, legumes da feira, frutas da época e aquele café da manhã que você já ama — ajustando apenas as combinações certas para ativar seu metabolismo.",
    pillars: [
      {
        title: "Comida do Dia a Dia",
        description: "Ingredientes simples e acessíveis que você encontra em qualquer mercadinho ou feira de bairro.",
      },
      {
        title: "Zero Julgamento",
        description: "Espaço acolhedor e seguro. Entendemos a rotina corrida, o estresse do trabalho e os momentos de lazer.",
      },
      {
        title: "Sustentável a Longo Prazo",
        description: "Você não precisa abrir mão do seu churrasco em família ou da pizza do final de semana para atingir sua meta.",
      },
    ],
  },

  deliverables: {
    title: "Tudo o que está incluso no seu atendimento:",
    subtitle: "Um pacote completo de acompanhamento para você ter clareza, autonomia e resultados duradouros.",
    items: [
      {
        title: "01. Consulta individual com até 30 min",
        tagline: "O tempo médio da consulta é de até 30 minutos",
        description:
          "Conversamos com calma sobre sua rotina, horários, histórico de saúde, preferências de paladar e objetivos. O tempo médio da consulta é de até 30 minutos via Google Meet, 100% individualizada.",
      },
      {
        title: "02. Cardápio Personalizado",
        tagline: "Feito para a sua rotina real",
        description:
          "Calculado exatamente para a sua necessidade calórica e estilo de vida. Você recebe seu cardápio personalizado em PDF interativo no seu WhatsApp com opções práticas de substituição.",
      },
      {
        title: "03. Guia de Receitas",
        tagline: "Praticidade para quem não quer perder tempo",
        description:
          "Receitas saborosas com ingredientes baratos e fáceis de preparar: marmitas econômicas, lanches rápidos e opções simples para o seu dia a dia.",
      },
      {
        title: "04. Guia de Compras Econômicas",
        tagline: "Economize até 30% na feira e no mercado",
        description:
          "Aprenda quais cortes de carnes, vegetais e fontes de proteína rendem mais, garantindo alta nutrição gastando menos do que você gasta hoje.",
      },
    ],
  },

  pricing: {
    title: "Um investimento menor que uma pizza no final de semana.",
    subtitle:
      "Veja quanto custaria esse pacote em clínicas particulares tradicionais versus o Valor Social da Sabrina:",
    traditionalCompare: [
      { item: "Consulta Nutricional Particular", price: "R$ 350,00" },
      { item: "Cálculo de Cardápio Personalizado", price: "R$ 150,00" },
      { item: "Guia de Receitas", price: "R$ 67,00" },
    ],
    totalRegular: "R$ 567,00",
    socialPrice: "R$ 79,00",
    installmentText: "ou em até 2x de R$ 42,50 no cartão",
    urgencyText: "Atenção: Apenas 15 horários por semana são disponibilizados com valor social para manter a qualidade do atendimento.",
  },
};

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Mariana Alencar",
    age: 34,
    city: "São Paulo, SP",
    lostWeight: "-9,5 kg em 70 dias",
    headline: "Pela primeira vez emagreci comendo arroz com feijão todo dia",
    story:
      "Eu tinha trauma de nutricionista porque sempre me passavam aspargos, salmão e suplementos caros. A Sabrina montou meu cardápio com o que eu já tinha na geladeira. Consegui manter a rotina trabalhando fora e minha disposição mudou da água para o vinho!",
    timeframe: "Paciente há 3 meses",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80",
  },
  {
    name: "Carlos Eduardo Silveira",
    age: 41,
    city: "Belo Horizonte, MG",
    lostWeight: "-12 kg e exames normalizados",
    headline: "Baixei meu colesterol e minha glicemia sem passar fome",
    story:
      "Estava pré-diabético e achava que teria que viver de remédios. O atendimento da Sabrina foi humanizado demais. Ela entendeu meus horários na estrada e adaptou tudo. O valor social me permitiu fazer o acompanhamento sem apertar as contas da família.",
    timeframe: "Paciente há 5 meses",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
  },
  {
    name: "Juliana Mendes",
    age: 28,
    city: "Curitiba, PR",
    lostWeight: "-7 kg sem abrir mão do chocolate",
    headline: "O suporte no WhatsApp fez toda a diferença quando bateu a TPM",
    story:
      "A consulta online foi super pontual e prática. No mesmo dia já recebi o e-mail com as orientações e as receitas são maravilhosas. As panquecas de banana salvaram minhas tardes de vontade de doce. Recomendo de olhos fechados!",
    timeframe: "Paciente há 2 meses",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",
  },
];

export const FAQS: FaqItem[] = [
  {
    question: "Como funciona a consulta online por vídeo?",
    answer:
      "Após a confirmação do agendamento e pagamento, você recebe imediatamente no seu WhatsApp e no seu E-mail o link exclusivo da videochamada no Google Meet. No dia e horário marcados, basta clicar no link pelo celular ou computador. É super simples e você é atendido no conforto da sua casa.",
  },
  {
    question: "Por que o valor é tão acessível (R$ 79,00)? Tem pegadinha ou mensalidade?",
    answer:
      "Não tem pegadinha, nem fidelidade ou cobranças ocultas. O valor de R$ 79,00 é pagamento único por consulta. Criei o projeto de Nutrição Social porque acredito na saúde de qualidade para todos, operando de forma 100% digital e sem os custos fixos de um consultório presencial.",
  },
  {
    question: "O que acontece logo após o pagamento do PIX?",
    answer:
      "Assim que você faz o PIX, nosso sistema reconhece a compensação em menos de 10 segundos. Automaticamente, nosso robô dispara: 1) Uma mensagem no seu WhatsApp com a confirmação, horário e o link da videochamada; 2) Um e-mail completo com o comprovante e orientações pré-consulta. Você não precisa enviar comprovante manualmente!",
  },
  {
    question: "Vou precisar comprar alimentos caros ou suplementos?",
    answer:
      "Absolutamente não! O foco da Sabrina é a alimentação real e acessível. Você vai usar arroz, feijão, frango, ovos, legumes, frutas e verduras que você já costuma comprar. Não exigimos whey protein, creatina ou sementes caras a não ser que você já use e prefira.",
  },
  {
    question: "Quanto tempo dura a consulta e como recebo meu plano?",
    answer:
      "O tempo médio da consulta é de até 30 minutos. Nela conversamos sobre todos os detalhes da sua vida e rotina. O cardápio personalizado, com as quantidades calculadas e orientações, é enviado no seu WhatsApp e e-mail em até 48 horas úteis após a consulta.",
  },
  {
    question: "E se eu tiver algum imprevisto e precisar remarcar?",
    answer:
      "Sem problemas! Você pode remarcar seu horário gratuitamente com até 4 horas de antecedência diretamente pelo link de reagendamento enviado na confirmação do seu WhatsApp.",
  },
];

export const AVAILABLE_DAYS: DayOption[] = [
  {
    date: "2026-10-23",
    dayOfWeek: "Sexta",
    dayNumber: "23",
    monthName: "Out",
    slotsRemaining: 2,
    timeSlots: ["09:00", "11:30", "15:00", "17:30"],
  },
  {
    date: "2026-10-24",
    dayOfWeek: "Sábado",
    dayNumber: "24",
    monthName: "Out",
    slotsRemaining: 1,
    timeSlots: ["08:30", "10:30"],
  },
  {
    date: "2026-10-26",
    dayOfWeek: "Segunda",
    dayNumber: "26",
    monthName: "Out",
    slotsRemaining: 4,
    timeSlots: ["09:00", "10:30", "14:00", "16:00", "18:30"],
  },
  {
    date: "2026-10-27",
    dayOfWeek: "Terça",
    dayNumber: "27",
    monthName: "Out",
    slotsRemaining: 3,
    timeSlots: ["08:30", "11:00", "15:00", "17:00", "19:00"],
  },
  {
    date: "2026-10-28",
    dayOfWeek: "Quarta",
    dayNumber: "28",
    monthName: "Out",
    slotsRemaining: 3,
    timeSlots: ["09:30", "13:30", "16:30", "18:00"],
  },
  {
    date: "2026-10-29",
    dayOfWeek: "Quinta",
    dayNumber: "29",
    monthName: "Out",
    slotsRemaining: 5,
    timeSlots: ["09:00", "10:30", "14:30", "16:00", "17:30", "19:00"],
  },
];
