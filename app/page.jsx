'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import LifeIndexView from '../components/LifeIndexView';
import DailyCheckinView from '../components/DailyCheckinView';
import SectorDetailView from '../components/SectorDetailView';
import ArbaeenView from '../components/ArbaeenView';
import JournalView from '../components/JournalView';
import SettingsView from '../components/SettingsView';
import AuthModal from '../components/AuthModal';
import {
  createEmptyState,
  getSavedPin,
  loadCloudState,
  loadLocalState,
  saveCloudState,
  saveLocalState,
} from '../lib/storage';
import { isCloudEnabled, supabase } from '../lib/supabase';
import { computeDashboardStats } from '../lib/engine';

export default function HomePage() {
  const [state, setState] = useState(createEmptyState);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState('daily');
  const [activeSectorId, setActiveSectorId] = useState('prayer');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('محلي');
  const [authOpen, setAuthOpen] = useState(false);
  const cloudLoadedRef = useRef(false);
  const syncTimerRef = useRef(null);

  const [locked, setLocked] = useState(false);
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinErr, setPinErr] = useState(false);

  useEffect(() => {
    setState(loadLocalState());
    if (getSavedPin()) setLocked(true);
    setHydrated(true);

    if (!isCloudEnabled || !supabase) return;

    const pullCloud = async (u) => {
      if (!u) {
        cloudLoadedRef.current = false;
        setSyncStatus('محلي');
        return;
      }
      setSyncStatus('جارٍ المزامنة...');
      const cloud = await loadCloudState(u.id);
      if (cloud) {
        setState(cloud);
        saveLocalState(cloud);
      }
      cloudLoadedRef.current = true;
      setSyncStatus('متزامن ✓');
    };

    supabase.auth.getSession().then(({ data }) => {
      const u = data?.session?.user || null;
      setUser(u);
      pullCloud(u);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      pullCloud(u);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveLocalState(state);

    if (isCloudEnabled && user && cloudLoadedRef.current) {
      setSyncStatus('جارٍ الحفظ...');
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(async () => {
        const res = await saveCloudState(user.id, state);
        setSyncStatus(res.ok ? 'متزامن ✓' : 'خطأ مزامنة');
      }, 800);
    }
  }, [state, hydrated, user]);

  const stats = useMemo(() => computeDashboardStats(state), [state]);
  const arbaeenDone = useMemo(
    () => Object.values(state.arbaeen).filter((d) => d?.done).length,
    [state.arbaeen]
  );

  const handleNavigate = (nextView, secId = null) => {
    setView(nextView);
    if (secId) setActiveSectorId(secId);
  };

  if (!hydrated) {
    return (
      <main className="shell">
        <div className="empty-box">جارٍ تحميل النظام...</div>
      </main>
    );
  }

  if (locked) {
    return (
      <main className="shell lock-screen">
        <form
          className="card lock-card stack-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (pinAttempt === getSavedPin()) {
              setLocked(false);
              setPinAttempt('');
              setPinErr(false);
            } else {
              setPinErr(true);
              setPinAttempt('');
            }
          }}
        >
          <div className="brand" style={{ justifyContent: 'center' }}>
            <span className="dot" />
            <strong>LIFE-IDX</strong>
          </div>
          <p className="xs muted" style={{ textAlign: 'center' }}>
            أدخل رمز الخصوصية (4 أرقام)
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={pinAttempt}
            onChange={(e) => setPinAttempt(e.target.value.replace(/\D/g, ''))}
            className="input mono"
            style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.4rem' }}
          />
          {pinErr && <div className="alert alert-err">الرمز غير صحيح</div>}
          <button type="submit" className="btn btn-primary">فتح</button>
        </form>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        view={view}
        activeSectorId={activeSectorId}
        onNavigate={handleNavigate}
        stats={stats}
        arbaeenDone={arbaeenDone}
        user={user}
        syncStatus={syncStatus}
        onOpenAuth={() => setAuthOpen(true)}
      />

      <div className="main-area">
        <header className="mobile-bar">
          <button type="button" className="menu-btn" onClick={() => setDrawerOpen(true)}>
            ☰
          </button>
          <div className="brand">
            <span className="dot" />
            <strong>LIFE-IDX</strong>
          </div>
          <button type="button" className="sync-pill" onClick={() => setAuthOpen(true)}>
            {user ? `☁ ${syncStatus}` : '☁ السحابة'}
          </button>
        </header>

        <main className="main-content">
          {view === 'daily' && (
            <DailyCheckinView
              state={state}
              onSaveDaily={(dateKey, entry) =>
                setState((prev) => ({
                  ...prev,
                  dailyLogs: { ...prev.dailyLogs, [dateKey]: entry },
                }))
              }
            />
          )}

          {view === 'dashboard' && (
            <LifeIndexView
              state={state}
              onGoDaily={() => handleNavigate('daily')}
              onSelectSector={(id) => handleNavigate('sector', id)}
              onJumpToDay37={() => handleNavigate('arbaeen')}
            />
          )}

          {view === 'sector' && (
            <SectorDetailView
              state={state}
              sectorId={activeSectorId}
              onSelectSector={(id) => setActiveSectorId(id)}
              onUpdateTasks={(secId, tasks) =>
                setState((prev) => ({
                  ...prev,
                  sectorTasks: { ...prev.sectorTasks, [secId]: tasks },
                }))
              }
            />
          )}

          {view === 'arbaeen' && (
            <ArbaeenView
              state={state}
              onUpdateDay={(dayKey, entry) =>
                setState((prev) => ({
                  ...prev,
                  arbaeen: { ...prev.arbaeen, [dayKey]: entry },
                }))
              }
            />
          )}

          {view === 'journal' && (
            <JournalView
              state={state}
              onAddJournal={(entry) =>
                setState((prev) => ({ ...prev, journal: [entry, ...(prev.journal || [])] }))
              }
              onDeleteJournal={(id) =>
                setState((prev) => ({
                  ...prev,
                  journal: (prev.journal || []).filter((j) => j.id !== id),
                }))
              }
            />
          )}

          {view === 'settings' && (
            <SettingsView
              state={state}
              onUpdateWeights={(weights) => setState((prev) => ({ ...prev, weights }))}
              onDeleteDay={(dateKey) =>
                setState((prev) => {
                  const next = { ...prev.dailyLogs };
                  delete next[dateKey];
                  return { ...prev, dailyLogs: next };
                })
              }
              onImportState={(nextState) => setState(nextState)}
              onResetClean={() => setState(createEmptyState())}
              onOpenAuth={() => setAuthOpen(true)}
            />
          )}
        </main>
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        user={user}
        onSignOut={async () => {
          if (supabase) await supabase.auth.signOut();
          setUser(null);
        }}
      />
    </div>
  );
}
