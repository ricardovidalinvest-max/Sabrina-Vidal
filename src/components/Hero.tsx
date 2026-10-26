import React from 'react';
import { Calendar, ShieldCheck, Video, Clock, CheckCircle2 } from 'lucide-react';
import { COPY_CONTENT } from '../data/copywriting';

interface HeroProps {
  onOpenBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/50 via-white to-white pt-8 pb-16 lg:pt-14 lg:pb-24 border-b border-emerald-900/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Kicker Text (Unboxed, clean) */}
        <div className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-800 uppercase mb-4 flex items-center gap-2">
          <span>{COPY_CONTENT.hero.kicker}</span>
        </div>

        {/* 2-Column Main Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Persuasive Copy & CTA */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-emerald-950 font-serif-display leading-[1.15]">
              {COPY_CONTENT.hero.headline}
            </h1>

            <p className="text-base sm:text-lg text-emerald-950/80 leading-relaxed max-w-2xl">
              {COPY_CONTENT.hero.subheadline}
            </p>

            {/* Quick Benefits Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2.5 text-sm text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Consulta 1 a 1 de 50 min via vídeo</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Cardápio individual sem restrições extremas</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Guia de receitas rápidas de 15 minutos</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Acompanhamento tira-dúvidas no WhatsApp</span>
              </div>
            </div>

            {/* CTA Decision Block */}
            <div className="pt-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button
                  onClick={onOpenBooking}
                  type="button"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <Calendar className="w-5 h-5" />
                  <span>{COPY_CONTENT.hero.cta}</span>
                </button>

                <div className="text-xs sm:text-sm text-emerald-900/80">
                  <span className="font-semibold text-emerald-950">Vagas da semana:</span>{' '}
                  <span className="text-emerald-700 font-bold">Apenas 5 horários restantes</span>
                </div>
              </div>

              <p className="text-xs text-emerald-900/60">
                {COPY_CONTENT.hero.ctaMicrocopy}
              </p>
            </div>

            {/* Authority Tagline */}
            <div className="pt-2 flex items-center gap-3 text-xs sm:text-sm text-emerald-950/70 border-t border-emerald-900/10">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{COPY_CONTENT.hero.badgeCRN}</span>
              <span aria-hidden="true">·</span>
              <span>Nutricionista Clínica & Comportamental</span>
            </div>
          </div>

          {/* Right Column: High-Fidelity Portrait Media Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden bg-emerald-900/5 border border-emerald-900/10 shadow-lg">
              <img
                src="/assets/aistudio/PHOTO-2026-10-21-17-02-18_872ea764.jpg"
                alt="Drª Sabrina Vidal Nutricionista (CRN 17198 - GO) sorrindo"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-cover object-top aspect-3/4 sm:max-h-[520px]"
                loading="eager"
              />
              <div className="p-4 sm:p-5 bg-white border-t border-emerald-900/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-emerald-950">Drª Sabrina Vidal</h3>
                    <p className="text-xs text-emerald-800/80">CRN 17198 - GO · Nutrição Clínica & Emagrecimento</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-emerald-700 font-bold block">100% Online</span>
                    <span className="text-[11px] text-emerald-950/60">Atendimento Brasil todo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width KPI Strip (Clean, unboxed, tabular figures) */}
        <div className="mt-14 pt-8 border-t border-emerald-900/10 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-950 tabular-nums">
              +1.840
            </div>
            <div className="text-xs sm:text-sm text-emerald-950/70 mt-1">
              Pacientes acompanhados
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tabular-nums">
              R$ 79,00
            </div>
            <div className="text-xs sm:text-sm text-emerald-950/70 mt-1">
              Preço social individual
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-950 tabular-nums">
              50 min
            </div>
            <div className="text-xs sm:text-sm text-emerald-950/70 mt-1">
              Duração da videochamada
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-950 tabular-nums">
              98%
            </div>
            <div className="text-xs sm:text-sm text-emerald-950/70 mt-1">
              Adesão sem terrorismo alimentar
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
