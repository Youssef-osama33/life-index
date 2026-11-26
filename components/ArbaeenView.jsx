'use client';

import { useEffect, useRef, useState } from 'react';
import { ARBAEEN_PHASES, ARBAEEN_PROMPTS, DAILY_HABITS } from '../lib/constants';
import { generateArbaeenMarkdown } from '../lib/engine';

const SOLITUDE_SECONDS = 45 * 60;

export default function ArbaeenView({ state, onUpdateDay }) {
  const [activeDay, setActiveDay] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(SOLITUDE_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const endTimestampRef = useRef(null);

  const dayKey = String(activeDay);
  const currentEntry = state.arbaeen[dayKey] || {
    done: false,
    answer: '',
    habits: { noScroll: false, solitude: false, honestWrite: false },
  };

  // مؤقت دقيق يعتمد على Date.now() حتى لو كان التاب في الخلفية
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      if (!endTimestampRef.current) return;
      const remaining = Math.max(0, Math.ceil((endTimestampRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setIsRunning(false);
        endTimestampRef.current = null;
      }
    }, 250);
    return () => clearInterval(id);
  }, [isRunning]);

  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false);
      endTimestampRef.current = null;
    } else {
      const base = secondsLeft === 0 ? SOLITUDE_SECONDS : secondsLeft;
      endTimestampRef.current = Date.now() + base * 1000;
      setSecondsLeft(base);
      setIsRunning(true);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    endTimestampRef.current = null;
    setSecondsLeft(SOLITUDE_SECONDS);
  };

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const completedCount = Object.values(state.arbaeen).filter((d) => d?.done).length;
  const currentPhase = ARBAEEN_PHASES.find(
    (p) => activeDay >= p.range[0] && activeDay <= p.range[1]
  );

  const updateField = (patch) => {
    onUpdateDay(dayKey, {
      ...currentEntry,
      ...patch,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  };

  const toggleHabit = (habitId) => {
    updateField({
      habits: {
        ...currentEntry.habits,
        [habitId]: !currentEntry.habits?.[habitId],
      },
    });
  };

  const downloadMarkdown = () => {
    const md = generateArbaeenMarkdown(state.arbaeen);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbaeen-document-${state.year}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack-lg">
      {/* شريط التقدم والتايمر */}
      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h2>تقدم تحدي الأربعين</h2>
            <strong className="mono green">{completedCount} / 40 يوم</strong>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${(completedCount / 40) * 100}%` }}
            />
          </div>
          <div className="phase-pills">
            {ARBAEEN_PHASES.map((p) => (
              <span
                key={p.id}
                className={`xs phase-tag ${currentPhase?.id === p.id ? 'active' : ''}`}
              >
                {p.id}. {p.title} ({p.range[0]}-{p.range[1]})
              </span>
            ))}
          </div>
        </div>

        <div className="card timer-card">
          <div>
            <span className="xs muted">مؤقت الخلوة اليومية (45 دقيقة بلا مشتتات)</span>
            <div className="mono timer-display">{formatTime(secondsLeft)}</div>
          </div>
          <div className="actions-row">
            <button type="button" className="btn btn-primary" onClick={toggleTimer}>
              {isRunning ? 'إيقاف مؤقت' : 'بدء الخلوة'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={resetTimer}>
              إعادة ضبط
            </button>
            <button type="button" className="btn btn-ghost" onClick={downloadMarkdown}>
              تصدير الوثيقة (.md)
            </button>
          </div>
        </div>
      </div>

      {/* المصفوفة + محرر اليوم */}
      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h2>مصفوفة الـ 40 يوماً</h2>
            <span className="xs muted">اختر اليوم</span>
          </div>
          <div className="days-grid">
            {Array.from({ length: 40 }, (_, i) => i + 1).map((day) => {
              const entry = state.arbaeen[String(day)];
              const hasDraft = Boolean(entry?.answer?.trim());
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={`day-cell mono ${
                    entry?.done ? 'day-done' : hasDraft ? 'day-draft' : ''
                  } ${activeDay === day ? 'day-active' : ''}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card stack-md">
          <div className="card-head">
            <div>
              <span className="xs muted">
                المرحلة {currentPhase?.id}: {currentPhase?.title}
              </span>
              <h2>اليوم {activeDay}</h2>
            </div>
            <button
              type="button"
              onClick={() => updateField({ done: !currentEntry.done })}
              className={`btn ${currentEntry.done ? 'btn-primary' : 'btn-ghost'}`}
            >
              {currentEntry.done ? 'مكتمل ✓' : 'تحديد كمكتمل'}
            </button>
          </div>

          <blockquote className="prompt-box">{ARBAEEN_PROMPTS[activeDay - 1]}</blockquote>

          <div className="habits-row">
            {DAILY_HABITS.map((h) => (
              <label key={h.id} className="habit-check">
                <input
                  type="checkbox"
                  checked={Boolean(currentEntry.habits?.[h.id])}
                  onChange={() => toggleHabit(h.id)}
                />
                <span>{h.label}</span>
              </label>
            ))}
          </div>

          <div className="field">
            <label htmlFor="arbaeen-answer">إجابتك الصريحة (تُحفظ تلقائياً)</label>
            <textarea
              id="arbaeen-answer"
              rows={8}
              value={currentEntry.answer || ''}
              onChange={(e) => updateField({ answer: e.target.value })}
              placeholder="اكتب لنفسك فقط — بلا تجميل ولا شعارات..."
              className="textarea"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
