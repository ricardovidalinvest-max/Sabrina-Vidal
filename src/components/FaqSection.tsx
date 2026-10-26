import React, { useState } from 'react';
import { FAQS } from '../data/copywriting';
import { ChevronDown } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="duvidas" className="py-16 sm:py-24 bg-neutral-50/70 border-t border-neutral-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <div className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-800 uppercase mb-3">
            Tire Suas Dúvidas
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-950 font-serif-display leading-tight">
            Perguntas Frequentes
          </h2>
          <p className="mt-3 text-base text-emerald-950/70">
            Tudo o que você precisa saber antes de agendar sua consulta com a Sabrina.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className="rounded-2xl bg-white border border-neutral-200 overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 font-bold text-emerald-950 hover:text-emerald-800 transition-colors cursor-pointer text-base sm:text-lg"
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-emerald-700 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-emerald-950/80 leading-relaxed border-t border-neutral-100">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
