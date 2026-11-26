import { isCloudEnabled, supabase } from './supabase';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushStatus() {
  if (!isPushSupported()) return { supported: false, subscribed: false };
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return { supported: true, subscribed: false };
    const sub = await reg.pushManager.getSubscription();
    return { supported: true, subscribed: Boolean(sub) };
  } catch {
    return { supported: true, subscribed: false };
  }
}

export async function subscribeToPush() {
  if (!isPushSupported()) {
    return { ok: false, error: 'هذا المتصفح لا يدعم إشعارات الويب. افتح الموقع من Chrome وثبّته على الشاشة الرئيسية.' };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { ok: false, error: 'مفتاح NEXT_PUBLIC_VAPID_PUBLIC_KEY غير مضاف بعد في إعدادات Vercel.' };
  }

  if (!isCloudEnabled || !supabase) {
    return { ok: false, error: 'اربط السحابة (Supabase) أولاً.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) {
    return { ok: false, error: 'سجّل الدخول بحسابك في السحابة أولاً لتفعيل الإشعارات.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'تم رفض إذن الإشعارات من المتصفح.' };
  }

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    return { ok: false, error: `تعذر حفظ الاشتراك: ${error.message}` };
  }

  return { ok: true };
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return { ok: true };
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      if (supabase) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function sendTestPush() {
  if (!isCloudEnabled || !supabase) {
    return { ok: false, error: 'السحابة غير مفعّلة.' };
  }
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) {
    return { ok: false, error: 'سجّل الدخول أولاً.' };
  }

  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: body.error || 'فشل إرسال الإشعار التجريبي.' };
  }
  return { ok: true };
}
