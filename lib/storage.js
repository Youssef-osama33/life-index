import { SECTORS, SECTOR_DEFAULT_TASKS } from './constants';
import { isCloudEnabled, supabase } from './supabase';

const STORAGE_KEY = 'life_index_arbaeen_v4';
const OLD_KEY = 'life_index_arbaeen_v3';
const PIN_KEY = 'life_index_pin_v3';

export function getDefaultWeights() {
  return SECTORS.reduce((acc, s) => {
    acc[s.id] = s.defaultWeight;
    return acc;
  }, {});
}

export function getDefaultSectorTasks() {
  const out = {};
  for (const s of SECTORS) {
    out[s.id] = (SECTOR_DEFAULT_TASKS[s.id] || []).map((text, idx) => ({
      id: `${s.id}_${idx}`,
      text,
      done: false,
    }));
  }
  return out;
}

export function createEmptyState() {
  return {
    version: 4,
    year: new Date().getFullYear(),
    weights: getDefaultWeights(),
    dailyLogs: {},
    sectorTasks: getDefaultSectorTasks(),
    journal: [],
    arbaeen: {},
  };
}

export function validateState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'الملف لا يحتوي على كائن JSON صالح.' };
  }

  const base = createEmptyState();
  const cleanWeights = { ...base.weights };

  // لو الملف من نسخة قديمة (v3) نحتفظ بأيام الأربعين فقط مع الأوزان الجديدة
  let weightSum = 0;
  let allFound = true;
  for (const s of SECTORS) {
    const v = raw.weights?.[s.id];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) {
      allFound = false;
      break;
    }
    cleanWeights[s.id] = v;
    weightSum += v;
  }
  const finalWeights = allFound && weightSum === 100 ? cleanWeights : base.weights;

  const cleanDailyLogs = {};
  if (raw.dailyLogs && typeof raw.dailyLogs === 'object' && !Array.isArray(raw.dailyLogs)) {
    for (const [dateKey, entry] of Object.entries(raw.dailyLogs)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && entry && typeof entry === 'object') {
        cleanDailyLogs[dateKey] = {
          answers: entry.answers && typeof entry.answers === 'object' ? entry.answers : {},
          note: typeof entry.note === 'string' ? entry.note.slice(0, 1000) : '',
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
        };
      }
    }
  }

  const cleanTasks = getDefaultSectorTasks();
  if (raw.sectorTasks && typeof raw.sectorTasks === 'object') {
    for (const s of SECTORS) {
      if (Array.isArray(raw.sectorTasks[s.id])) {
        cleanTasks[s.id] = raw.sectorTasks[s.id]
          .filter((t) => t && typeof t.text === 'string')
          .map((t, i) => ({
            id: String(t.id || `${s.id}_${i}`),
            text: t.text.slice(0, 200),
            done: Boolean(t.done),
          }));
      }
    }
  }

  const cleanJournal = Array.isArray(raw.journal)
    ? raw.journal
        .filter((j) => j && typeof j.content === 'string')
        .map((j, i) => ({
          id: String(j.id || `j_${Date.now()}_${i}`),
          date: typeof j.date === 'string' ? j.date : new Date().toISOString().slice(0, 10),
          title: typeof j.title === 'string' ? j.title.slice(0, 120) : '',
          content: j.content.slice(0, 6000),
          mood: Math.min(5, Math.max(1, Number(j.mood) || 3)),
          energy: Math.min(5, Math.max(1, Number(j.energy) || 3)),
          tags: Array.isArray(j.tags) ? j.tags.slice(0, 6).map(String) : [],
        }))
    : [];

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
      version: 4,
      year: Number.isInteger(raw.year) ? raw.year : new Date().getFullYear(),
      weights: finalWeights,
      dailyLogs: cleanDailyLogs,
      sectorTasks: cleanTasks,
      journal: cleanJournal,
      arbaeen: cleanArbaeen,
    },
  };
}

export function loadLocalState() {
  if (typeof window === 'undefined') return createEmptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(OLD_KEY);
    if (!raw) return createEmptyState();
    const check = validateState(JSON.parse(raw));
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
    { user_id: userId, payload: state, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  return { ok: !error, error };
}

export function getSavedPin() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(PIN_KEY) || '';
}

export function setSavedPin(pin) {
  if (typeof window === 'undefined') return;
  if (!pin) window.localStorage.removeItem(PIN_KEY);
  else window.localStorage.setItem(PIN_KEY, pin);
}
