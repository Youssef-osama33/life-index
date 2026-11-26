'use client';

import { useEffect, useMemo, useState } from 'react';
import { SECTORS, DAILY_QUESTIONS } from '../lib/constants';
import { computeDailyResult, getDefaultAnswers, getTodayKey } from '../lib/engine';

export default function DailyCheckinView({ state, onSaveDaily }) {
  const [dateKey, setDateKey] = useState(getTodayKey);
  const [answers, setAnswers] = useState(getDefaultAnswers);
  const [note, setNote] = useState('');
  const [savedToast, setSavedToast] = useState('');

  useEffect(() => {
    const existing = state.dailyLogs?.[dateKey];
    if (existing) {
      setAnswers({ ...getDefaultAnswers(), ...existing.answers });
      setNote(existing.note || '');
    } else {
      setAnswers(getDefaultAnswers());
      setNote('');
    }
  }, [dateKey, state.dailyLogs]);

  const live = useMemo(
    () => computeDailyResult(answers, state.weights),
    [answers, state.weights]
  );

  const setVal = (id, val) => setAnswers((prev) => ({ ...prev, [id]: val }));

  const handleSave = (e) => {
    e.preventDefault();
    onSaveDaily(dateKey, {
      answers,
      note: note.trim(),
      updatedAt: new Date().toISOString(),
    });
    setSavedToast(`تم حفظ تقييم يوم ${dateKey} بدرجة ${live.total}/100`);
    setTimeout(() => setSavedToast(''), 3500);
  };

  return (
    <form className="stack-lg" onSubmit={handleSave}>
      <div className="card checkin-sticky">
        <div className="card-head" style={{ marginBottom: 8 }}>
          <div>
            <h2>التقييم اليومي السريع (31 سؤال)</h2>
            <span className="xs muted">قيّم يومك بالأرقام الفعلية وسيتحدّث مؤشر السنة تلقائياً</span>
          </div>
          <div className="live-pill mono">درجة اليوم: {live.total}</div>
        </div>

        <div className="close-toolbar">
          <div className="field-inline" style={{ marginBottom: 0 }}>
            <label htmlFor="daily-date" className="xs muted">تاريخ اليوم:</label>
            <input
              id="daily-date"
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className="input mono"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            حفظ تقييم اليوم
          </button>
        </div>
        {savedToast && <div className="alert alert-ok" style={{ marginTop: 10 }}>{savedToast}</div>}
      </div>

      <div className="pillars-form-grid">
        {SECTORS.map((sec) => {
          const qs = DAILY_QUESTIONS.filter((q) => q.sectorId === sec.id);
          const secScore = live.sectorScores[sec.id];

          return (
            <div key={sec.id} className="card stack-sm">
              <div className="pillar-head" style={{ borderRightColor: sec.color }}>
                <strong>{sec.name}</strong>
                <span className="mono xs" style={{ color: sec.color }}>
                  {secScore === null ? 'إجازة' : `${secScore}%`}
                </span>
              </div>

              {qs.map((q) => {
                const disabled = q.skipWhen && answers[q.skipWhen.id] === q.skipWhen.value;
                return (
                  <div key={q.id} className={`q-row ${disabled ? 'q-disabled' : ''}`}>
                    <div className="q-label">
                      <span>{q.label}</span>
                      {q.unit && <span className="xs muted">{q.unit}</span>}
                    </div>

                    {q.type === 'bool' && (
                      <div className="seg-group">
                        <button
                          type="button"
                          className={`seg-btn ${answers[q.id] === true ? 'seg-yes' : ''}`}
                          onClick={() => setVal(q.id, true)}
                        >
                          نعم
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${answers[q.id] === false ? 'seg-no' : ''}`}
                          onClick={() => setVal(q.id, false)}
                        >
                          لأ
                        </button>
                      </div>
                    )}

                    {q.type === 'tri' && (
                      <div className="seg-group">
                        <button
                          type="button"
                          className={`seg-btn ${answers[q.id] === 'yes' ? 'seg-yes' : ''}`}
                          onClick={() => setVal(q.id, 'yes')}
                        >
                          نعم
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${answers[q.id] === 'no' ? 'seg-no' : ''}`}
                          onClick={() => setVal(q.id, 'no')}
                        >
                          لأ
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${answers[q.id] === 'na' ? 'seg-na' : ''}`}
                          onClick={() => setVal(q.id, 'na')}
                        >
                          إجازة
                        </button>
                      </div>
                    )}

                    {q.type === 'rating' && (
                      <div className="seg-group">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`seg-btn mono ${Number(answers[q.id]) === n ? 'seg-yes' : ''}`}
                            onClick={() => setVal(q.id, n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}

                    {(q.type === 'count' || q.type === 'number' || q.type === 'bonus' || q.type === 'sleep' || q.type === 'inverse') && (
                      <div className="stepper">
                        <button
                          type="button"
                          className="step-btn"
                          disabled={disabled}
                          onClick={() => {
                            const next = Math.max(0, Number(((Number(answers[q.id]) || 0) - (q.step || 1)).toFixed(1)));
                            setVal(q.id, next);
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          step={q.step || 1}
                          min="0"
                          max={q.max}
                          disabled={disabled}
                          value={answers[q.id] ?? 0}
                          onChange={(e) => {
                            const n = Math.max(0, Math.min(q.max, Number(e.target.value) || 0));
                            setVal(q.id, n);
                          }}
                          className="input mono step-input"
                        />
                        <button
                          type="button"
                          className="step-btn"
                          disabled={disabled}
                          onClick={() => {
                            const next = Math.min(q.max, Number(((Number(answers[q.id]) || 0) + (q.step || 1)).toFixed(1)));
                            setVal(q.id, next);
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="card stack-md">
        <div className="field">
          <label htmlFor="daily-note">ملاحظة سريعة لليوم (اختياري)</label>
          <textarea
            id="daily-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="أبرز سبب لارتفاع أو هبوط يومك..."
            className="textarea"
          />
        </div>
        <div className="actions-row" style={{ marginTop: 0 }}>
          <button type="submit" className="btn btn-primary">
            حفظ تقييم يوم {dateKey}
          </button>
          {savedToast && <span className="xs green">{savedToast}</span>}
        </div>
      </div>
    </form>
  );
}
