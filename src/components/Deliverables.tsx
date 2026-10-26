import React from 'react';
import { COPY_CONTENT } from '../data/copywriting';
import { Video, FileText, ChefHat, MessageSquare, ShoppingBag } from 'lucide-react';

const icons = [Video, FileText, ChefHat, MessageSquare, ShoppingBag];

export const Deliverables: React.FC = () => {
  return (
    <section id="o-que-inclui" className="py-16 sm:py-24 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-800 uppercase mb-3">
            Transparência Total
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-950 font-serif-display leading-tight">
            {COPY_CONTENT.deliverables.title}
          </h2>
          <p className="mt-3 text-base text-emerald-950/70">
            {COPY_CONTENT.deliverables.subtitle}
          </p>
        </div>

        {/* Feature Bento Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Interactive Telehealth Preview */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 p-6 text-white">
            <div>
              <div className="text-xs font-semibold tracking-wider text-emerald-400 uppercase mb-2">
                Atendimento 100% Individual
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-serif-display mb-3">
                Consulta online que parece estar na mesma sala
              </h3>
              <p className="text-sm text-neutral-300 leading-relaxed mb-6">
                Sem trânsito, sem salas de espera e sem correria. Você entra na sala do Google Meet com 1 clique pelo seu celular ou computador.
              </p>
            </div>

            <div className="rounded-xl overflow-hidden border border-neutral-700 bg-black/40">
              <img
                src="/src/assets/images/online_nutrition_session_1792611412567.jpg"
                alt="Consulta nutricional online acolhedora em tela de computador"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-cover aspect-16/9"
                loading="lazy"
              />
            </div>

            <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
              <span>Google Meet seguro</span>
              <span>Duração: 50 minutos</span>
            </div>
          </div>

          {/* Right Column: The 5 Deliverables Cards */}
          <div className="lg:col-span-7 space-y-4">
            {COPY_CONTENT.deliverables.items.map((item, idx) => {
              const IconComponent = icons[idx] || FileText;
              return (
                <div
                  key={item.title}
                  className="p-5 sm:p-6 rounded-2xl bg-neutral-50 border border-neutral-200/80 hover:border-emerald-700/40 transition-colors flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-base sm:text-lg font-bold text-emerald-950">
                        {item.title}
                      </h4>
                    </div>
                    <div className="text-xs font-semibold text-emerald-700 mb-1.5">
                      {item.tagline}
                    </div>
                    <p className="text-xs sm:text-sm text-emerald-950/75 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
