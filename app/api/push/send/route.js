import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGES = {
  morning: [
    {
      title: 'أذكار الصباح ☀️',
      body: 'أصبحنا وأصبح الملك لله، والحمد لله.. ابدأ يومك بآية الكرسي وأذكارك ووردك قبل ما تفتح أي شاشة.',
      url: '/',
    },
    {
      title: 'بداية يوم جديد ☀️',
      body: 'اللهم إني أسألك علماً نافعاً، ورزقاً طيباً، وعملاً متقبلاً.. حدّد مهمتك الكبرى الواحدة النهارده.',
      url: '/',
    },
  ],
  noon: [
    {
      title: 'نصيحة منتصف اليوم ⚡',
      body: 'سيب التليفون في أوضة تانية لمدة 60 دقيقة؛ ساعة عمل عميق صافية تساوي نص يوم متقطع.',
      url: '/',
    },
    {
      title: 'فحص سريع للبوصلة 🎯',
      body: 'إنت بتنجز حاجة بتخرج للنور دلوقتي، ولا بتلف في دايرة التخطيط والسوشيال؟ ارجع للمهمة الأساسية.',
      url: '/',
    },
    {
      title: 'صحتك وتركيزك 💧',
      body: 'اشرب كوباية ميه دلوقتي، وافرد ضهرك، وراجع باقيلك إيه من أهدافك النهارده قبل المغرب.',
      url: '/',
    },
  ],
  evening: [
    {
      title: 'أذكار المساء 🌙',
      body: 'أمسينا وأمسى الملك لله.. خُد 5 دقايق لأذكار المساء واهدأ من دوشة اليوم.',
      url: '/',
    },
    {
      title: 'وقفة المساء 🌙',
      body: 'اللهم بك أمسينا وبك أصبحنا.. راجع صلواتك ومهامك المتبقية قبل ما اليوم يقفل.',
      url: '/',
    },
  ],
  checkin: [
    {
      title: 'الساعة 11:30 — خش قيّم يومك 📊',
      body: 'دقيقة واحدة بس: سجّل صلواتك، ساعات شغلك، واستخدامك للتليفون النهارده قبل ما تنام.',
      url: '/',
    },
  ],
};

function pickMessage(type) {
  const list = MESSAGES[type] || MESSAGES.checkin;
  return list[Math.floor(Math.random() * list.length)];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const providedSecret =
    searchParams.get('secret') || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '');

  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'Missing server environment variables' }, { status: 500 });
  }

  webpush.setVapidDetails('mailto:admin@life-idx.app', vapidPublic, vapidPrivate);
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: subs, error } = await supabaseAdmin.from('push_subscriptions').select('*');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const type = searchParams.get('type') || 'checkin';
  const payload = JSON.stringify(pickMessage(type));

  let sent = 0;
  let removed = 0;

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        removed++;
      }
    }
  }

  return NextResponse.json({ ok: true, type, sent, removed });
}
