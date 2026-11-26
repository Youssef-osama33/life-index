'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ARBAEEN_PHASES, ARBAEEN_PROMPTS, DAILY_HABITS } from '../lib/constants';
import { computeArbaeenStreak, generateArbaeenMarkdown } from '../lib/engine';

const DEFAULT_SECONDS = 45 * 60;

export default function ArbaeenView({ state, onUpdateDay }) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [phaseFilter, setPhaseFilter] = useState(0); // 0 = الكل
  const [showArchive, setShowArchive] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const endTimeRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    endTimeRef.current = Date.now() + secondsLeft * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setRunning(false);
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  const completedCount = useMemo(
    () => Object.values(state.arbaeen).filter((d) => d?.done).length,
    [state.arbaeen]
  );

  const streak = useMemo(() => computeArbaeenStreak(state.arbaeen), [state.arbaeen]);

  const dayKey = String(selectedDay);
  const currentEntry = state.arbaeen[dayKey] || {
    done: false,
    answer: '',
    habits: { noScroll: false, solitude: false, honestWrite: false },
  };

  const currentPhase = ARBAEEN_PHASES.find(
    (p) => selectedDay >= p.range[0] && selectedDay <= p.range[1]
  );

  const updateCurrent = (patch) => {
    onUpdateDay(dayKey, {
      ...currentEntry,
      ...patch,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleExportMd = () => {
    const md = generateArbaeenMarkdown(state.arbaeen);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbaeen-journal-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const visibleDays = Array.from({ length: 40 }, (_, i) => i + 1).filter((d) => {
    if (phaseFilter === 0) return true;
    const ph = ARBAEEN_PHASES.find((p) => p.id === phaseFilter);
    return ph ? d >= ph.range[0] && d <= ph.range[1] : true;
  });

  const answeredList = Object.entries(state.arbaeen)
    .filter(([, v]) => v?.answer?.trim())
    .sort(([a], [b]) => Number(b) - Number(a));

  return (
    <div className="stack-lg">
      {/* شريط التقدم + Streak + التايمر */}
      <div className="two-col">
        <div className="card stack-sm">
          <div className="card-head" style={{ marginBottom: 4 }}>
            <h2>تحدي الأربعين</h2>
            <div className="chip-row">
              <span className="badge up mono">{completedCount}/40</span>
              <span className="badge up mono">سلسلة: {streak} يوم</span>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(completedCount / 40) * 100}%` }} />
          </div>
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${phaseFilter === 0 ? 'active' : ''}`}
              onClick={() => setPhaseFilter(0)}
            >
              كل المراحل
            </button>
            {ARBAEEN_PHASES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${phaseFilter === p.id ? 'active' : ''}`}
                onClick={() => setPhaseFilter(p.id)}
              >
                {p.id}. {p.title}
              </button>
            ))}
          </div>
        </div>

        <div className="card timer-card">
          <div>
            <span className="xs muted">مؤقت الخلوة اليومية (45 دقيقة بلا مشتتات)</span>
            <div className="mono timer-display">{mm}:{ss}</div>
          </div>
          <div className="actions-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setRunning((r) => !r)}
            >
              {running ? 'إيقاف مؤقت' : 'بدء الخلوة'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setRunning(false);
                setSecondsLeft(DEFAULT_SECONDS);
              }}
            >
              إعادة ضبط
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleExportMd}>
              تصدير (.md)
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowArchive((s) => !s)}
            >
              {showArchive ? 'إخفاء الأرشيف' : `مراجعة إجاباتي (${answeredList.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* أرشيف المقارنة ومراجعة الإجابات السابقة */}
      {showArchive && (
        <div className="card stack-sm">
          <h2>مراجعة إجاباتك السابقة</h2>
          {answeredList.length === 0 ? (
            <p className="xs muted">لم تكتب أي إجابة بعد.</p>
          ) : (
            answeredList.map(([d, entry]) => (
              <div key={d} className="journal-card stack-sm">
                <div className="card-head" style={{ marginBottom: 0 }}>
                  <strong className="green">اليوم {d}: {ARBAEEN_PROMPTS[Number(d) - 1]}</strong>
                  <span className="xs mono muted">{entry.updatedAt}</span>
                </div>
                <p className="plan-text">{entry.answer}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* مصفوفة الأيام */}
      <div className="card">
        <div className="card-head">
          <h2>مصفوفة الأربعين يوماً</h2>
          <span className="xs muted">الأخضر = مكتمل • الأصفر = مسودة</span>
        </div>
        <div className="days-grid">
          {visibleDays.map((day) => {
            const entry = state.arbaeen[String(day)];
            const isDone = Boolean(entry?.done);
            const hasDraft = !isDone && Boolean(entry?.answer?.trim());
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`day-cell mono ${isDone ? 'day-done' : hasDraft ? 'day-draft' : ''} ${
                  selectedDay === day ? 'day-active' : ''
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* بطاقة اليوم النشط */}
      <div className="card stack-md">
        <div className="card-head">
          <div>
            <span className="xs muted">
              المرحلة {currentPhase?.id}: {currentPhase?.title}
            </span>
            <h2>اليوم {selectedDay}</h2>
          </div>
          <button
            type="button"
            className={`btn ${currentEntry.done ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => updateCurrent({ done: !currentEntry.done })}
          >
            {currentEntry.done ? 'مكتمل ✓' : 'تحديد كمكتمل'}
          </button>
        </div>

        <div className="prompt-box">{ARBAEEN_PROMPTS[selectedDay - 1]}</div>

        <div className="habits-row">
          {DAILY_HABITS.map((h) => (
            <label key={h.id} className="habit-check">
              <input
                type="checkbox"
                checked={Boolean(currentEntry.habits?.[h.id])}
                onChange={(e) =>
                  updateCurrent({
                    habits: { ...currentEntry.habits, [h.id]: e.target.checked },
                  })
                }
              />
              <span>{h.label}</span>
            </label>
          ))}
        </div>

        <div className="field">
          <label htmlFor="arbaeen-answer">إجابتك الصريحة (تُحفظ تلقائياً)</label>
          <textarea
            id="arbaeen-answer"
            rows={7}
            value={currentEntry.answer}
            onChange={(e) => updateCurrent({ answer: e.target.value })}
            placeholder="اكتب لنفسك فقط — بلا تجميل ولا شعارات..."
            className="textarea"
          />
        </div>
      </div>
    </div>
  );
}
