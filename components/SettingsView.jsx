'use client';

import { useState } from 'react';
import { SECTORS } from '../lib/constants';
import { calcWeightedScore, getSortedWeeks } from '../lib/engine';
import { validateState } from '../lib/storage';

export default function SettingsView({
  state,
  onUpdateWeights,
  onDeleteWeek,
  onImportState,
  onResetClean,
}) {
  const [draftWeights, setDraftWeights] = useState({ ...state.weights });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const totalWeight = Object.values(draftWeights).reduce((acc, v) => acc + Number(v || 0), 0);

  const handleSaveWeights = (e) => {
    e.preventDefault();
    if (totalWeight !== 100) {
      setStatusMsg({ type: 'error', text: `مجموع الأوزان حالياً ${totalWeight}% — يجب أن يساوي 100%.` });
      return;
    }
    onUpdateWeights(draftWeights);
    setStatusMsg({ type: 'ok', text: 'تم تحديث الأوزان وإعادة حساب تاريخ المؤشر.' });
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
      setDraftWeights({ ...check.data.weights });
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
      <div className="two-col">
        {/* تعديل الأوزان */}
        <form className="card stack-md" onSubmit={handleSaveWeights}>
          <div className="card-head">
            <h2>أوزان القطاعات النسبية</h2>
            <span className={`mono badge ${totalWeight === 100 ? 'up' : 'down'}`}>
              المجموع: {totalWeight}%
            </span>
          </div>

          <div className="stack-sm">
            {SECTORS.map((s) => (
              <div key={s.id} className="field-inline">
                <label htmlFor={`w-${s.id}`}>{s.name}</label>
                <input
                  id={`w-${s.id}`}
                  type="number"
                  min="0"
                  max="100"
                  value={draftWeights[s.id]}
                  onChange={(e) =>
                    setDraftWeights((prev) => ({
                      ...prev,
                      [s.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    }))
                  }
                  className="input mono"
                  style={{ width: '90px' }}
                />
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-primary" disabled={totalWeight !== 100}>
            حفظ الأوزان
          </button>
        </form>

        {/* النسخ الاحتياطي والبدء النظيف */}
        <div className="card stack-md">
          <h2>إدارة البيانات والنسخ الاحتياطي</h2>
          <p className="xs muted">
            البيانات محفوظة محلياً في المتصفح. خذ نسخة JSON احتياطية كل شهر حتى تنتقل لقاعدة بيانات سحابية.
          </p>

          <div className="actions-row">
            <button type="button" className="btn btn-primary" onClick={handleExportJson}>
              تصدير نسخة JSON
            </button>
            <label className="btn btn-ghost file-btn">
              استيراد JSON
              <input type="file" accept="application/json" onChange={handleImportFile} hidden />
            </label>
          </div>

          <hr className="divider" />

          <div>
            <p className="xs muted" style={{ marginBottom: '10px' }}>
              لمسح البيانات التجريبية والبدء بسنتك الحقيقية من الصفر:
            </p>
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

          {statusMsg.text && (
            <div className={`alert ${statusMsg.type === 'error' ? 'alert-err' : 'alert-ok'}`}>
              {statusMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* سجل الأسابيع الكامل */}
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
                  {SECTORS.map((s) => (
                    <th key={s.id}>{s.name}</th>
                  ))}
                  <th>ملاحظات</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {sortedWeeks.map((w) => (
                  <tr key={w.week}>
                    <td className="mono">W{w.week}</td>
                    <td className="mono xs muted">{w.date}</td>
                    <td className="mono green">
                      <strong>{calcWeightedScore(w.scores, state.weights)}</strong>
                    </td>
                    {SECTORS.map((s) => (
                      <td key={s.id} className="mono">
                        {w.scores[s.id]}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
