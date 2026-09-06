import React from 'react';
import { CalendarCheck2, ChartNoAxesCombined, ClipboardList, SlidersHorizontal } from 'lucide-react';
import { ViewType } from '@/lib/types';

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { id: ViewType; icon: React.ElementType; label: string }[] = [
  { id: 'today',    icon: CalendarCheck2,      label: 'Hari Ini' },
  { id: 'progress', icon: ChartNoAxesCombined, label: 'Progres'  },
  { id: 'exam',     icon: ClipboardList,       label: 'Ujian'    },
  { id: 'setup',    icon: SlidersHorizontal,   label: 'Kelola'   },
];

export default function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <div
      className="fixed inset-x-0 z-50 px-4 pointer-events-none"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <nav aria-label="Navigasi utama" className="mx-auto max-w-[560px] pointer-events-auto min-h-[74px] bg-nav backdrop-blur-2xl border border-border2 rounded-3xl flex items-center px-2.5 justify-between shadow-[0_22px_60px_rgba(0,0,0,0.32)] transition-colors relative overflow-hidden">
        <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-1 px-1.5 rounded-2xl text-[12px] font-bold tracking-tight transition-all duration-300 min-h-[54px] justify-center relative ${
                isActive ? 'text-primary-foreground' : 'text-text2 hover:text-foreground hover:bg-surface2/60'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute inset-1 bg-primary rounded-2xl shadow-primary" />
              )}
              <Icon aria-hidden="true" className={`w-5 h-5 transition-all duration-300 relative z-10 ${isActive ? 'scale-110' : 'opacity-75'}`} strokeWidth={isActive ? 2.7 : 2.2} />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
