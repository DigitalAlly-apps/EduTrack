import { useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import TodayView from '@/components/TodayView';
import ProgressView from '@/components/ProgressView';
import SetupView from '@/components/SetupView';
import InfoView from '@/components/InfoView';
import ExamView from '@/components/ExamView';
import Onboarding from '@/components/Onboarding';
import QuickAddModal from '@/components/QuickAddModal';
import TeacherLeaveModal from '@/components/TeacherLeaveModal';
import { ViewType } from '@/lib/types';
import { getData, loadDemo, pruneOldSessions } from '@/lib/data';
import { initNotifications } from '@/lib/notifications';

type AppView = ViewType;

function AppInner() {
  const [view, setView] = useState<AppView>('today');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('pengajar_theme') || 'dark');


  useEffect(() => {
    if (view !== 'today') return;
    const data = getData();
    const hasData = data.classes.length > 0 || data.schedules.length > 0;
    const onboarded = localStorage.getItem('pengajar_onboarded');
    if (!hasData && !onboarded) setShowOnboarding(true);
    initNotifications();
    pruneOldSessions();
  }, [view]);

  useEffect(() => {
    document.documentElement.className = theme === 'light' ? 'light' : '';
  }, [theme]);

  // Listen for custom nav events (from LandingPage footer, AuthModal links)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as AppView;
      setView(detail);
    };
    window.addEventListener('edutrack-nav', handler);
    return () => window.removeEventListener('edutrack-nav', handler);
  }, []);


  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const handleViewChange = (v: ViewType) => {
    setView(v);
    setRefreshKey(k => k + 1);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pengajar_theme', next);
    setTheme(next);
  };



  // ── Main App Shell ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-[430px] mx-auto h-screen flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 -z-20 bg-background" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      <Header
        onToggleTheme={toggleTheme}
        onOpenLeave={() => setLeaveModalOpen(true)}
        theme={theme}
      />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-[10px] pb-[120px] scrollbar-thin relative z-0">
        {view === 'today'    && <TodayView refreshKey={refreshKey} onRefresh={refresh} />}
        {view === 'progress' && <ProgressView key={refreshKey} />}
        {view === 'exam'     && <ExamView refreshKey={refreshKey} onRefresh={refresh} />}
        {view === 'setup'    && <SetupView onRefresh={refresh} />}
        {view === 'info'     && <InfoView />}
      </div>

      <BottomNav currentView={view as ViewType} onViewChange={handleViewChange} />

      {showOnboarding && (
        <Onboarding
          onComplete={() => { setShowOnboarding(false); refresh(); }}
          onLoadDemo={() => { loadDemo(); }}
        />
      )}

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onRefresh={refresh} />
      <TeacherLeaveModal open={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} onRefresh={refresh} />
    </div>
  );
}

export default function Index() {
  return <AppInner />;
}
