import { SUBSECTORS } from './constants';
import { isCloudEnabled, supabase } from './supabase';

const STORAGE_KEY = 'life_index_arbaeen_v3';
const PIN_KEY = 'life_index_pin_v3';

export function getDefaultWeights() {
  return SUBSECTORS.reduce((acc, s) => {
    acc[s.id] = s.defaultWeight;
    return acc;
  }, {});
}

export function createEmptyState() {
  return {
    version: 3,
    year: new Date().getFullYear(),
    weights: getDefaultWeights(),
    weeks: [],
    arbaeen: {},
  };
}

// 5 أسابيع تجريبية لإظهار محرك الدومينو والـ Drawdown فور التشغيل
export function createDemoState() {
  return {
    version: 3,
    year: new Date().getFullYear(),
    weights: getDefaultWeights(),
    weeks: [
      {
        week: 1,
        date: '2026-01-09',
        scores: {
          prayers: 86, adhkar: 71, tazkiyah: 75,
          sleep: 86, sport: 75, nutrition: 71,
          shipping: 100, tech: 86, uni: 80,
          income: 80, finance: 80, writing: 100,
          deepwork: 87, family: 80, network: 67,
        },
        note: 'انطلاقة قوية مع التزام ممتاز بالنوم والعمل العميق.',
      },
      {
        week: 2,
        date: '2026-01-16',
        scores: {
          prayers: 89, adhkar: 86, tazkiyah: 80,
          sleep: 86, sport: 100, nutrition: 86,
          shipping: 100, tech: 93, uni: 90,
          income: 80, finance: 85, writing: 100,
          deepwork: 93, family: 85, network: 100,
        },
        note: 'أعلى قمة أداء متوازن خلال الشهر.',
      },
      {
        week: 3,
        date: '2026-01-23',
        scores: {
          prayers: 77, adhkar: 57, tazkiyah: 65,
          sleep: 57, sport: 50, nutrition: 57,
          shipping: 67, tech: 71, uni: 90,
          income: 60, finance: 75, writing: 50,
          deepwork: 60, family: 70, network: 33,
        },
        note: 'السهر المتكرر سحب التركيز وإطلاق المشاريع لتحت.',
      },
      {
        week: 4,
        date: '2026-01-30',
        scores: {
          prayers: 71, adhkar: 43, tazkiyah: 60,
          sleep: 43, sport: 25, nutrition: 43,
          shipping: 33, tech: 57, uni: 80,
          income: 40, finance: 70, writing: 0,
          deepwork: 47, family: 65, network: 33,
        },
        note: 'أسبوع إرهاق واضح بسبب النوم العشوائي وتصفح السوشيال.',
      },
    ],
    arbaeen: {
      '1': {
        done: true,
        answer: 'أكبر مبرر أستخدمه هو التخطيط الزائد بينما المشكلة الحقيقية هي السهر والتشتت.',
        habits: { noScroll: true, solitude: true, honestWrite: true },
        updatedAt: '2026-01-25',
      },
      '37': {
        done: true,
        answer: '1) إغلاق الهاتف الساعة 11 مساءً لمدة 3 أيام.\n2) تجميد أي فكرة جديدة والتركيز على مهمة واحدة كبرى فقط.\n3) تثبيت الصلاة في وقتها والمشي 30 دقيقة يومياً قبل استئناف الضغط.',
        habits: { noScroll: true, solitude: true, honestWrite: true },
        updatedAt: '2026-01-25',
      },
    },
  };
}

