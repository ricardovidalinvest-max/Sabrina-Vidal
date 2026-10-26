import React from 'react';
import { ShieldCheck, Heart, Lock, CheckCircle2 } from 'lucide-react';

interface FooterProps {
  onOpenBooking: () => void;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenBooking, onOpenAdmin }) => {
  return (
    <footer className="bg-emerald-950 text-white border-t border-emerald-900 pt-14 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-emerald-900/80">
          {/* Brand & Credential Info */}
          <div className="md:col-span-5 space-y-4">
            <div className="text-2xl font-bold font-serif-display tracking-tight text-white">
              Drª Sabrina Vidal
            </div>
            <p className="text-sm text-emerald-200/80 max-w-sm leading-relaxed">
              Democratizando o acesso à nutrição clínica humanizada através de consultas online acolhedoras, comida de verdade e valores acessíveis.
            </p>
            <div className="space-y-1 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Drª Sabrina Vidal · CRN 17198 - GO</span>
              </div>
              <div className="text-emerald-300/80">
                E-mail: <a href="mailto:nutricionistasabrinaamorim@gmail.com" className="hover:underline text-emerald-200">nutricionistasabrinaamorim@gmail.com</a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Navegação
            </h4>
            <ul className="space-y-2 text-sm text-emerald-200/80">
              <li>
                <a href="#como-funciona" className="hover:text-white transition-colors">
                  Como Funciona
                </a>
              </li>
              <li>
                <a href="#solucao" className="hover:text-white transition-colors">
                  Nutrição Social
                </a>
              </li>
              <li>
                <a href="#o-que-inclui" className="hover:text-white transition-colors">
                  O Que Está Incluso
                </a>
              </li>
              <li>
                <a href="#preco" className="hover:text-white transition-colors">
                  Valor Social (R$ 79)
                </a>
              </li>
              <li>
                <a href="#duvidas" className="hover:text-white transition-colors">
                  Dúvidas Frequentes
                </a>
              </li>
            </ul>
          </div>

          {/* Patient Care & Security Column */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Atendimento & Segurança
            </h4>
            <p className="text-xs text-emerald-300/80 leading-relaxed">
              Consultas online com sigilo profissional, acolhimento integral e envio imediato do plano alimentar no seu WhatsApp.
            </p>
            <div className="space-y-2 text-xs text-emerald-200/90 pt-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Atendimento online para todo o Brasil e exterior</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pagamento seguro via PIX com confirmação imediata</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Lembretes e link da sala de consulta enviados no WhatsApp</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Sub-Footer */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-emerald-400/80">
          <div>
            © {new Date().getFullYear()} Drª Sabrina Vidal Nutricionista (CRN 17198 - GO). Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-1">
            <span>Feito com</span>
            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
            <span>para saúde acessível no Brasil</span>
          </div>
          <div>
            <button
              onClick={onOpenAdmin}
              type="button"
              className="inline-flex items-center gap-1.5 text-[11px] text-emerald-500/70 hover:text-emerald-300 transition-colors cursor-pointer"
              title="Acesso Administrativo & Logs"
            >
              <Lock className="w-3 h-3" />
              <span>Acesso Restrito</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
