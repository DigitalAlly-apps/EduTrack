import { Suspense, lazy, useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { ViewType } from '@/lib/types';
import { getData, loadDemo, pruneOldSessions, snapshotBeforeUnload, now } from '@/lib/data';
import { initNotifications } from '@/lib/notifications';
import InfoView from '@/components/InfoView';
import { CalendarCheck2, ChartNoAxesCombined, ClipboardList, SlidersHorizontal, Info, Moon, Sun, Cloud } from 'lucide-react';
import { supabase, type SupabaseUser } from '@/lib/supabase';
import { getCurrentUser, initCloudSync, pullCloudToLocal, pushLocalToCloud, unsubscribeRealtime } from '@/lib/supabaseSync';
import SyncModal from '@/components/SyncModal';
import { useToast } from '@/hooks/use-toast';

const TodayView = lazy(() => import('@/components/TodayView'));
const ProgressView = lazy(() => import('@/components/ProgressView'));
const SetupView = lazy(() => import('@/components/SetupView'));
const ExamView = lazy(() => import('@/components/ExamView'));
const Onboarding = lazy(() => import('@/components/Onboarding'));
const QuickAddModal = lazy(() => import('@/components/QuickAddModal'));

type AppView = ViewType;

const isAppView = (value: string | null): value is AppView =>
  value === 'today' || value === 'progress' || value === 'exam' || value === 'setup' || value === 'info';

const desktopNavItems: { id: AppView; icon: React.ElementType; label: string; desc: string }[] = [
  { id: 'today',    icon: CalendarCheck2,      label: 'Hari Ini',  desc: 'Jurnal KBM harian' },
  { id: 'progress', icon: ChartNoAxesCombined, label: 'Progres',   desc: 'Capaian & kalender' },
  { id: 'exam',     icon: ClipboardList,       label: 'Ujian',     desc: 'Jadwal & pengawasan' },
  { id: 'setup',    icon: SlidersHorizontal,   label: 'Kelola',    desc: 'Kelas & materi' },
  { id: 'info',     icon: Info,                label: 'Informasi', desc: 'Panduan & aplikasi' },
];

function ViewFallback() {
  return (
    <div className="space-y-3 pt-2 animate-pulse">
      <div className="h-24 rounded-3xl bg-surface2/70 border border-border" />
      <div className="h-32 rounded-3xl bg-surface2/50 border border-border" />
      <div className="h-20 rounded-2xl bg-surface2/40 border border-border" />
    </div>
  );
}

function AppInner() {
  const [view, setView] = useState<AppView>(() => {
    const viewParam = new URLSearchParams(window.location.search).get('view');
    return isAppView(viewParam) ? viewParam : 'today';
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('pengajar_theme') || 'dark');
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'connected' | 'syncing' | 'offline'>('idle');
  const { toast } = useToast();

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Init Supabase Auth & Realtime Sync
  useEffect(() => {
    const setupSync = async (u: SupabaseUser) => {
      setUser(u);
      setSyncStatus('syncing');
      try {
        const hasCloudData = await pullCloudToLocal(u.id);
        if (!hasCloudData) {
          await pushLocalToCloud(u.id);
        }
        refresh();
        initCloudSync(u.id, () => {
          refresh();
          toast({ title: '⚡ Data tersinkron dari perangkat lain' });
        });
        setSyncStatus('connected');
      } catch (e) {
        console.warn('Sync setup error:', e);
        setSyncStatus('offline');
      }
    };

    // Initial check
    getCurrentUser().then(u => {
      if (u) setupSync(u);
    });

    // Auth listener for login/logout/OAuth redirect
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const u: SupabaseUser = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name,
          avatarUrl: session.user.user_metadata?.avatar_url,
        };
        setupSync(u);
      } else {
        setUser(null);
        setSyncStatus('idle');
        unsubscribeRealtime();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refresh, toast]);

  useEffect(() => {
    if (view !== 'today') return;
    const data = getData();
    const hasData = data.classes.length > 0 || data.schedules.length > 0;
    const onboarded = localStorage.getItem('pengajar_onboarded');
    if (!hasData && !onboarded) setShowOnboarding(true);
    initNotifications();
    pruneOldSessions();
  }, [view]);

  // Snapshot data ke autosave saat tab/browser mau ditutup
  useEffect(() => {
    const handleBeforeUnload = () => snapshotBeforeUnload();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
    window.addEventListener('set-tab', handler);
    return () => {
      window.removeEventListener('edutrack-nav', handler);
      window.removeEventListener('set-tab', handler);
    };
  }, []);

  const handleViewChange = (v: ViewType) => {
    setView(v);
    setRefreshKey(k => k + 1);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pengajar_theme', next);
    setTheme(next);
  };

  const teacherData = getData();
  const rawTeacherName = teacherData.teacherName || 'Guru Pengampu';
  const teacherName = rawTeacherName.replace(/,?\s*[A-Z][A-Za-z]*\.[A-Za-z]+(\s*,?\s*[A-Z][A-Za-z]*\.[A-Za-z]+)*/g, '').trim();

  // ── Main App Shell ─────────────────────────────────────────────────────────
  return (
    <div className="app-frame max-w-[430px] mx-auto h-dvh flex flex-col overflow-hidden relative shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:my-3 sm:rounded-[36px] sm:border sm:border-border/70 lg:max-w-6xl lg:mx-auto lg:h-[92vh] lg:my-[4vh] lg:grid lg:grid-cols-[280px_1fr] lg:rounded-[36px] lg:border lg:border-border/70">
      <div className="absolute inset-x-6 top-0 h-24 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -right-10 top-32 h-40 w-40 rounded-full bg-teal/10 blur-3xl pointer-events-none" />

      {/* ── DESKTOP SIDEBAR (Visible only on lg: screens) ── */}
      <aside className="hidden lg:flex flex-col justify-between p-6 border-r border-border/60 bg-surface/30 backdrop-blur-xl relative z-20 overflow-y-auto">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-teal flex items-center justify-center text-primary-foreground font-black text-xl shadow-primary">
              🎓
            </div>
            <div>
              <div className="font-display font-bold text-xl leading-none text-foreground">EduTrack</div>
              <div className="text-[11px] text-text3 font-semibold mt-1">Pelacak KBM & Agenda</div>
            </div>
          </div>

          {/* Teacher info card */}
          <div className="glass-panel p-3.5 rounded-2xl border-border/60">
            <div className="text-[10px] font-black uppercase text-primary tracking-wider mb-1">
              {now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
            <div className="font-display font-bold text-base text-foreground truncate">
              {teacherName}
            </div>
            <div className="text-[11px] text-text3 mt-1 flex items-center gap-2">
              <span>{teacherData.classes.length} Kelas Aktif</span>
              <span className="opacity-40">•</span>
              <span>{teacherData.subjects.length} Mapel</span>
            </div>
          </div>

          {/* Cloud Sync Desktop Button */}
          <button
            onClick={() => setSyncModalOpen(true)}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
              syncStatus === 'connected'
                ? 'bg-green/10 border-green/30 text-foreground'
                : 'bg-surface2/60 border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg flex-shrink-0">{syncStatus === 'connected' ? '🟢' : '☁️'}</span>
              <div className="min-w-0">
                <div className="text-[12px] font-bold leading-tight truncate">
                  {syncStatus === 'connected' ? 'Multi-Device Sync' : 'Hubungkan Sync'}
                </div>
                <div className="text-[10px] text-text3 truncate">
                  {user ? user.email : 'Masuk dengan Google'}
                </div>
              </div>
            </div>
          </button>

          {/* Nav Menu */}
          <nav className="space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-text3 px-2 mb-2">Navigasi Utama</div>
            {desktopNavItems.map(item => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleViewChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 scale-[1.02]'
                      : 'text-text2 hover:text-foreground hover:bg-surface2/60 font-semibold'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-text3'}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] leading-tight">{item.label}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-primary-foreground/80' : 'text-text3'}`}>{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Controls */}
        <div className="pt-4 border-t border-border/40 flex items-center justify-between">
          <div className="text-[11px] font-medium text-text3">EduTrack v4.0</div>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-surface2 border border-border2 flex items-center justify-center text-text2 hover:text-foreground transition-all"
            title="Ganti Tema"
          >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT & MOBILE LAYOUT CONTAINER ── */}
      <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden relative z-10">
        {/* Mobile Header (Hidden on lg:) */}
        <div className="lg:hidden">
          <Header
            onToggleTheme={toggleTheme}
            theme={theme}
            syncStatus={syncStatus}
            user={user}
            onOpenSync={() => setSyncModalOpen(true)}
          />
        </div>

        {/* Content view container */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-[136px] lg:pb-6 lg:px-8 scrollbar-thin relative z-0">
          <Suspense fallback={<ViewFallback />}>
            {view === 'today'    && <TodayView refreshKey={refreshKey} onRefresh={refresh} />}
            {view === 'progress' && <ProgressView key={refreshKey} />}
            {view === 'exam'     && <ExamView refreshKey={refreshKey} onRefresh={refresh} />}
            {view === 'setup'    && <SetupView onRefresh={refresh} />}
            {view === 'info'     && <InfoView />}
          </Suspense>
        </div>

        {/* Mobile Bottom Navigation (Hidden on lg:) */}
        <div className="lg:hidden">
          <BottomNav currentView={view as ViewType} onViewChange={handleViewChange} />
        </div>
      </div>

      <Suspense fallback={null}>
        {showOnboarding && (
          <Onboarding
            onComplete={() => { setShowOnboarding(false); refresh(); }}
            onLoadDemo={() => { loadDemo(); }}
          />
        )}

        <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onRefresh={refresh} />
        <SyncModal
          open={syncModalOpen}
          onClose={() => setSyncModalOpen(false)}
          onRefresh={refresh}
          syncStatus={syncStatus}
          user={user}
          onUserChange={setUser}
        />
      </Suspense>
    </div>
  );
}

export default function Index() {
  return <AppInner />;
}
