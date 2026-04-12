import { ViewType } from '@/lib/types';

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { id: ViewType; icon: string; label: string }[] = [
  { id: 'today', icon: '⚡', label: 'Hari Ini' },
  { id: 'progress', icon: '📈', label: 'Progres' },
  { id: 'exam', icon: '📝', label: 'Ujian' },
  { id: 'setup', icon: '⚙️', label: 'Kelola' },
  { id: 'info', icon: 'ℹ️', label: 'Info' },
];

export default function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <div className="flex-shrink-0 absolute bottom-0 left-0 right-0 z-50 p-4 pb-8 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none">
      <nav className="mx-auto max-w-[360px] pointer-events-auto h-[68px] bg-nav/80 backdrop-blur-xl border border-border2 rounded-[24px] flex items-center px-2 justify-between shadow-2xl transition-colors">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex-1 flex flex-col items-center gap-[4px] py-1 px-[6px] rounded-[18px] text-[10px] font-bold tracking-[0.3px] transition-all duration-300 min-h-[52px] justify-center relative ${
              currentView === item.id ? 'text-primary' : 'text-text3 hover:text-text2 hover:bg-surface2/50'
            }`}
          >
            {currentView === item.id && (
              <span className="absolute inset-0 bg-primary/10 rounded-[18px] blur-sm animate-pulse-dot" style={{ animationDuration: '3s' }} />
            )}
            <span className={`text-[22px] transition-all duration-300 relative z-10 ${currentView === item.id ? 'scale-[1.1] drop-shadow-md' : 'grayscale-[50%] opacity-80'}`}>
              {item.icon}
            </span>
            <span className="relative z-10">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
