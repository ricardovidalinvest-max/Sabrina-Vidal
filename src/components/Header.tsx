import React from 'react';
import { Calendar, Wrench } from 'lucide-react';

interface HeaderProps {
  onOpenBooking: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBooking }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-950/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single clean element) */}
        <a
          href="#"
          className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0 hover:text-emerald-800 transition-colors font-serif-display"
        >
          Drª Sabrina Vidal
        </a>

        {/* Zone 2: Clean Nav Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-emerald-950/75">
          <a href="#como-funciona" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
            Como Funciona
          </a>
          <a href="#solucao" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
            Nutrição Social
          </a>
          <a href="#o-que-inclui" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
            O Que Inclui
          </a>
          <a href="#depoimentos" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
            Depoimentos
          </a>
          <a href="#preco" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
            Valor Social
          </a>
          <a href="#duvidas" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
            Dúvidas
          </a>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenBooking}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] rounded-xl shadow-xs transition-all whitespace-nowrap cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Agendar Consulta</span>
          </button>
        </div>
      </div>
    </header>
  );
};
