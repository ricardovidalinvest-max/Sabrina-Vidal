import React from 'react';
import { COPY_CONTENT } from '../data/copywriting';
import { Calendar, ShieldCheck, Check } from 'lucide-react';

interface PricingProps {
  onOpenBooking: () => void;
}

export const PricingSection: React.FC<PricingProps> = ({ onOpenBooking }) => {
  return (
    <section id="preco" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-800 uppercase mb-3">
            Ancoragem de Valor
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-950 font-serif-display leading-tight">
            {COPY_CONTENT.pricing.title}
          </h2>
          <p className="mt-3 text-base text-emerald-950/70">
            {COPY_CONTENT.pricing.subtitle}
          </p>
        </div>

        {/* Pricing Comparison Card */}
        <div className="max-w-4xl mx-auto rounded-3xl bg-neutral-900 text-white overflow-hidden shadow-2xl border border-neutral-800 grid grid-cols-1 md:grid-cols-12">
          {/* Left Column: Traditional Comparison Breakdown */}
          <div className="md:col-span-6 p-6 sm:p-10 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold tracking-wider uppercase text-neutral-400 mb-2">
                Em Clínicas Particulares Tradicionais
              </div>
              <h3 className="text-xl font-bold font-serif-display text-neutral-200 mb-6">
                Quanto custa o acompanhamento avulso?
              </h3>

              <div className="space-y-4 text-sm">
                {COPY_CONTENT.pricing.traditionalCompare.map((item) => (
                  <div key={item.item} className="flex items-center justify-between py-1.5 border-b border-neutral-800/80">
                    <span className="text-neutral-400">{item.item}</span>
                    <span className="text-neutral-300 font-mono line-through">{item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-neutral-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-400">Total médio estimado:</span>
                <span className="text-lg font-bold text-neutral-300 font-mono line-through">
                  {COPY_CONTENT.pricing.totalRegular}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                *Valores médios cobrados por profissionais particulares em capitais brasileiras.
              </p>
            </div>
          </div>

          {/* Right Column: Social Nutrition Offer */}
          <div className="md:col-span-6 p-6 sm:p-10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 flex flex-col justify-between">
            <div>
              <div className="inline-block px-3 py-1 rounded-md bg-emerald-800/90 text-emerald-200 text-xs font-semibold uppercase tracking-wider mb-3">
                Valor Social Acessível
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Consulta Completa + Dieta + Receitas + Suporte
              </h3>

              <div className="my-6">
                <div className="text-xs text-emerald-300 line-through mb-1">
                  De R$ 250,00 por apenas
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-extrabold text-white font-mono tracking-tight">
                    {COPY_CONTENT.pricing.socialPrice}
                  </span>
                  <span className="text-xs sm:text-sm text-emerald-200 font-medium">
                    à vista via PIX
                  </span>
                </div>
                <div className="text-xs text-emerald-300/80 mt-1">
                  {COPY_CONTENT.pricing.installmentText}
                </div>
              </div>

              <div className="space-y-2.5 text-xs sm:text-sm text-emerald-100 mb-8">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Videochamada 1 a 1 de 50 minutos com a Sabrina</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Plano alimentar em PDF no seu WhatsApp em 48h</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>E-book de Receitas Rápidas e Lista de Compras</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Canal de suporte para tirar dúvidas</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={onOpenBooking}
                type="button"
                className="w-full inline-flex items-center justify-center gap-3 py-4 px-6 text-base font-bold text-emerald-950 bg-white hover:bg-emerald-100 active:scale-[0.98] rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Calendar className="w-5 h-5 text-emerald-800" />
                <span>Escolher Meu Horário na Agenda</span>
              </button>

              <div className="text-center text-xs text-emerald-300">
                ⚡ {COPY_CONTENT.pricing.urgencyText}
              </div>
            </div>
          </div>
        </div>

        {/* Unconditional Guarantee Box */}
        <div className="max-w-3xl mx-auto mt-12 p-6 sm:p-8 rounded-2xl bg-emerald-50 border border-emerald-900/10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-14 h-14 rounded-full bg-emerald-200/70 text-emerald-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="text-center sm:text-left">
            <h4 className="text-base sm:text-lg font-bold text-emerald-950 mb-1">
              {COPY_CONTENT.pricing.guaranteeTitle}
            </h4>
            <p className="text-xs sm:text-sm text-emerald-900/80 leading-relaxed">
              {COPY_CONTENT.pricing.guaranteeText}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
