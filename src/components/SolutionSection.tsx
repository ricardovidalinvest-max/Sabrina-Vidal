import React from 'react';
import { COPY_CONTENT } from '../data/copywriting';
import { HeartHandshake, UtensilsCrossed, Sparkles } from 'lucide-react';

interface SolutionProps {
  onOpenBooking: () => void;
}

export const SolutionSection: React.FC<SolutionProps> = ({ onOpenBooking }) => {
  return (
    <section id="solucao" className="py-16 sm:py-24 bg-emerald-950 text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Visual: Everyday Healthy Food Image */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <div className="relative rounded-2xl overflow-hidden border border-emerald-800 shadow-xl">
              <img
                src="/assets/images/healthy_practical_meal_1792611411579.jpg"
                alt="Prato colorido e nutritivo do dia a dia com arroz, feijão, frango grelhado e salada fresca"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-cover aspect-4/3"
                loading="lazy"
              />
              <div className="p-4 bg-emerald-900/90 backdrop-blur-xs text-xs text-emerald-100 flex items-center justify-between">
                <span>Comida caseira, equilibrada e saborosa</span>
                <span className="font-semibold text-emerald-300">Sem ingredientes caros</span>
              </div>
            </div>
          </div>

          {/* Right Content: Solution Manifesto */}
          <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
            <div className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-400 uppercase">
              {COPY_CONTENT.solution.badge}
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white font-serif-display leading-tight">
              {COPY_CONTENT.solution.title}
            </h2>

            <p className="text-base sm:text-lg text-emerald-100/90 leading-relaxed">
              {COPY_CONTENT.solution.paragraph1}
            </p>

            <p className="text-sm sm:text-base text-emerald-200/80 leading-relaxed">
              {COPY_CONTENT.solution.paragraph2}
            </p>

            {/* 3 Pillars Bento-style Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-emerald-900/40 border border-emerald-800/80">
                <UtensilsCrossed className="w-5 h-5 text-emerald-400 mb-2" />
                <h4 className="text-sm font-bold text-white mb-1">
                  {COPY_CONTENT.solution.pillars[0].title}
                </h4>
                <p className="text-xs text-emerald-200/80 leading-normal">
                  {COPY_CONTENT.solution.pillars[0].description}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-900/40 border border-emerald-800/80">
                <HeartHandshake className="w-5 h-5 text-emerald-400 mb-2" />
                <h4 className="text-sm font-bold text-white mb-1">
                  {COPY_CONTENT.solution.pillars[1].title}
                </h4>
                <p className="text-xs text-emerald-200/80 leading-normal">
                  {COPY_CONTENT.solution.pillars[1].description}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-900/40 border border-emerald-800/80">
                <Sparkles className="w-5 h-5 text-emerald-400 mb-2" />
                <h4 className="text-sm font-bold text-white mb-1">
                  {COPY_CONTENT.solution.pillars[2].title}
                </h4>
                <p className="text-xs text-emerald-200/80 leading-normal">
                  {COPY_CONTENT.solution.pillars[2].description}
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={onOpenBooking}
                type="button"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all cursor-pointer"
              >
                <span>Quero participar da Nutrição Social</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
