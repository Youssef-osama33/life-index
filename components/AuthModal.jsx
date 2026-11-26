'use client';

import { useState } from 'react';
import { isCloudEnabled, supabase } from '../lib/supabase';

export default function AuthModal({ open, onClose, user, onSignOut }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isCloudEnabled || !supabase) return;
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg({
          type: 'ok',
          text: 'تم إنشاء الحساب. لو التفعيل عبر البريد مفعّل في Supabase راجع بريدك ثم سجّل الدخول.',
        });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'تعذر إتمام العملية.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal-box stack-md" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2>المزامنة السحابية (Supabase)</h2>
          <button type="button" className="btn-link muted" onClick={onClose}>
            إغلاق ✕
          </button>
        </div>

        {!isCloudEnabled ? (
          <div className="stack-sm">
            <p className="xs muted">
              المشروع يعمل حالياً في <strong>الوضع المحلي</strong> لأن متغيرات البيئة غير مضافة بعد في Vercel:
            </p>
            <code className="code-block mono">
              NEXT_PUBLIC_SUPABASE_URL{'\n'}NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
            <p className="xs muted">
              بمجرد إضافتهما وتشغيل ملف <code>supabase-schema.sql</code> ستتفعّل المزامنة التلقائية بين الموبايل والكمبيوتر فوراً.
            </p>
          </div>
        ) : user ? (
          <div className="stack-md">
            <p className="xs muted">
              مسجّل الدخول حالياً بـ: <strong className="mono">{user.email}</strong>
            </p>
            <p className="xs green">بياناتك تتزامن تلقائياً ومحمية بسياسة RLS الخاصة بحسابك فقط.</p>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                await onSignOut();
                onClose();
              }}
            >
              تسجيل الخروج
            </button>
          </div>
        ) : (
          <form className="stack-md" onSubmit={handleSubmit}>
            <div className="chip-row">
              <button
                type="button"
                className={`chip ${mode === 'login' ? 'active' : ''}`}
                onClick={() => setMode('login')}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                className={`chip ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => setMode('signup')}
              >
                حساب جديد
              </button>
            </div>

            <div className="field">
              <label htmlFor="auth-email">البريد الإلكتروني</label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mono"
                dir="ltr"
              />
            </div>

            <div className="field">
              <label htmlFor="auth-pass">كلمة المرور</label>
              <input
                id="auth-pass"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mono"
                dir="ltr"
              />
            </div>

            {msg.text && (
              <div className={`alert ${msg.type === 'error' ? 'alert-err' : 'alert-ok'}`}>
                {msg.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'جارٍ الاتصال...' : mode === 'login' ? 'دخول ومزامنة' : 'إنشاء حساب'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
