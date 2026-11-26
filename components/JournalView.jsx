'use client';

import { useMemo, useState } from 'react';
import { JOURNAL_TAGS } from '../lib/constants';
import { getTodayKey } from '../lib/engine';

export default function JournalView({ state, onAddJournal, onDeleteJournal }) {
  const [date, setDate] = useState(getTodayKey);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState(4);
  const [energy, setEnergy] = useState(4);
  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const toggleTag = (tag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAddJournal({
      id: `j_${Date.now()}`,
      date,
      title: title.trim() || `تدوينة ${date}`,
      content: content.trim(),
      mood,
      energy,
      tags,
    });
    setTitle('');
    setContent('');
    setTags([]);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(state.journal || [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((entry) => {
        if (filterTag && !entry.tags.includes(filterTag)) return false;
        if (!q) return true;
        return entry.title.toLowerCase().includes(q) || entry.content.toLowerCase().includes(q);
      });
  }, [state.journal, search, filterTag]);

  return (
    <div className="stack-lg">
      <form className="card stack-md" onSubmit={handleSubmit}>
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2>اليوميات — مساحة تفريغ وتأمل</h2>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input mono"
          />
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان سريع لليوم (اختياري)..."
          className="input"
        />

        <textarea
          rows={5}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="اكتب ما دار في يومك بصدق، أفكارك، الدروس، أو ما يشغل بالك..."
          className="textarea"
        />

        <div className="two-col">
          <div className="field-inline" style={{ marginBottom: 0 }}>
            <span className="xs muted">المزاج (1–5):</span>
            <div className="seg-group">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`seg-btn mono ${mood === n ? 'seg-yes' : ''}`}
                  onClick={() => setMood(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="field-inline" style={{ marginBottom: 0 }}>
            <span className="xs muted">الطاقة (1–5):</span>
            <div className="seg-group">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`seg-btn mono ${energy === n ? 'seg-yes' : ''}`}
                  onClick={() => setEnergy(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="chip-row">
          {JOURNAL_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${tags.includes(t) ? 'active' : ''}`}
              onClick={() => toggleTag(t)}
            >
              #{t}
            </button>
          ))}
        </div>

        <div>
          <button type="submit" className="btn btn-primary">حفظ في اليوميات</button>
        </div>
      </form>

      {/* الأرشيف والبحث */}
      <div className="card stack-md">
        <div className="close-toolbar">
          <h2>سجل اليوميات ({filtered.length})</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في يومياتك..."
            className="input"
            style={{ minWidth: '200px' }}
          />
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${filterTag === '' ? 'active' : ''}`}
            onClick={() => setFilterTag('')}
          >
            الكل
          </button>
          {JOURNAL_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${filterTag === t ? 'active' : ''}`}
              onClick={() => setFilterTag(t)}
            >
              #{t}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-box">لا توجد تدوينات مطابقة بعد.</div>
        ) : (
          <div className="stack-sm">
            {filtered.map((item) => (
              <article key={item.id} className="journal-card stack-sm">
                <div className="card-head" style={{ marginBottom: 0 }}>
                  <strong>{item.title}</strong>
                  <div className="chip-row">
                    <span className="xs mono muted">{item.date}</span>
                    <span className="badge up mono">مزاج {item.mood}/5</span>
                    <button
                      type="button"
                      className="btn-link red"
                      onClick={() => onDeleteJournal(item.id)}
                    >
                      حذف
                    </button>
                  </div>
                </div>
                <p className="plan-text">{item.content}</p>
                {item.tags.length > 0 && (
                  <div className="chip-row">
                    {item.tags.map((t) => (
                      <span key={t} className="xs green">#{t}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
