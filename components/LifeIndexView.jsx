'use client';

import { useMemo, useState } from 'react';
import { PILLARS, SUBSECTORS } from '../lib/constants';
import {
  calcWeightedScore,
  computeIndexStats,
  exportSummaryCardPNG,
  percentToRaw,
  rawToPercent,
} from '../lib/engine';

function getInitialScores() {
  return SUBSECTORS.reduce((acc, s) => {
    acc[s.id] = 70;
    return acc;
  }, {});
}

function getInitialRaw() {
  return SUBSECTORS.reduce((acc, s) => {
    acc[s.id] = percentToRaw(s, 70);
    return acc;
  }, {});
}

export default function LifeIndexView({ state, onSaveWeek, onJumpToDay37 }) {
  const stats = useMemo(
    () => computeIndexStats(state.weeks, state.weights, state.arbaeen),
    [state.weeks, state.weights, state.arbaeen]
  );

  const nextWeekDefault = useMemo(() => {
    if (state.weeks.length === 0) return 1;
    return Math.min(52, Math.max(...state.weeks.map((w) => w.week)) + 1);
  }, [state.weeks]);

  const [selectedPillar, setSelectedPillar] = useState('total');
  const [inputMode, setInputMode] = useState('raw'); // 'raw' = أرقام صماء | 'slider' = منزلقات
  const [weekNum, setWeekNum] = useState(nextWeekDefault);
  const [scores, setScores] = useState(getInitialScores);
  const [rawMetrics, setRawMetrics] = useState(getInitialRaw);
  const [note, setNote] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const liveScore = calcWeightedScore(scores, state.weights);

  const loadExistingWeek = (wk) => {
    setWeekNum(wk);
    const found = state.weeks.find((w) => w.week === wk);
    if (found) {
      setScores({ ...found.scores });
      const derivedRaw = SUBSECTORS.reduce((acc, s) => {
        acc[s.id] = found.rawMetrics?.[s.id] ?? percentToRaw(s, found.scores[s.id]);
        return acc;
      }, {});
      setRawMetrics(derivedRaw);
      setNote(found.note || '');
    } else {
      setNote('');
    }
  };

  const handleRawChange = (sub, nextVal) => {
    const clamped = Math.max(0, Math.min(sub.max, Number(nextVal) || 0));
    setRawMetrics((prev) => ({ ...prev, [sub.id]: clamped }));
    setScores((prev) => ({ ...prev, [sub.id]: rawToPercent(sub, clamped) }));
  };

  const handleSliderChange = (sub, nextPct) => {
    const clamped = Math.max(0, Math.min(100, Number(nextPct) || 0));
    setScores((prev) => ({ ...prev, [sub.id]: clamped }));
    setRawMetrics((prev) => ({ ...prev, [sub.id]: percentToRaw(sub, clamped) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveWeek({
      week: Number(weekNum),
      date: new Date().toISOString().slice(0, 10),
      scores: { ...scores },
      rawMetrics: { ...rawMetrics },
      note: note.trim(),
    });
    setSavedMsg(`تم إغلاق الأسبوع #${weekNum} بدرجة ${liveScore}`);
    setTimeout(() => setSavedMsg(''), 3000);
  };

  // الرسم البياني
  const chartW = 720;
  const chartH = 220;
  const padX = 34;
  const padY = 20;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const activeColor =
    selectedPillar === 'total'
      ? '#22c55e'
      : PILLARS.find((p) => p.id === selectedPillar)?.color || '#22c55e';

  const points = stats.series.map((item, idx) => {
    const val = selectedPillar === 'total' ? item.total : item.pillars[selectedPillar];
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
      {/* قاطع الدائرة (Circuit Breaker) وربطه بخطة اليوم 37 */}
      {stats.circuitBreaker.active && (
        <div className="card circuit-banner stack-sm">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <strong className="red">⚡ تفعيل قاطع الدائرة (CIRCUIT BREAKER)</strong>
            <span className="badge down">{stats.circuitBreaker.reasons.join(' • ')}</span>
          </div>
          {stats.circuitBreaker.planText ? (
            <div className="emergency-plan">
              <span className="xs muted">خطة الطوارئ الخاصة بك (من اليوم 37 في تحدي أربعين):</span>
              <p className="plan-text">{stats.circuitBreaker.planText}</p>
            </div>
          ) : (
            <div className="actions-row" style={{ marginTop: 4 }}>
              <span className="xs muted">لم تكتب خطة الطوارئ في اليوم 37 بعد.</span>
              <button type="button" className="btn btn-danger" onClick={onJumpToDay37}>
                اكتب خطة الطوارئ الآن (اليوم 37)
              </button>
            </div>
          )}
        </div>
      )}

      {/* بطاقات الأداء الرئيسية */}
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
          <span className="muted">أقصى هبوط (Max DD)</span>
          <strong className="mono kpi-val red">-{stats.maxDrawdown}%</strong>
          <span className="xs muted">
            الحالي من القمة: <span className="mono">-{stats.currentDrawdown}%</span>
          </span>
        </div>
      </div>

      {/* محرك الدومينو (Correlation Engine) + التشخيص */}
      <div className="card stack-sm">
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2>رادار الأنماط — محرك الدومينو</h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => exportSummaryCardPNG(stats, state)}
            disabled={stats.count === 0}
          >
            تصدير بطاقة الملخص (.png)
          </button>
        </div>

        {stats.strongest && stats.weakest && (
          <div className="diag-inline xs">
            <span>
              أقوى قطاع:{' '}
              <strong style={{ color: stats.strongest.color }}>
                {stats.strongest.name} ({stats.strongest.avg})
              </strong>
            </span>
            <span>
              أكبر نقطة ضعف:{' '}
              <strong className="red">
                {stats.weakest.name} ({stats.weakest.avg})
              </strong>
            </span>
          </div>
        )}

        {stats.count < 4 ? (
          <p className="xs muted">
            محرك الدومينو يحتاج 4 أسابيع على الأقل لاكتشاف الارتباطات الخفية بين قطاعاتك (متبقي{' '}
            {4 - stats.count} أسابيع).
          </p>
        ) : stats.dominoInsights.length === 0 ? (
          <p className="xs muted">
            لم يُرصد ارتباط شديد (&ge;65%) بين قطاعين من محورين مختلفين حتى الآن.
          </p>
        ) : (
          <div className="stack-sm">
            {stats.dominoInsights.map((ins, i) => (
              <div key={i} className="domino-item xs">
                <span className="badge up mono">{ins.pct}% ارتباط</span>
                <span>
                  حركة <strong>{ins.a.name}</strong> مرتبطة بقوة مع <strong>{ins.b.name}</strong> —
                  عندما يهبط الأول يسحب الثاني معه مباشرة.
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* الرسم البياني للـ 5 محاور */}
      <div className="card">
        <div className="card-head">
          <h2>منحنى الأداء السنوي (5 محاور)</h2>
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${selectedPillar === 'total' ? 'active' : ''}`}
              onClick={() => setSelectedPillar('total')}
            >
              المؤشر العام
            </button>
            {PILLARS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${selectedPillar === p.id ? 'active' : ''}`}
                onClick={() => setSelectedPillar(p.id)}
              >
                {p.name}
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
                <polyline fill="none" stroke={activeColor} strokeWidth="2.5" points={polylineStr} />
              )}
              {points.map((p) => (
                <g key={p.week}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill={activeColor} stroke="#030303" strokeWidth="1.5">
                    <title>{`الأسبوع #${p.week}: ${p.val}`}</title>
                  </circle>
                  <text x={p.x} y={chartH - 4} textAnchor="middle" fill="#9ca3af" fontSize="10" className="mono">
                    W{p.week}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* خريطة الـ 52 أسبوعاً */}
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

      {/* نموذج الإغلاق الأسبوعي للـ 15 قطاعاً بوضع الأرقام الصماء أو المنزلقات */}
      <form className="card stack-md" onSubmit={handleSubmit}>
        <div className="card-head">
          <div>
            <h2>الإغلاق الأسبوعي (15 قطاعاً)</h2>
            <span className="xs muted">اختر الأرقام الصماء لقياس موضوعي بلا تحيز عاطفي</span>
          </div>
          <div className="live-pill mono">النتيجة: {liveScore}</div>
        </div>

        <div className="close-toolbar">
          <div className="field-inline" style={{ marginBottom: 0 }}>
            <label htmlFor="week-input">الأسبوع:</label>
            <input
              id="week-input"
              type="number"
              min="1"
              max="52"
              value={weekNum}
              onChange={(e) =>
                loadExistingWeek(Math.max(1, Math.min(52, Number(e.target.value) || 1)))
              }
              className="input mono"
              style={{ width: '76px' }}
            />
          </div>

          <div className="chip-row">
            <button
              type="button"
              className={`chip ${inputMode === 'raw' ? 'active' : ''}`}
              onClick={() => setInputMode('raw')}
            >
              أرقام صماء (موضوعي)
            </button>
            <button
              type="button"
              className={`chip ${inputMode === 'slider' ? 'active' : ''}`}
              onClick={() => setInputMode('slider')}
            >
              منزلقات سريعة
            </button>
          </div>
        </div>

        <div className="pillars-form-grid">
          {PILLARS.map((pillar) => {
            const subs = SUBSECTORS.filter((s) => s.pillarId === pillar.id);
            return (
              <div key={pillar.id} className="pillar-box stack-sm">
                <div className="pillar-head" style={{ borderRightColor: pillar.color }}>
                  <strong>{pillar.name}</strong>
                </div>

                {subs.map((sub) => (
                  <div key={sub.id} className="metric-row">
                    <div className="slider-top">
                      <div>
                        <span>{sub.name}</span>{' '}
                        <span className="xs muted mono">({state.weights[sub.id]}%)</span>
                      </div>
                      <strong className="mono" style={{ color: pillar.color }}>
                        {scores[sub.id]}%
                      </strong>
                    </div>

                    {inputMode === 'raw' && sub.inputType === 'raw' ? (
                      <div className="raw-control">
                        <span className="xs muted">{sub.unit}</span>
                        <div className="stepper">
                          <button
                            type="button"
                            className="step-btn"
                            onClick={() => handleRawChange(sub, (rawMetrics[sub.id] || 0) - 1)}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={sub.max}
                            value={rawMetrics[sub.id] ?? 0}
                            onChange={(e) => handleRawChange(sub, e.target.value)}
                            className="input mono step-input"
                          />
                          <button
                            type="button"
                            className="step-btn"
                            onClick={() => handleRawChange(sub, (rawMetrics[sub.id] || 0) + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={scores[sub.id]}
                        onChange={(e) => handleSliderChange(sub, e.target.value)}
                        className="range"
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
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
  );
}
