import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { PainPoints } from './components/PainPoints';
import { SolutionSection } from './components/SolutionSection';
import { Deliverables } from './components/Deliverables';
import { PricingSection } from './components/PricingSection';
import { Testimonials } from './components/Testimonials';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { BookingFunnelModal } from './components/BookingFunnelModal';
import { AutomationTechGuideModal } from './components/AutomationTechGuideModal';
import { Calendar, Sparkles } from 'lucide-react';

export default function App() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isTechGuideOpen, setIsTechGuideOpen] = useState(false);

  // Atalho de teclado para a Dra. Sabrina abrir o painel de logs (Ctrl + Shift + L ou Cmd + Shift + L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l' || e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsTechGuideOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-white text-emerald-950 font-sans selection:bg-emerald-200 selection:text-emerald-950">
      {/* Top Scarcity Bar */}
      <div className="bg-emerald-900 text-emerald-100 text-xs py-2 px-4 text-center border-b border-emerald-800 flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
        <span>
          <strong>Nutrição Social com Drª Sabrina Vidal (CRN 17198 - GO):</strong> Horários abertos para esta semana. Consulta individual online por apenas <strong>R$ 79,00</strong>.
        </span>
      </div>

      {/* Header (Clean, only patient actions) */}
      <Header
        onOpenBooking={() => setIsBookingOpen(true)}
      />

      <main>
        {/* Hero Section */}
        <Hero onOpenBooking={() => setIsBookingOpen(true)} />

        {/* Problem / Pain Identification */}
        <PainPoints />

        {/* Social Nutrition Solution & Manifesto */}
        <SolutionSection onOpenBooking={() => setIsBookingOpen(true)} />

        {/* Deliverables Bento & Consultation details */}
        <Deliverables />

        {/* Anchored Pricing & 7-Day Guarantee */}
        <PricingSection onOpenBooking={() => setIsBookingOpen(true)} />

        {/* Real Testimonials / Case Studies */}
        <Testimonials />

        {/* FAQ Accordion */}
        <FaqSection />

        {/* Final Conversion CTA Banner */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-emerald-800 to-emerald-950 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-serif-display leading-tight mb-4">
              Pronto(a) para emagrecer com saúde e sem terrorismo?
            </h2>
            <p className="text-base text-emerald-100/90 max-w-2xl mx-auto mb-8">
              Garanta seu horário agora mesmo. O processo é 100% automático: você escolhe a data, paga via PIX e recebe o link da videochamada no seu WhatsApp na hora.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setIsBookingOpen(true)}
                type="button"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-bold text-emerald-950 bg-white hover:bg-emerald-100 active:scale-[0.98] rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Calendar className="w-5 h-5 text-emerald-800" />
                <span>Agendar Minha Consulta por R$ 79</span>
              </button>
            </div>
            <div className="text-xs text-emerald-300/80 mt-4">
              Sem mensalidades ou surpresas · Garantia de 7 dias ou seu dinheiro de volta
            </div>
          </div>
        </section>
      </main>

      {/* Quiet, Compliant Footer with Discreet Admin Lock */}
      <Footer
        onOpenBooking={() => setIsBookingOpen(true)}
        onOpenAdmin={() => setIsTechGuideOpen(true)}
      />

      {/* Step-by-Step Interactive Funnel Modal */}
      <BookingFunnelModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
      />

      {/* Caixa de Log & Painel Administrativo com Senha Restrita */}
      <AutomationTechGuideModal
        isOpen={isTechGuideOpen}
        onClose={() => setIsTechGuideOpen(false)}
      />
    </div>
  );
}
