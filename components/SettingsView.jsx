'use client';

import { useEffect, useState } from 'react';
import { PILLARS, SUBSECTORS } from '../lib/constants';
import { calcPillarScores, calcWeightedScore, getSortedWeeks } from '../lib/engine';
import { getSavedPin, setSavedPin, validateState } from '../lib/storage';

export default function SettingsView({
  state,
  onUpdateWeights,
  onDeleteWeek,
  onImportState,
  onResetClean,
}) {
  const [draftWeights, setDraftWeights] = useState({ ...state.weights });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [pinDraft, setPinDraft] = useState('');
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    setDraftWeights({ ...state.weights });
  }, [state.weights]);

  useEffect(() => {
    setHasPin(Boolean(getSavedPin()));
  }, []);

  const totalWeight = Object.values(draftWeights).reduce((acc, v) => acc + Number(v || 0), 0);

  const handleSaveWeights = (e) => {
    e.preventDefault();
    if (totalWeight !== 100) {
      setStatusMsg({ type: 'error', text: `مجموع الأوزان حالياً ${totalWeight}% — يجب أن يساوي 100%.` });
      return;
    }
    onUpdateWeights(draftWeights);
    setStatusMsg({ type: 'ok', text: 'تم تحديث أوزان الـ 15 قطاعاً وإعادة حساب التاريخ.' });
  };

  const handleSavePin = (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinDraft)) {
      setStatusMsg({ type: 'error', text: 'الرمز السري (PIN) يجب أن يتكون من 4 أرقام بالضبط.' });
      return;
    }
    setSavedPin(pinDraft);
    setHasPin(true);
    setPinDraft('');
    setStatusMsg({ type: 'ok', text: 'تم تفعيل قفل الخصوصية المحلي بنجاح.' });
  };

  const handleDisablePin = () => {
    setSavedPin('');
    setHasPin(false);
    setStatusMsg({ type: 'ok', text: 'تم إلغاء قفل الخصوصية المحلي.' });
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-index-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const check = validateState(parsed);
      if (!check.ok) {
        setStatusMsg({ type: 'error', text: `فشل الاستيراد: ${check.error}` });
        return;
      }
      onImportState(check.data);
      setStatusMsg({ type: 'ok', text: 'تم التحقق من الملف واستيراد البيانات بنجاح.' });
    } catch {
      setStatusMsg({ type: 'error', text: 'ملف JSON غير صالح أو تالف.' });
    } finally {
      e.target.value = '';
    }
  };

  const sortedWeeks = getSortedWeeks(state.weeks).reverse();

  return (
    <div className="stack-lg">
      {statusMsg.text && (
        <div className={`alert ${statusMsg.type === 'error' ? 'alert-err' : 'alert-ok'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* تعديل أوزان الـ 15 قطاعاً */}
      <form className="card stack-md" onSubmit={handleSaveWeights}>
        <div className="card-head">
          <h2>أوزان الـ 15 قطاعاً (مجمّعة حسب المحور)</h2>
          <span className={`mono badge ${totalWeight === 100 ? 'up' : 'down'}`}>
            المجموع: {totalWeight}%
          </span>
        </div>

        <div className="pillars-form-grid">
          {PILLARS.map((pillar) => {
            const subs = SUBSECTORS.filter((s) => s.pillarId === pillar.id);
            const subTotal = subs.reduce((acc, s) => acc + Number(draftWeights[s.id] || 0), 0);
            return (
              <div key={pillar.id} className="pillar-box stack-sm">
                <div className="pillar-head" style={{ borderRightColor: pillar.color }}>
                  <strong>{pillar.name}</strong>
                  <span className="xs mono muted">{subTotal}%</span>
                </div>
                {subs.map((s) => (
                  <div key={s.id} className="field-inline" style={{ marginBottom: 0 }}>
                    <label htmlFor={`w-${s.id}`} className="xs">
                      {s.name}
                    </label>
                    <input
                      id={`w-${s.id}`}
                      type="number"
                      min="0"
                      max="100"
                      value={draftWeights[s.id] ?? 0}
                      onChange={(e) =>
                        setDraftWeights((prev) => ({
                          ...prev,
                          [s.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        }))
                      }
                      className="input mono"
                      style={{ width: '74px' }}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={totalWeight !== 100}>
            حفظ الأوزان الجديدة
          </button>
        </div>
      </form>

      <div className="two-col">
        {/* قفل الخصوصية المحلي */}
        <div className="card stack-md">
          <h2>قفل الخصوصية المحلي (PIN)</h2>
          <p className="xs muted">
            يحمي كتاباتك الصريحة في تحدي الأربعين عند فتح التطبيق على جهازك حتى في الوضع غير المتصل.
          </p>
          {hasPin ? (
            <div className="actions-row">
              <span className="xs green">القفل مفعّل حالياً ✓</span>
              <button type="button" className="btn btn-danger" onClick={handleDisablePin}>
                إلغاء القفل
              </button>
            </div>
          ) : (
            <form className="actions-row" onSubmit={handleSavePin}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="4 أرقام"
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
                className="input mono"
                style={{ width: '120px' }}
              />
              <button type="submit" className="btn btn-primary">
                تفعيل القفل
              </button>
            </form>
          )}
        </div>

        {/* النسخ الاحتياطي والبدء النظيف */}
        <div className="card stack-md">
          <h2>النسخ الاحتياطي والتصفير</h2>
          <div className="actions-row" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-primary" onClick={handleExportJson}>
              تصدير JSON
            </button>
            <label className="btn btn-ghost">
              استيراد JSON
              <input type="file" accept="application/json" onChange={handleImportFile} hidden />
            </label>
          </div>
          <hr className="divider" />
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm('هل أنت متأكد من مسح كل البيانات والبدء من الصفر؟')) {
                onResetClean();
                setStatusMsg({ type: 'ok', text: 'تم تصفير النظام بنجاح. سنة جديدة نظيفة.' });
              }
            }}
          >
            بدء نظيف (مسح كل البيانات)
          </button>
        </div>
      </div>

      {/* السجل الأسبوعي */}
      <div className="card">
        <div className="card-head">
          <h2>السجل الأسبوعي ({sortedWeeks.length})</h2>
        </div>

        {sortedWeeks.length === 0 ? (
          <div className="empty-box">لا توجد سجلات أسبوعية حتى الآن.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الأسبوع</th>
                  <th>التاريخ</th>
                  <th>المؤشر</th>
                  {PILLARS.map((p) => (
                    <th key={p.id}>{p.name}</th>
                  ))}
                  <th>ملاحظات</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {sortedWeeks.map((w) => {
                  const pScores = calcPillarScores(w.scores, state.weights);
                  return (
                    <tr key={w.week}>
                      <td className="mono">W{w.week}</td>
                      <td className="mono xs muted">{w.date}</td>
                      <td className="mono green">
                        <strong>{calcWeightedScore(w.scores, state.weights)}</strong>
                      </td>
                      {PILLARS.map((p) => (
                        <td key={p.id} className="mono">
                          {pScores[p.id]}
                        </td>
                      ))}
                      <td className="xs note-cell">{w.note || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-link red"
                          onClick={() => onDeleteWeek(w.week)}
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
