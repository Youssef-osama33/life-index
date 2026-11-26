'use client';

import { useMemo, useState } from 'react';
import { SECTORS } from '../lib/constants';
import { computeDashboardStats, exportSummaryCardPNG } from '../lib/engine';

export default function LifeIndexView({ state, onGoDaily, onSelectSector, onJumpToDay37 }) {
  const stats = useMemo(() => computeDashboardStats(state), [state]);
  const [selectedSector, setSelectedSector] = useState('total');

  const activeColor =
    selectedSector === 'total'
      ? '#22c55e'
      : SECTORS.find((s) => s.id === selectedSector)?.color || '#22c55e';

  const chartSeries = stats.dailySeries.slice(-30);
  const chartW = 720;
  const chartH = 220;
  const padX = 34;
  const padY = 20;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const points = chartSeries
    .map((item, idx) => {
      const val = selectedSector === 'total' ? item.total : item.sectorScores[selectedSector];
      if (typeof val !== 'number') return null;
      const x = chartSeries.length === 1 ? chartW / 2 : padX + (idx / (chartSeries.length - 1)) * innerW;
      const y = padY + innerH - (val / 100) * innerH;
      return { x, y, val, label: item.date.slice(5) };
    })
    .filter(Boolean);

  const weekMap = useMemo(() => {
    const map = {};
    for (const w of stats.weeklySeries) map[w.week] = w;
    return map;
  }, [stats.weeklySeries]);

  return (
    <div className="stack-lg">
      {stats.circuitBreaker.active && (
        <div className="card circuit-banner stack-sm">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <strong className="red">⚡ تفعيل قاطع الدائرة (CIRCUIT BREAKER)</strong>
            <span className="badge down">{stats.circuitBreaker.reasons.join(' • ')}</span>
          </div>
          {stats.circuitBreaker.planText ? (
            <div className="emergency-plan">
              <span className="xs muted">خطة الطوارئ (اليوم 37 من تحدي أربعين):</span>
              <p className="plan-text">{stats.circuitBreaker.planText}</p>
            </div>
          ) : (
            <button type="button" className="btn btn-danger" onClick={onJumpToDay37}>
              اكتب خطة الطوارئ الآن (اليوم 37)
            </button>
          )}
        </div>
      )}

      {/* بطاقات الأداء */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <span className="muted xs">آخر يوم مسجّل</span>
          <div className="kpi-row">
            <strong className="mono kpi-val">{stats.current}</strong>
            <span className={`badge ${stats.delta >= 0 ? 'up' : 'down'}`}>
              {stats.delta >= 0 ? `+${stats.delta}` : stats.delta}
            </span>
          </div>
          <span className="xs muted">{stats.daysCount} يوم • {stats.weeksCount}/52 أسبوع</span>
        </div>

        <div className="card kpi-card">
          <span className="muted xs">متوسط الأداء</span>
          <strong className="mono kpi-val">{stats.avg}</strong>
          <span className="xs muted">من 100 نقطة</span>
        </div>

        <div className="card kpi-card">
          <span className="muted xs">أعلى قمة (ATH)</span>
          <strong className="mono kpi-val green">{stats.ath.value}</strong>
          <span className="xs muted mono">{stats.ath.label}</span>
        </div>

        <div className="card kpi-card">
          <span className="muted xs">أقصى هبوط (Max DD)</span>
          <strong className="mono kpi-val red">-{stats.maxDrawdown}%</strong>
          <span className="xs muted">الحالي: -{stats.currentDrawdown}%</span>
        </div>
      </div>

      {/* رادار الدومينو وتصدير البطاقة */}
      <div className="card stack-sm">
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2>رادار الأنماط — محرك الدومينو</h2>
          <div className="chip-row">
            <button type="button" className="btn btn-primary" onClick={onGoDaily}>
              قيّم يومك الآن
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={stats.daysCount === 0}
              onClick={() => exportSummaryCardPNG(stats, state)}
            >
              بطاقة ملخص (.png)
            </button>
          </div>
        </div>

        {stats.strongest && stats.weakest && (
          <div className="diag-inline xs">
            <span>
              أقوى قطاع: <strong style={{ color: stats.strongest.color }}>{stats.strongest.name} ({stats.strongest.avg})</strong>
            </span>
            <span>
              أضعف قطاع: <strong className="red">{stats.weakest.name} ({stats.weakest.avg})</strong>
            </span>
          </div>
        )}

        {stats.daysCount < 4 ? (
          <p className="xs muted">
            سجّل {4 - stats.daysCount} أيام إضافية ليكشف محرك الدومينو الارتباطات الخفية بين قطاعاتك العشرة.
          </p>
        ) : stats.dominoInsights.length === 0 ? (
          <p className="xs muted">لم يُرصد ارتباط شديد (أكبر من 65%) بين قطاعين حتى الآن.</p>
        ) : (
          <div className="stack-sm">
            {stats.dominoInsights.map((ins, i) => (
              <div key={i} className="domino-item xs">
                <span className="badge up mono">{ins.pct}% ارتباط</span>
                <span>
                  أداء <strong>{ins.a.name}</strong> مرتبط مباشرة مع <strong>{ins.b.name}</strong>.
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* المنحنى البياني */}
      <div className="card">
        <div className="card-head">
          <h2>منحنى الأداء (آخر 30 يوم)</h2>
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${selectedSector === 'total' ? 'active' : ''}`}
              onClick={() => setSelectedSector('total')}
            >
              المؤشر العام
            </button>
            {SECTORS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip ${selectedSector === s.id ? 'active' : ''}`}
                onClick={() => setSelectedSector(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {points.length === 0 ? (
          <div className="empty-box">لا توجد أيام مسجّلة بعد — افتح التقييم اليومي لتبدأ المؤشر.</div>
        ) : (
          <div className="chart-wrap">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="chart-svg">
              {[0, 25, 50, 75, 100].map((lvl) => {
                const y = padY + innerH - (lvl / 100) * innerH;
                return (
                  <g key={lvl}>
                    <line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="#1f2937" strokeDasharray="3 3" />
                    <text x={8} y={y + 4} fill="#6b7280" fontSize="10" className="mono">{lvl}</text>
                  </g>
                );
              })}
              {points.length > 1 && (
                <polyline
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="2.5"
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              )}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="4" fill={activeColor} stroke="#030303" strokeWidth="1.5">
                    <title>{`${p.label}: ${p.val}`}</title>
                  </circle>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* بطاقات القطاعات العشرة السريعة */}
      <div className="card stack-md">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2>القطاعات الـ 10 (اضغط لفتح صفحة القطاع)</h2>
        </div>
        <div className="sectors-overview-grid">
          {stats.sectorAverages.map((s) => (
            <button
              key={s.id}
              type="button"
              className="sector-mini-card"
              onClick={() => onSelectSector(s.id)}
            >
              <div className="slider-top">
                <span className="xs">{s.name}</span>
                <strong className="mono xs" style={{ color: s.color }}>{s.avg}%</strong>
              </div>
              <div className="mini-bar-track">
                <div className="mini-bar-fill" style={{ width: `${s.avg}%`, background: s.color }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* خريطة الـ 52 أسبوعاً (مجمّعة تلقائياً من الأيام) */}
      <div className="card">
        <div className="card-head">
          <h2>خريطة الـ 52 أسبوعاً (تجميع تلقائي من الأيام)</h2>
        </div>
        <div className="heatmap-grid">
          {Array.from({ length: 52 }, (_, i) => i + 1).map((wk) => {
            const item = weekMap[wk];
            const val = item?.total ?? null;
            let cls = 'heat-empty';
            if (val !== null) {
              if (val >= 80) cls = 'heat-4';
              else if (val >= 65) cls = 'heat-3';
              else if (val >= 50) cls = 'heat-2';
              else cls = 'heat-1';
            }
            return (
              <div
                key={wk}
                className={`heat-cell ${cls}`}
                title={val !== null ? `الأسبوع #${wk}: متوسط ${val} (${item.daysCount} أيام)` : `الأسبوع #${wk}: غير مسجل`}
              >
                <span className="mono">{wk}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
