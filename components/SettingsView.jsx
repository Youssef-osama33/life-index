'use client';

import { useEffect, useState } from 'react';
import { SECTORS } from '../lib/constants';
import { computeDailyResult } from '../lib/engine';
import { getSavedPin, setSavedPin, validateState } from '../lib/storage';
import {
  getPushStatus,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/pushClient';

export default function SettingsView({
  state,
  onUpdateWeights,
  onDeleteDay,
  onImportState,
  onResetClean,
  onOpenAuth,
}) {
  const [draftWeights, setDraftWeights] = useState({ ...state.weights });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [pinDraft, setPinDraft] = useState('');
  const [hasPin, setHasPin] = useState(false);

  const [pushState, setPushState] = useState({ supported: true, subscribed: false, busy: false });

  useEffect(() => {
    setDraftWeights({ ...state.weights });
  }, [state.weights]);

  useEffect(() => {
    setHasPin(Boolean(getSavedPin()));
    getPushStatus().then((res) => setPushState((prev) => ({ ...prev, ...res })));
  }, []);

  const totalWeight = Object.values(draftWeights).reduce((acc, v) => acc + Number(v || 0), 0);

  const handleEnablePush = async () => {
    setPushState((p) => ({ ...p, busy: true }));
    const res = await subscribeToPush();
    if (res.ok) {
      setPushState({ supported: true, subscribed: true, busy: false });
      setStatusMsg({ type: 'ok', text: 'تم تفعيل الإشعارات على هذا الجهاز بنجاح ✓' });
    } else {
      setPushState((p) => ({ ...p, busy: false }));
      setStatusMsg({ type: 'error', text: res.error });
    }
  };

  const handleDisablePush = async () => {
    setPushState((p) => ({ ...p, busy: true }));
    await unsubscribeFromPush();
    setPushState({ supported: true, subscribed: false, busy: false });
    setStatusMsg({ type: 'ok', text: 'تم إيقاف الإشعارات على هذا الجهاز.' });
  };

  const handleTestPush = async () => {
    setPushState((p) => ({ ...p, busy: true }));
    const res = await sendTestPush();
    setPushState((p) => ({ ...p, busy: false }));
    setStatusMsg(
      res.ok
        ? { type: 'ok', text: 'تم إرسال إشعار تجريبي — المفروض يوصلك خلال ثوانٍ.' }
        : { type: 'error', text: res.error }
    );
  };

  const handleSaveWeights = (e) => {
    e.preventDefault();
    if (totalWeight !== 100) {
      setStatusMsg({ type: 'error', text: `مجموع الأوزان حالياً ${totalWeight}% — يجب أن يساوي 100%.` });
      return;
    }
    onUpdateWeights(draftWeights);
    setStatusMsg({ type: 'ok', text: 'تم تحديث أوزان القطاعات الـ 10 وإعادة حساب التاريخ.' });
  };

  const handleSavePin = (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinDraft)) {
      setStatusMsg({ type: 'error', text: 'الرمز السري (PIN) يجب أن يتكون من 4 أرقام.' });
      return;
    }
    setSavedPin(pinDraft);
    setHasPin(true);
    setPinDraft('');
    setStatusMsg({ type: 'ok', text: 'تم تفعيل قفل الخصوصية المحلي.' });
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-idx-v4-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const check = validateState(JSON.parse(await file.text()));
      if (!check.ok) {
        setStatusMsg({ type: 'error', text: `فشل الاستيراد: ${check.error}` });
        return;
      }
      onImportState(check.data);
      setStatusMsg({ type: 'ok', text: 'تم استيراد البيانات بنجاح.' });
    } catch {
      setStatusMsg({ type: 'error', text: 'ملف JSON غير صالح.' });
    } finally {
      e.target.value = '';
    }
  };

  const dailyList = Object.entries(state.dailyLogs || {}).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="stack-lg">
      {statusMsg.text && (
        <div className={`alert ${statusMsg.type === 'error' ? 'alert-err' : 'alert-ok'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* بطاقة الإشعارات المجدولة والأذكار */}
      <div className="card stack-md">
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2>الإشعارات اليومية والأذكار (Web Push)</h2>
          <span className={`badge ${pushState.subscribed ? 'up' : 'down'}`}>
            {pushState.subscribed ? 'مفعّلة ✓' : 'غير مفعّلة'}
          </span>
        </div>
        <p className="xs muted">
          استقبل أذكار الصباح والمساء، نصائح عملية، وتنبيه الساعة 11:30 مساءً لتقييم يومك حتى والتطبيق مغلق. (ثبّت الموقع من Chrome كـ Add to Home screen لأفضل نتيجة).
        </p>
        <div className="actions-row" style={{ marginTop: 0 }}>
          {!pushState.subscribed ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pushState.busy || !pushState.supported}
              onClick={handleEnablePush}
            >
              {pushState.busy ? 'جارٍ التفعيل...' : 'تفعيل الإشعارات على هذا الجهاز'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pushState.busy}
                onClick={handleTestPush}
              >
                إرسال إشعار تجريبي الآن
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={pushState.busy}
                onClick={handleDisablePush}
              >
                إيقاف الإشعارات
              </button>
            </>
          )}
        </div>
      </div>

      {/* أوزان الـ 10 قطاعات */}
      <form className="card stack-md" onSubmit={handleSaveWeights}>
        <div className="card-head">
          <h2>أوزان القطاعات الـ 10</h2>
          <span className={`mono badge ${totalWeight === 100 ? 'up' : 'down'}`}>
            المجموع: {totalWeight}%
          </span>
        </div>

        <div className="pillars-form-grid">
          {SECTORS.map((s) => (
            <div key={s.id} className="field-inline" style={{ marginBottom: 0 }}>
              <label htmlFor={`w-${s.id}`} className="xs">
                <span className="sec-dot" style={{ background: s.color, marginLeft: 6 }} />
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

        <div>
          <button type="submit" className="btn btn-primary" disabled={totalWeight !== 100}>
            حفظ الأوزان
          </button>
        </div>
      </form>

      <div className="two-col">
        <div className="card stack-md">
          <h2>الخصوصية والمزامنة</h2>
          <button type="button" className="btn btn-ghost" onClick={onOpenAuth}>
            إدارة حساب السحابة (Supabase)
          </button>
          <hr className="divider" />
          {hasPin ? (
            <div className="actions-row" style={{ marginTop: 0 }}>
              <span className="xs green">قفل الـ PIN مفعّل ✓</span>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setSavedPin('');
                  setHasPin(false);
                }}
              >
                إلغاء القفل
              </button>
            </div>
          ) : (
            <form className="actions-row" style={{ marginTop: 0 }} onSubmit={handleSavePin}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="PIN من 4 أرقام"
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
                className="input mono"
                style={{ width: '130px' }}
              />
              <button type="submit" className="btn btn-primary">تفعيل القفل</button>
            </form>
          )}
        </div>

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
                setStatusMsg({ type: 'ok', text: 'تم تصفير النظام بنجاح.' });
              }
            }}
          >
            بدء نظيف (مسح كل البيانات)
          </button>
        </div>
      </div>

      {/* سجل الأيام المحفوظة */}
      <div className="card">
        <div className="card-head">
          <h2>سجل التقييمات اليومية ({dailyList.length})</h2>
        </div>
        {dailyList.length === 0 ? (
          <div className="empty-box">لا توجد أيام مسجّلة حتى الآن.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الدرجة</th>
                  <th>ملاحظة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {dailyList.map(([date, log]) => {
                  const res = computeDailyResult(log.answers, state.weights);
                  return (
                    <tr key={date}>
                      <td className="mono">{date}</td>
                      <td className="mono green"><strong>{res.total}</strong></td>
                      <td className="xs note-cell">{log.note || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-link red"
                          onClick={() => onDeleteDay(date)}
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