export function validateState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'الملف لا يحتوي على كائن JSON صالح.' };
  }

  const cleanWeights = {};
  let weightSum = 0;
  for (const s of SUBSECTORS) {
    const val = Number(raw.weights?.[s.id] ?? s.defaultWeight);
    if (!Number.isFinite(val) || val < 0 || val > 100) {
      return { ok: false, error: `وزن القطاع "${s.name}" غير صالح.` };
    }
    cleanWeights[s.id] = val;
    weightSum += val;
  }
  if (weightSum <= 0) {
    return { ok: false, error: 'مجموع الأوزان يجب أن يكون أكبر من صفر.' };
  }

  if (!Array.isArray(raw.weeks)) {
    return { ok: false, error: 'حقل الأسابيع (weeks) يجب أن يكون مصفوفة.' };
  }

  const seenWeeks = new Set();
  const cleanWeeks = [];
  for (const entry of raw.weeks) {
    const wk = Number(entry?.week);
    if (!Number.isInteger(wk) || wk < 1 || wk > 52 || seenWeeks.has(wk)) {
      return { ok: false, error: `رقم أسبوع غير صالح أو مكرر: ${entry?.week}` };
    }
    seenWeeks.add(wk);

    const cleanScores = {};
    for (const s of SUBSECTORS) {
      const sc = Number(entry?.scores?.[s.id] ?? 0);
      if (!Number.isFinite(sc) || sc < 0 || sc > 100) {
        return { ok: false, error: `درجة غير صالحة للقطاع "${s.name}" في الأسبوع ${wk}.` };
      }
      cleanScores[s.id] = sc;
    }

    cleanWeeks.push({
      week: wk,
      date: typeof entry.date === 'string' ? entry.date : new Date().toISOString().slice(0, 10),
      scores: cleanScores,
      rawMetrics: entry.rawMetrics && typeof entry.rawMetrics === 'object' ? entry.rawMetrics : null,
      note: typeof entry.note === 'string' ? entry.note.slice(0, 1000) : '',
    });
  }

  const cleanArbaeen = {};
  if (raw.arbaeen && typeof raw.arbaeen === 'object' && !Array.isArray(raw.arbaeen)) {
    for (const [key, val] of Object.entries(raw.arbaeen)) {
      const dayNum = Number(key);
      if (Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 40 && val && typeof val === 'object') {
        cleanArbaeen[String(dayNum)] = {
          done: Boolean(val.done),
          answer: typeof val.answer === 'string' ? val.answer.slice(0, 5000) : '',
          habits: {
            noScroll: Boolean(val.habits?.noScroll),
            solitude: Boolean(val.habits?.solitude),
            honestWrite: Boolean(val.habits?.honestWrite),
          },
          updatedAt: typeof val.updatedAt === 'string' ? val.updatedAt : '',
        };
      }
    }
  }

  return {
    ok: true,
    data: {
      version: 3,
      year: Number.isInteger(raw.year) ? raw.year : new Date().getFullYear(),
      weights: cleanWeights,
      weeks: cleanWeeks,
      arbaeen: cleanArbaeen,
    },
  };
}

export function loadLocalState() {
  if (typeof window === 'undefined') return createEmptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoState();
    const parsed = JSON.parse(raw);
    const check = validateState(parsed);
    return check.ok ? check.data : createEmptyState();
  } catch {
    return createEmptyState();
  }
}

export function saveLocalState(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Local save failed:', err);
  }
}

// المزامنة السحابية مع Supabase
export async function loadCloudState(userId) {
  if (!isCloudEnabled || !supabase || !userId) return null;
  const { data, error } = await supabase
    .from('user_life_state')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.payload) return null;
  const check = validateState(data.payload);
  return check.ok ? check.data : null;
}

export async function saveCloudState(userId, state) {
  if (!isCloudEnabled || !supabase || !userId) return { ok: false };
  const { error } = await supabase.from('user_life_state').upsert(
    {
      user_id: userId,
      payload: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  return { ok: !error, error };
}

// قفل PIN محلي اختياري لحماية خصوصية تحدي الأربعين
export function getSavedPin() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(PIN_KEY) || '';
}

export function setSavedPin(pin) {
  if (typeof window === 'undefined') return;
  if (!pin) window.localStorage.removeItem(PIN_KEY);
  else window.localStorage.setItem(PIN_KEY, pin);
}
