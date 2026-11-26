import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'تأكد من إضافة متغيرات السيرفر (VAPID و SERVICE_ROLE) في Vercel.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'جلسة غير صالحة.' }, { status: 401 });
  }

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userData.user.id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'لا يوجد جهاز مشترك بعد. اضغط تفعيل الإشعارات أولاً.' }, { status: 400 });
  }

  webpush.setVapidDetails('mailto:admin@life-idx.app', vapidPublic, vapidPrivate);
  const payload = JSON.stringify({
    title: 'LIFE-IDX — اختبار ناجح ✓',
    body: 'الإشعارات شغالة تمام على جهازك؛ هتوصلك الأذكار وتنبيه الساعة 11:30 مساءً في موعدها.',
    url: '/',
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  if (sent === 0) {
    return NextResponse.json({ error: 'الاشتراك منتهي الصلاحية، أعد تفعيل الإشعارات.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, sent });
}
