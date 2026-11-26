'use client';

import { useMemo, useState } from 'react';
import { SECTORS } from '../lib/constants';
import { computeSectorHistory } from '../lib/engine';

export default function SectorDetailView({ state, sectorId, onSelectSector, onUpdateTasks }) {
  const sector = SECTORS.find((s) => s.id === sectorId) || SECTORS[0];
  const history = useMemo(() => computeSectorHistory(state, sector.id), [state, sector.id]);
  const tasks = state.sectorTasks?.[sector.id] || [];
  const [newTask, setNewTask] = useState('');

  const avg = history.length
    ? Number((history.reduce((a, b) => a + b.score, 0) / history.length).toFixed(1))
    : 0;
  const best = history.length ? Math.max(...history.map((h) => h.score)) : 0;
  const latest = history.length ? history[history.length - 1].score : 0;

  const toggleTask = (id) => {
    onUpdateTasks(
      sector.id,
      tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    onUpdateTasks(sector.id, [
      ...tasks,
      { id: `${sector.id}_${Date.now()}`, text: newTask.trim(), done: false },
    ]);
    setNewTask('');
  };

  const deleteTask = (id) => {
    onUpdateTasks(
      sector.id,
      tasks.filter((t) => t.id !== id)
    );
  };

  const chartW = 680;
  const chartH = 190;
  const padX = 32;
  const padY = 18;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const pts = history.map((h, i) => ({
    x: history.length === 1 ? chartW / 2 : padX + (i / (history.length - 1)) * innerW,
    y: padY + innerH - (h.score / 100) * innerH,
    ...h,
  }));

  return (
    <div className="stack-lg">
      {/* شريط تنقل سريع بين القطاعات الـ 10 */}
      <div className="chip-row">
        {SECTORS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${s.id === sector.id ? 'active' : ''}`}
            onClick={() => onSelectSector(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* بطاقة هوية القطاع */}
      <div className="card stack-sm" style={{ borderRight: `4px solid ${sector.color}` }}>
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2 style={{ color: sector.color }}>{sector.name}</h2>
          <span className="badge up mono">الوزن: {state.weights[sector.id]}%</span>
        </div>
        <p className="xs muted">{sector.tip}</p>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="card kpi-card">
          <span className="muted xs">آخر تقييم</span>
          <strong className="mono kpi-val" style={{ color: sector.color }}>{latest}%</strong>
        </div>
        <div className="card kpi-card">
          <span className="muted xs">متوسط 30 يوم</span>
          <strong className="mono kpi-val">{avg}%</strong>
        </div>
        <div className="card kpi-card">
          <span className="muted xs">أعلى يوم</span>
          <strong className="mono kpi-val green">{best}%</strong>
        </div>
      </div>

      {/* منحنى أداء القطاع آخر 30 يوم */}
      <div className="card">
        <div className="card-head">
          <h2>منحنى الأداء (آخر {history.length} يوم)</h2>
        </div>
        {pts.length === 0 ? (
          <div className="empty-box">سجّل تقييمك اليومي ليظهر منحنى هذا القطاع هنا.</div>
        ) : (
          <div className="chart-wrap">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="chart-svg">
              {[0, 50, 100].map((lvl) => {
                const y = padY + innerH - (lvl / 100) * innerH;
                return (
                  <g key={lvl}>
                    <line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="#1f2937" strokeDasharray="3 3" />
                    <text x={6} y={y + 4} fill="#6b7280" fontSize="10" className="mono">{lvl}</text>
                  </g>
                );
              })}
              {pts.length > 1 && (
                <polyline
                  fill="none"
                  stroke={sector.color}
                  strokeWidth="2.5"
                  points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              )}
              {pts.map((p) => (
                <circle key={p.date} cx={p.x} cy={p.y} r="4" fill={sector.color}>
                  <title>{`${p.date}: ${p.score}%`}</title>
                </circle>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* خطة تحسين القطاع (قائمة مهام عملية قابلة للتعديل) */}
      <div className="card stack-md">
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2>خطة تحسين هذا القطاع</h2>
          <span className="xs mono muted">
            {tasks.filter((t) => t.done).length} / {tasks.length} منفّذ
          </span>
        </div>

        <form className="actions-row" style={{ marginTop: 0 }} onSubmit={addTask}>
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="أضف عادة أو إجراء عملي يرفع هذا القطاع..."
            className="input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">إضافة</button>
        </form>

        <div className="stack-sm">
          {tasks.map((t) => (
            <div key={t.id} className="task-item">
              <label className="habit-check" style={{ flex: 1 }}>
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                <span className={t.done ? 'line-through muted' : ''}>{t.text}</span>
              </label>
              <button type="button" className="btn-link red" onClick={() => deleteTask(t.id)}>
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
