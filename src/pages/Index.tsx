import { useSearchParams } from 'react-router-dom';
import { Suspense, lazy, useState, useCallback, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { ViewType } from '@/lib/types';
import { getData, loadDemo, pruneOldSessions, now } from '@/lib/data';
import { normalizeProgressConsistency } from '@/lib/progressConsistency';
import { initNotifications } from '@/lib/notifications';
import InfoView from '@/components/InfoView';
import { CalendarCheck2, ChartNoAxesCombined, ClipboardList, SlidersHorizontal, Moon, Sun, GraduationCap, Cloud, Info } from 'lucide-react';
import { supabase, type SupabaseUser } from '@/lib/supabase';
import { getCurrentUser, initCloudSync, pullCloudToLocal, pushLocalToCloud, unsubscribeRealtime, REMOTE_SYNC_EVENT } from '@/lib/supabaseSync';
import SyncModal from '@/components/SyncModal';
import { useToast } from '@/hooks/use-toast';

const TodayView = lazy(() => import('@/components/TodayView'));
const ProgressView = lazy(() => import('@/components/ProgressView'));
const SetupView = lazy(() => import('@/components/SetupView'));
const ExamView = lazy(() => import('@/components/ExamView'));
const Onboarding = lazy(() => import('@/components/Onboarding'));
const QuickAddModal = lazy(() => import('@/components/QuickAddModal'));

type AppView = ViewType;
type ExamTab = 'agenda' | 'koreksi' | 'riwayat' | 'settings';

const isAppView = (value: string | null): value is AppView =>
  value === 'today' || value === 'progress' || value === 'exam' || value === 'setup' || value === 'info';

const desktopNavItems: { id: AppView; icon: React.ElementType; label: string; desc: string }[] = [
  { id: 'today',    icon: CalendarCheck2,      label: 'Hari Ini',  desc: 'Jurnal KBM harian' },
  { id: 'progress', icon: ChartNoAxesCombined, label: 'Progres',   desc: 'Pantau progres & risiko' },
  { id: 'exam',     icon: ClipboardList,       label: 'Ujian',     desc: 'Jadwal & pengawasan' },
  { id: 'setup',    icon: SlidersHorizontal,   label: 'Kelola', desc: 'Kelas, jadwal & data' },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view: AppView = isAppView(requestedView) ? requestedView : 'today';
  const setView = useCallback((next: AppView) => {
    setSearchParams(previous => {
      const params = new URLSearchParams(previous);
      params.set('view', next);
      return params;
    });
  }, [setSearchParams]);
  const contentRef = useRef<HTMLElement>(null);
  const previousView = useRef(view);
  useEffect(() => {
    if (previousView.current === view) return;
    contentRef.current?.scrollTo({ top: 0 });
    contentRef.current?.focus({ preventScroll: true });
    previousView.current = view;
  }, [view]);
  const [examTab, setExamTab] = useState<ExamTab>('agenda');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('pengajar_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'connected' | 'syncing' | 'offline'>('idle');
  const { toast } = useToast();

  const refresh = useCallback(() => {
    normalizeProgressConsistency();
    setRefreshKey(k => k + 1);
  }, []);

  // Mutation dari ProgressView juga melewati normalizer yang sama agar Hari Ini
  // dan Progress tidak pernah membaca posisi bab dari state yang berbeda.
  useEffect(() => {
    const handleDataChanged = () => {
      normalizeProgressConsistency();
      setRefreshKey(k => k + 1);
    };
    window.addEventListener('edutrack-data-changed', handleDataChanged);
    return () => window.removeEventListener('edutrack-data-changed', handleDataChanged);
  }, []);

  // Init Supabase Auth & Realtime Sync
  useEffect(() => {
    const setupSync = async (u: SupabaseUser) => {
      setUser(u);
      setSyncStatus('syncing');
      try {
        const hasCloudData = await pullCloudToLocal(u.id);
        if (!hasCloudData) {
          await pushLocalToCloud(u.id);
        } else {
          // Data cloud berhasil di-pull, normalisasi lalu refresh komponen sekali
          refresh();
        }
        // initCloudSync sekarang tidak butuh callback —
        // update remote diterima via REMOTE_SYNC_EVENT (tanpa re-mount)
        initCloudSync(u.id);
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

    // Terima update dari perangkat lain, normalisasi posisi bab dan refresh ringan.
    const handleRemoteSync = () => {
      normalizeProgressConsistency();
      setRefreshKey(k => k + 1);
      toast({ title: '⚡ Tersinkron dari perangkat lain', duration: 2000 });
    };
    const handleDataChanged = () => {
      refresh();
    };
    window.addEventListener(REMOTE_SYNC_EVENT, handleRemoteSync);
    window.addEventListener('edutrack-data-changed', handleDataChanged);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener(REMOTE_SYNC_EVENT, handleRemoteSync);
      window.removeEventListener('edutrack-data-changed', handleDataChanged);
    };
  }, [refresh, toast]);

  useEffect(() => {
    normalizeProgressConsistency();
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
      const detail = (e as CustomEvent).detail;
      if (!isAppView(detail)) return;
      normalizeProgressConsistency();
      setExamTab('agenda');
      setView(detail);
      setRefreshKey(k => k + 1);
    };
    window.addEventListener('edutrack-nav', handler);
    window.addEventListener('set-tab', handler);
    return () => {
      window.removeEventListener('edutrack-nav', handler);
      window.removeEventListener('set-tab', handler);
    };
  }, [setView]);

  const handleViewChange = (v: ViewType) => {
    normalizeProgressConsistency();
    setExamTab('agenda');
    setView(v);
    setRefreshKey(k => k + 1);
  };

  const openExamSettings = () => {
    normalizeProgressConsistency();
    setExamTab('settings');
    setView('exam');
    setRefreshKey(k => k + 1);
  };

  const returnToSetup = () => {
    normalizeProgressConsistency();
    setView('setup');
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
    <div className="app-frame w-full mx-auto h-dvh flex flex-col overflow-hidden relative lg:max-w-none lg:w-full lg:h-dvh lg:my-0 lg:rounded-none lg:border-none lg:shadow-none lg:grid lg:grid-cols-[256px_1fr]">
      <a href="#main-content" className="skip-link">Langsung ke konten</a>

      {/* ── DESKTOP SIDEBAR (Visible only on lg: screens) ── */}
      <aside className="hidden lg:flex flex-col justify-between p-6 border-r border-border/60 bg-surface/30 backdrop-blur-xl relative z-20 overflow-y-auto">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-teal flex items-center justify-center text-primary-foreground font-black text-xl shadow-primary">
              <GraduationCap aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display font-bold text-xl leading-none text-foreground">EduTrack</div>
              <div className="text-xs text-text3 font-semibold mt-1">Pelacak KBM & Agenda</div>
            </div>
          </div>

          {/* Teacher info card */}
          <div className="glass-panel p-3.5 rounded-2xl border-border/60">
            <div className="text-xs font-black uppercase text-primary tracking-wider mb-1">
              {now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
            <div className="font-display font-bold text-base text-foreground truncate">
              {teacherName}
            </div>
            <div className="text-xs text-text3 mt-1 flex items-center gap-2">
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
              <Cloud aria-hidden="true" className="h-5 w-5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[12px] font-bold leading-tight truncate">
                  {syncStatus === 'connected' ? 'Sinkronisasi aktif' : 'Hubungkan perangkat'}
                </div>
                <div className="text-xs text-text3 truncate">
                  {user ? user.email : 'Masuk dengan Google'}
                </div>
              </div>
            </div>
          </button>

          {/* Nav Menu */}
          <nav className="space-y-1.5">
            <div className="text-xs font-black uppercase tracking-widest text-text3 px-2 mb-2">Navigasi Utama</div>
            {desktopNavItems.map(item => {
              const Icon = item.icon;
              const isActive = view === item.id || (view === 'info' && item.id === 'setup');
              return (
                <button
                  key={item.id}
                  onClick={() => handleViewChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                      : 'text-text2 hover:text-foreground hover:bg-surface2/60 font-semibold'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-text3'}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] leading-tight">{item.label}</div>
                    <div className={`text-xs truncate ${isActive ? 'text-primary-foreground/80' : 'text-text3'}`}>{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Controls */}
        <div className="pt-4 border-t border-border/40 flex items-center justify-between">
          <div className="text-xs font-medium text-text3">EduTrack v4.0</div>
          <button
            onClick={toggleTheme}
            className="w-11 h-11 rounded-xl bg-surface2 border border-border2 flex items-center justify-center text-text2 hover:text-foreground transition-all"
            aria-label={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT & MOBILE LAYOUT CONTAINER ── */}
      <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden relative z-10 bg-background">
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

        {/* Desktop Top Navbar (Visible only on lg:) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-border/50 bg-surface/40 backdrop-blur-xl flex-shrink-0 relative z-20">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl shadow-inner flex-shrink-0">
              {view === 'today' && <CalendarCheck2 aria-hidden="true" className="h-5 w-5" />}
              {view === 'progress' && <ChartNoAxesCombined aria-hidden="true" className="h-5 w-5" />}
              {view === 'exam' && <ClipboardList aria-hidden="true" className="h-5 w-5" />}
              {view === 'setup' && <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />}
              {view === 'info' && <Info aria-hidden="true" className="h-5 w-5" />}
            </div>
            <div>
              <h1 className="font-display font-black text-xl text-foreground tracking-tight leading-tight">
                {view === 'today' && 'Jurnal KBM Hari Ini'}
                {view === 'progress' && 'Progres Pembelajaran'}
                {view === 'exam' && 'Jadwal & Pengawasan Ujian'}
                {view === 'setup' && 'Kelola EduTrack'}
                {view === 'info' && 'Tentang EduTrack'}
              </h1>
              <p className="text-xs text-text3 font-semibold mt-0.5">
                {now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSyncModalOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-[12px] font-bold transition-all ${
                syncStatus === 'connected'
                  ? 'bg-green/10 border-green/30 text-green hover:bg-green/15'
                  : 'bg-surface2/60 border-border text-text2 hover:border-primary/40'
              }`}
            >
              <Cloud aria-hidden="true" className="h-4 w-4" />
              <span>{syncStatus === 'connected' ? (user?.email || 'Tersambung') : 'Hubungkan perangkat'}</span>
            </button>

            <button
              onClick={toggleTheme}
              className="w-11 h-11 rounded-2xl bg-surface2 border border-border flex items-center justify-center text-text2 hover:text-foreground transition-all shadow-sm"
              aria-label={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Content view container. Jangan buat stacking-context sendiri: modal view harus bisa mengalahkan floating nav. */}
        <main id="main-content" ref={contentRef} tabIndex={-1} aria-label={desktopNavItems.find(item => item.id === view)?.label || 'Panduan'} className="app-content flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-[calc(120px+env(safe-area-inset-bottom))] lg:pb-8 lg:px-10 lg:pt-6 scrollbar-thin">
          <div className="max-w-5xl mx-auto w-full">
            <div className="lg:hidden mb-5">
              <h1 className="font-display text-2xl font-bold">{desktopNavItems.find(item => item.id === view)?.label || 'Panduan'}</h1>
              <p className="text-sm text-text2 mt-1">{desktopNavItems.find(item => item.id === view)?.desc || 'Kenali fitur dan cara menggunakan EduTrack.'}</p>
            </div>
            <Suspense fallback={<ViewFallback />}>
              {view === 'today'    && <TodayView refreshKey={refreshKey} onRefresh={refresh} />}
              {view === 'progress' && <ProgressView key={refreshKey} />}
              {view === 'exam'     && <ExamView refreshKey={refreshKey} onRefresh={refresh} initialTab={examTab} />}
              {view === 'setup'    && <SetupView onRefresh={refresh} onOpenExamSettings={openExamSettings} onOpenInfo={() => setView('info')} />}
              {view === 'info'     && <InfoView onBackToSetup={returnToSetup} />}
            </Suspense>
          </div>
        </main>

        {/* Mobile Bottom Navigation (Hidden on lg:) */}
        <div className="lg:hidden">
          <BottomNav currentView={(view === 'info' ? 'setup' : view) as ViewType} onViewChange={handleViewChange} />
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
