'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LifeIndexView from '../components/LifeIndexView';
import ArbaeenView from '../components/ArbaeenView';
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
import { computeIndexStats } from '../lib/engine';

export default function HomePage() {
  const [state, setState] = useState(createEmptyState);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState('index');

  // حالة السحابة وتسجيل الدخول
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('محلي');
  const [authOpen, setAuthOpen] = useState(false);
  const syncTimerRef = useRef(null);

  // قفل PIN المحلي
  const [locked, setLocked] = useState(false);
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinErr, setPinErr] = useState(false);

  // التحميل الأولي + مراقبة جلسة Supabase
  useEffect(() => {
    setState(loadLocalState());
    if (getSavedPin()) setLocked(true);
    setHydrated(true);

    if (!isCloudEnabled || !supabase) return;

    supabase.auth.getSession().then(async ({ data }) => {
      const u = data?.session?.user || null;
      setUser(u);
      if (u) {
        setSyncStatus('جارٍ المزامنة...');
        const cloud = await loadCloudState(u.id);
        if (cloud) {
          setState(cloud);
          saveLocalState(cloud);
        }
        setSyncStatus('متزامن ✓');
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        setSyncStatus('جارٍ المزامنة...');
        const cloud = await loadCloudState(u.id);
        if (cloud) {
          setState(cloud);
          saveLocalState(cloud);
        }
        setSyncStatus('متزامن ✓');
      } else {
        setSyncStatus('محلي');
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  // حفظ محلي فوري + مزامنة سحابية بـ debounce عند تسجيل الدخول
  useEffect(() => {
    if (!hydrated) return;
    saveLocalState(state);

    if (isCloudEnabled && user) {
      setSyncStatus('جارٍ الحفظ...');
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(async () => {
        const res = await saveCloudState(user.id, state);
        setSyncStatus(res.ok ? 'متزامن ✓' : 'خطأ مزامنة');
      }, 800);
    }
  }, [state, hydrated, user]);

  const stats = useMemo(
    () => computeIndexStats(state.weeks, state.weights, state.arbaeen),
    [state.weeks, state.weights, state.arbaeen]
  );

  const arbaeenDone = useMemo(
    () => Object.values(state.arbaeen).filter((d) => d?.done).length,
    [state.arbaeen]
  );

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinAttempt === getSavedPin()) {
      setLocked(false);
      setPinAttempt('');
      setPinErr(false);
    } else {
      setPinErr(true);
      setPinAttempt('');
    }
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
        <form className="card lock-card stack-md" onSubmit={handleUnlock}>
          <div className="brand" style={{ justifyContent: 'center' }}>
            <span className="dot" />
            <strong>LIFE-IDX</strong>
          </div>
          <p className="xs muted" style={{ textAlign: 'center' }}>
            أدخل رمز الخصوصية (4 أرقام) لفتح بياناتك
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
          <button type="submit" className="btn btn-primary">
            فتح
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          <strong>LIFE-IDX</strong>
          <span className="mono xs muted">{state.year}</span>
        </div>

        <div className="ticker mono xs">
          <span>
            IDX: <strong>{stats.current}</strong>
          </span>
          <span className={stats.delta >= 0 ? 'green' : 'red'}>
            {stats.delta >= 0 ? `▲ +${stats.delta}` : `▼ ${stats.delta}`}
          </span>
          <span>ARBAEEN: {arbaeenDone}/40</span>
          <button type="button" className="sync-pill" onClick={() => setAuthOpen(true)}>
            {user ? `☁ ${syncStatus}` : '☁ السحابة'}
          </button>
        </div>

        <nav className="tabs">
          <button
            type="button"
            className={`tab ${tab === 'index' ? 'active' : ''}`}
            onClick={() => setTab('index')}
          >
            مؤشر السنة
          </button>
          <button
            type="button"
            className={`tab ${tab === 'arbaeen' ? 'active' : ''}`}
            onClick={() => setTab('arbaeen')}
          >
            تحدي أربعين
          </button>
          <button
            type="button"
            className={`tab ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
          >
            الأوزان والسجل
          </button>
        </nav>
      </header>

      <main className="content">
        {tab === 'index' && (
          <LifeIndexView
            state={state}
            onSaveWeek={(weekEntry) =>
              setState((prev) => ({
                ...prev,
                weeks: [...prev.weeks.filter((w) => w.week !== weekEntry.week), weekEntry],
              }))
            }
            onJumpToDay37={() => setTab('arbaeen')}
          />
        )}
        {tab === 'arbaeen' && (
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
        {tab === 'settings' && (
          <SettingsView
            state={state}
            onUpdateWeights={(weights) => setState((prev) => ({ ...prev, weights }))}
            onDeleteWeek={(weekNum) =>
              setState((prev) => ({
                ...prev,
                weeks: prev.weeks.filter((w) => w.week !== weekNum),
              }))
            }
            onImportState={(nextState) => setState(nextState)}
            onResetClean={() => setState(createEmptyState())}
          />
        )}
      </main>

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
