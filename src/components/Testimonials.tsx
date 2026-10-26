import React from 'react';
import { TESTIMONIALS } from '../data/copywriting';
import { Quote } from 'lucide-react';

export const Testimonials: React.FC = () => {
  return (
    <section id="depoimentos" className="py-16 sm:py-24 bg-neutral-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-800 uppercase mb-3">
            Resultados Reais & Sem Neura
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-950 font-serif-display leading-tight">
            Quem experimentou a Nutrição Social não volta para as dietas malucas
          </h2>
          <p className="mt-3 text-base text-emerald-950/70">
            Veja as histórias de pessoas reais que conquistaram seus objetivos sem sofrimento e sem gastar fortunas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="p-6 sm:p-7 rounded-2xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <Quote className="w-8 h-8 text-emerald-600/30 mb-3" />
                <div className="text-sm font-bold text-emerald-800 mb-2">
                  {t.lostWeight}
                </div>
                <h4 className="text-base font-bold text-emerald-950 mb-3 leading-snug">
                  "{t.headline}"
                </h4>
                <p className="text-sm text-emerald-950/75 leading-relaxed italic mb-6">
                  {t.story}
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-emerald-950">{t.name}, {t.age} anos</div>
                  <div className="text-neutral-500">{t.city}</div>
                </div>
                <div className="text-emerald-700 font-medium">
                  {t.timeframe}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
