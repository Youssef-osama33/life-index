'use client';

import { useState } from 'react';
import { SECTORS } from '../lib/constants';

export default function Sidebar({
  open,
  onClose,
  view,
  activeSectorId,
  onNavigate,
  stats,
  arbaeenDone,
  user,
  syncStatus,
  onOpenAuth,
}) {
  const [sectorsOpen, setSectorsOpen] = useState(true);

  const navItems = [
    { id: 'daily', label: 'التقييم اليومي', badge: '31 سؤال' },
    { id: 'dashboard', label: 'المؤشر العام', badge: `${stats.current}` },
    { id: 'arbaeen', label: 'تحدي أربعين', badge: `${arbaeenDone}/40` },
    { id: 'journal', label: 'اليوميات', badge: '' },
    { id: 'settings', label: 'الإعدادات والأوزان', badge: '' },
  ];

  const handleGo = (nextView, secId = null) => {
    onNavigate(nextView, secId);
    onClose();
  };

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <div className="brand">
            <span className="dot" />
            <strong>LIFE-IDX</strong>
            <span className="mono xs muted">v3</span>
          </div>
          <button type="button" className="btn-link muted mobile-only" onClick={onClose}>
            ✕
          </button>
        </div>

        <button type="button" className="sync-card" onClick={onOpenAuth}>
          <span className="xs">☁ {user ? syncStatus : 'ربط السحابة'}</span>
          <span className="mono xs muted">{user ? user.email.split('@')[0] : 'محلي'}</span>
        </button>

        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`side-link ${view === item.id ? 'active' : ''}`}
              onClick={() => handleGo(item.id)}
            >
              <span>{item.label}</span>
              {item.badge && <span className="side-badge mono">{item.badge}</span>}
            </button>
          ))}

          <div className="side-group">
            <button
              type="button"
              className="side-group-head"
              onClick={() => setSectorsOpen((o) => !o)}
            >
              <span>القطاعات الـ 10</span>
              <span className="mono xs">{sectorsOpen ? '▾' : '◂'}</span>
            </button>

            {sectorsOpen && (
              <div className="side-sublist">
                {SECTORS.map((sec) => {
                  const secStat = stats.sectorAverages.find((s) => s.id === sec.id);
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      className={`side-sublink ${view === 'sector' && activeSectorId === sec.id ? 'active' : ''}`}
                      onClick={() => handleGo('sector', sec.id)}
                    >
                      <span className="sec-dot-wrap">
                        <span className="sec-dot" style={{ background: sec.color }} />
                        <span>{sec.name}</span>
                      </span>
                      <span className="mono xs muted">{secStat?.avg ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
