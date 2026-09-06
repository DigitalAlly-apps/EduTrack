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
      className="fixed inset-x-0 bottom-0 z-50 pointer-events-none"
    >
      <nav aria-label="Navigasi utama" className="mx-auto max-w-[720px] pointer-events-auto min-h-[68px] bg-nav border-t border-border2 flex items-center px-2 justify-between transition-colors relative" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-1 px-1.5 rounded-lg text-xs font-bold tracking-tight transition-colors min-h-[52px] justify-center relative ${
                isActive ? 'text-primary' : 'text-text2 hover:text-foreground hover:bg-surface2/60'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute inset-x-4 top-0 h-0.5 bg-primary" />
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
