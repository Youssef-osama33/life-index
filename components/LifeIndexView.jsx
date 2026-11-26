'use client';

import { useMemo, useState } from 'react';
import { SECTORS } from '../lib/constants';
import { calcWeightedScore, computeIndexStats } from '../lib/engine';

export default function LifeIndexView({ state, onSaveWeek }) {
  const stats = useMemo(
    () => computeIndexStats(state.weeks, state.weights),
    [state.weeks, state.weights]
  );

  const nextWeekDefault = useMemo(() => {
    if (state.weeks.length === 0) return 1;
    const maxW = Math.max(...state.weeks.map((w) => w.week));
    return Math.min(52, maxW + 1);
  }, [state.weeks]);

  const [selectedSector, setSelectedSector] = useState('total');
  const [weekNum, setWeekNum] = useState(nextWeekDefault);
  const [scores, setScores] = useState({
    deen: 70,
    learning: 70,
    execution: 70,
    health: 70,
    mind: 70,
  });
  const [note, setNote] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const liveScore = calcWeightedScore(scores, state.weights);

  const loadExistingWeek = (wk) => {
    setWeekNum(wk);
    const found = state.weeks.find((w) => w.week === wk);
    if (found) {
      setScores({ ...found.scores });
      setNote(found.note || '');
    } else {
      setNote('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveWeek({
      week: Number(weekNum),
      date: new Date().toISOString().slice(0, 10),
      scores: { ...scores },
      note: note.trim(),
    });
    setSavedMsg(`تم إغلاق الأسبوع #${weekNum} بدرجة ${liveScore}`);
    setTimeout(() => setSavedMsg(''), 3000);
  };

  // تجهيز نقاط الرسم البياني
  const chartW = 720;
  const chartH = 220;
  const padX = 34;
  const padY = 20;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const activeColor =
    selectedSector === 'total'
      ? '#22c55e'
      : SECTORS.find((s) => s.id === selectedSector)?.color || '#22c55e';

  const points = stats.series.map((item, idx) => {
    const val = selectedSector === 'total' ? item.total : item.scores[selectedSector];
    const x =
      stats.series.length === 1
        ? chartW / 2
        : padX + (idx / (stats.series.length - 1)) * innerW;
    const y = padY + innerH - (val / 100) * innerH;
    return { x, y, val, week: item.week };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaStr =
    points.length > 1
      ? `${points[0].x},${padY + innerH} ${polylineStr} ${points[points.length - 1].x},${padY + innerH}`
      : '';

  const weekMap = useMemo(() => {
    const map = {};
    for (const s of stats.series) map[s.week] = s;
    return map;
  }, [stats.series]);

  return (
    <div className="stack-lg">
      {/* بطاقات الأداء */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <span className="muted">المؤشر الحالي (LIFE-IDX)</span>
          <div className="kpi-row">
            <strong className="mono kpi-val">{stats.current}</strong>
            <span className={`badge ${stats.delta >= 0 ? 'up' : 'down'}`}>
              {stats.delta >= 0 ? `+${stats.delta}` : stats.delta}
            </span>
          </div>
          <span className="xs muted">{stats.count} / 52 أسبوع مغلق</span>
        </div>

        <div className="card kpi-card">
          <span className="muted">متوسط السنة</span>
          <strong className="mono kpi-val">{stats.avg}</strong>
          <span className="xs muted">من 100 نقطة</span>
        </div>

        <div className="card kpi-card">
          <span className="muted">أعلى قمة (ATH)</span>
          <strong className="mono kpi-val green">{stats.ath.value}</strong>
          <span className="xs muted">
            {stats.ath.week ? `الأسبوع #${stats.ath.week}` : '—'}
          </span>
        </div>

        <div className="card kpi-card">
          <span className="muted">أدنى قاع (ATL)</span>
          <strong className="mono kpi-val red">{stats.atl.value}</strong>
          <span className="xs muted">
            {stats.atl.week ? `الأسبوع #${stats.atl.week}` : '—'}
          </span>
        </div>
      </div>

      {/* التشخيص التلقائي */}
      {stats.strongest && stats.weakest && (
        <div className="card diag-bar">
          <div>
            <span className="xs muted">أقوى قطاع داعم: </span>
            <strong style={{ color: stats.strongest.color }}>
              {stats.strongest.name} ({stats.strongest.avg})
            </strong>
          </div>
          <div>
            <span className="xs muted">القطاع الذي يسحب المؤشر للأسفل: </span>
            <strong style={{ color: '#ef4444' }}>
              {stats.weakest.name} ({stats.weakest.avg})
            </strong>
          </div>
        </div>
      )}

      {/* الرسم البياني */}
      <div className="card">
        <div className="card-head">
          <h2>منحنى الأداء السنوي</h2>
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
          <div className="empty-box">
            لا توجد أسابيع مسجّلة بعد — أضف أول إغلاق أسبوعي بالأسفل ليظهر المنحنى.
          </div>
        ) : (
          <div className="chart-wrap">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="chart-svg">
              {[0, 25, 50, 75, 100].map((lvl) => {
                const y = padY + innerH - (lvl / 100) * innerH;
                return (
                  <g key={lvl}>
                    <line
                      x1={padX}
                      y1={y}
                      x2={chartW - padX}
                      y2={y}
                      stroke="#1f2937"
                      strokeDasharray="3 3"
                    />
                    <text x={8} y={y + 4} fill="#6b7280" fontSize="10" className="mono">
                      {lvl}
                    </text>
                  </g>
                );
              })}
              {areaStr && <polygon points={areaStr} fill={activeColor} opacity="0.12" />}
              {points.length > 1 && (
                <polyline
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="2.5"
                  points={polylineStr}
                />
              )}
              {points.map((p) => (
                <g key={p.week}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill={activeColor} stroke="#030303" strokeWidth="1.5">
                    <title>{`الأسبوع #${p.week}: ${p.val}`}</title>
                  </circle>
                  <text
                    x={p.x}
                    y={chartH - 4}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize="10"
                    className="mono"
                  >
                    W{p.week}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* الخريطة الحرارية + نموذج الإغلاق الأسبوعي */}
      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h2>خريطة الـ 52 أسبوعاً</h2>
            <span className="xs muted">اضغط على أي أسبوع لتعديله</span>
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
                <button
                  key={wk}
                  type="button"
                  onClick={() => loadExistingWeek(wk)}
                  className={`heat-cell ${cls} ${weekNum === wk ? 'heat-selected' : ''}`}
                  title={val !== null ? `الأسبوع #${wk}: ${val}` : `الأسبوع #${wk}: غير مسجل`}
                >
                  <span className="mono">{wk}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <div className="card-head">
            <h2>الإغلاق الأسبوعي</h2>
            <div className="live-pill mono">النتيجة: {liveScore}</div>
          </div>

          <div className="field-inline">
            <label htmlFor="week-input">رقم الأسبوع (1 - 52)</label>
            <input
              id="week-input"
              type="number"
              min="1"
              max="52"
              value={weekNum}
              onChange={(e) => loadExistingWeek(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
              className="input mono"
              style={{ width: '90px' }}
            />
          </div>

          <div className="sliders-list">
            {SECTORS.map((s) => (
              <div key={s.id} className="slider-item">
                <div className="slider-top">
                  <span>
                    {s.name}{' '}
                    <span className="xs muted mono">({state.weights[s.id]}%)</span>
                  </span>
                  <strong className="mono" style={{ color: s.color }}>
                    {scores[s.id]}
                  </strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={scores[s.id]}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))
                  }
                  className="range"
                />
              </div>
            ))}
          </div>

          <div className="field">
            <label htmlFor="week-note">ملخص صريح للأسبوع (ماذا نجح وماذا انكسر؟)</label>
            <textarea
              id="week-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اكتب أسباب الصعود أو الهبوط بدون تبرير..."
              className="textarea"
            />
          </div>

          <div className="actions-row">
            <button type="submit" className="btn btn-primary">
              حفظ إغلاق الأسبوع #{weekNum}
            </button>
            {savedMsg && <span className="xs green">{savedMsg}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
