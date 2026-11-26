import { SECTORS } from './constants';

const STORAGE_KEY = 'life_index_arbaeen_v2';

export function getDefaultWeights() {
  return SECTORS.reduce((acc, s) => {
    acc[s.id] = s.defaultWeight;
    return acc;
  }, {});
}

export function createEmptyState() {
  return {
    version: 2,
    year: new Date().getFullYear(),
    weights: getDefaultWeights(),
    weeks: [],
    arbaeen: {},
  };
}

export function createDemoState() {
  return {
    version: 2,
    year: new Date().getFullYear(),
    weights: getDefaultWeights(),
    weeks: [
      {
        week: 1,
        date: '2026-01-09',
        scores: { deen: 75, learning: 80, execution: 65, health: 60, mind: 70 },
        note: 'بداية جيدة لكن النوم متأخر بسبب ضغط المذاكرة.',
      },
      {
        week: 2,
        date: '2026-01-16',
        scores: { deen: 80, learning: 85, execution: 70, health: 55, mind: 65 },
        note: 'تحسن في التحصيل مع تراجع واضح في ساعات النوم.',
      },
      {
        week: 3,
        date: '2026-01-23',
        scores: { deen: 85, learning: 75, execution: 82, health: 72, mind: 80 },
        note: 'تقليل السوشيال ميديا رفع التنفيذ والهدوء النفسي فوراً.',
      },
      {
        week: 4,
        date: '2026-01-30',
        scores: { deen: 88, learning: 84, execution: 85, health: 78, mind: 82 },
        note: 'أفضل أسبوع متوازن منذ بداية السنة.',
      },
    ],
    arbaeen: {
      '1': {
        done: true,
        answer: 'أكبر مبرر أستخدمه هو "انتظار الظروف المثالية" بينما المشكلة الحقيقية هي التشتت.',
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

  // التحقق من الأوزان
  if (!raw.weights || typeof raw.weights !== 'object') {
    return { ok: false, error: 'حقل الأوزان (weights) مفقود أو غير صالح.' };
  }

  let weightSum = 0;
  const cleanWeights = {};
  for (const s of SECTORS) {
    const val = Number(raw.weights[s.id]);
    if (!Number.isFinite(val) || val < 0 || val > 100) {
      return { ok: false, error: `وزن القطاع "${s.name}" غير صالح.` };
    }
    cleanWeights[s.id] = val;
    weightSum += val;
  }
  if (weightSum <= 0) {
    return { ok: false, error: 'مجموع الأوزان يجب أن يكون أكبر من صفر.' };
  }

  // التحقق من الأسابيع
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
    for (const s of SECTORS) {
      const sc = Number(entry?.scores?.[s.id]);
      if (!Number.isFinite(sc) || sc < 0 || sc > 100) {
        return { ok: false, error: `درجة غير صالحة للقطاع "${s.name}" في الأسبوع ${wk}.` };
      }
      cleanScores[s.id] = sc;
    }

    cleanWeeks.push({
      week: wk,
      date: typeof entry.date === 'string' ? entry.date : new Date().toISOString().slice(0, 10),
      scores: cleanScores,
      note: typeof entry.note === 'string' ? entry.note.slice(0, 1000) : '',
    });
  }

  // التحقق من بيانات الأربعين
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
      version: 2,
      year: Number.isInteger(raw.year) ? raw.year : new Date().getFullYear(),
      weights: cleanWeights,
      weeks: cleanWeeks,
      arbaeen: cleanArbaeen,
    },
  };
}

// نقطة الاستبدال الوحيدة لاحقاً عند الربط بـ Supabase
export function loadState() {
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

export function saveState(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}
