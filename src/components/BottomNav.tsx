import React from 'react';
import { Zap, TrendingUp, ClipboardList, Settings2 } from 'lucide-react';
import { ViewType } from '@/lib/types';

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { id: ViewType; icon: React.ElementType; label: string }[] = [
  { id: 'today',    icon: Zap,           label: 'Hari Ini' },
  { id: 'progress', icon: TrendingUp,    label: 'Progres'  },
  { id: 'exam',     icon: ClipboardList, label: 'Ujian'    },
  { id: 'setup',    icon: Settings2,     label: 'Kelola'   },
];

export default function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <div className="flex-shrink-0 absolute bottom-0 left-0 right-0 z-50 p-4 pb-8 pointer-events-none">
      <nav className="mx-auto max-w-[360px] pointer-events-auto h-[68px] bg-nav/80 backdrop-blur-xl border border-border2 rounded-3xl flex items-center px-2 justify-between shadow-2xl transition-colors">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex-1 flex flex-col items-center gap-[4px] py-1 px-[6px] rounded-2xl text-[12px] font-bold tracking-[0.3px] transition-all duration-300 min-h-[52px] justify-center relative ${
                isActive ? 'text-primary' : 'text-text3 hover:text-text2 hover:bg-surface2/50'
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 bg-primary/10 rounded-2xl blur-sm animate-pulse-dot" style={{ animationDuration: '3s' }} />
              )}
              <Icon className={`w-5 h-5 transition-all duration-300 relative z-10 ${isActive ? 'scale-[1.15] drop-shadow-md' : 'opacity-70'}`} />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
