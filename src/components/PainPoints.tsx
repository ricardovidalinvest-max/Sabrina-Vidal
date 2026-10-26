import React from 'react';
import { COPY_CONTENT } from '../data/copywriting';

export const PainPoints: React.FC = () => {
  return (
    <section id="como-funciona" className="py-16 sm:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div className="text-xs sm:text-sm font-semibold tracking-wide text-rose-800 uppercase mb-3">
            O ciclo da frustração
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-950 font-serif-display leading-tight">
            {COPY_CONTENT.pains.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-emerald-950/75 leading-relaxed">
            {COPY_CONTENT.pains.subtitle}
          </p>
        </div>

        {/* 4 Cards Grid - Natural Editorial Numbering, No Code Slop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {COPY_CONTENT.pains.items.map((item) => (
            <div
              key={item.number}
              className="p-6 sm:p-8 rounded-2xl bg-neutral-50 border border-neutral-200/80 hover:border-emerald-700/30 transition-colors"
            >
              <div className="text-sm font-bold text-emerald-800 tracking-wider mb-2 font-mono tabular-nums">
                {item.number}.
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-emerald-950 mb-3">
                {item.title}
              </h3>
              <p className="text-sm sm:text-base text-emerald-950/75 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Transitional Empathy Statement */}
        <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-emerald-50/70 border border-emerald-900/10 text-center max-w-4xl mx-auto">
          <p className="text-base sm:text-lg font-medium text-emerald-950 leading-relaxed">
            💡 <strong className="font-bold text-emerald-900">A verdade libertadora:</strong> Você não precisa de uma dieta sofrida para ter o corpo e a saúde que deseja. Você precisa apenas de um plano que respeite sua rotina, sua fome e o seu bolso.
          </p>
        </div>
      </div>
    </section>
  );
};
