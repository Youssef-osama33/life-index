'use client';

import { useEffect, useMemo, useState } from 'react';
import LifeIndexView from '../components/LifeIndexView';
import ArbaeenView from '../components/ArbaeenView';
import SettingsView from '../components/SettingsView';
import { createEmptyState, loadState, saveState } from '../lib/storage';
import { computeIndexStats } from '../lib/engine';

export default function HomePage() {
  const [state, setState] = useState(createEmptyState);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState('index');

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const stats = useMemo(
    () => computeIndexStats(state.weeks, state.weights),
    [state.weeks, state.weights]
  );

  const arbaeenDone = useMemo(
    () => Object.values(state.arbaeen).filter((d) => d?.done).length,
    [state.arbaeen]
  );

  const handleSaveWeek = (weekEntry) => {
    setState((prev) => {
      const filtered = prev.weeks.filter((w) => w.week !== weekEntry.week);
      return { ...prev, weeks: [...filtered, weekEntry] };
    });
  };

  const handleDeleteWeek = (weekNum) => {
    setState((prev) => ({
      ...prev,
      weeks: prev.weeks.filter((w) => w.week !== weekNum),
    }));
  };

  const handleUpdateDay = (dayKey, entry) => {
    setState((prev) => ({
      ...prev,
      arbaeen: { ...prev.arbaeen, [dayKey]: entry },
    }));
  };

  const handleUpdateWeights = (weights) => {
    setState((prev) => ({ ...prev, weights }));
  };

  const handleImportState = (nextState) => {
    setState(nextState);
  };

  const handleResetClean = () => {
    setState(createEmptyState());
  };

  if (!hydrated) {
    return (
      <main className="shell">
        <div className="empty-box">جارٍ تحميل النظام...</div>
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
        {tab === 'index' && <LifeIndexView state={state} onSaveWeek={handleSaveWeek} />}
        {tab === 'arbaeen' && <ArbaeenView state={state} onUpdateDay={handleUpdateDay} />}
        {tab === 'settings' && (
          <SettingsView
            state={state}
            onUpdateWeights={handleUpdateWeights}
            onDeleteWeek={handleDeleteWeek}
            onImportState={handleImportState}
            onResetClean={handleResetClean}
          />
        )}
      </main>
    </div>
  );
}
