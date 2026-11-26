import { SECTORS, DAILY_QUESTIONS, ARBAEEN_PROMPTS, ARBAEEN_PHASES } from './constants';

export function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekNumber(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 1;
  const start = new Date(d.getFullYear(), 0, 1);
  const diffDays = Math.floor((d - start) / 86400000);
  return Math.min(52, Math.max(1, Math.floor(diffDays / 7) + 1));
}

export function getDefaultAnswers() {
  const ans = {};
  for (const q of DAILY_QUESTIONS) {
    if (q.type === 'bool') ans[q.id] = false;
    else if (q.type === 'tri') ans[q.id] = 'yes';
    else if (q.type === 'rating') ans[q.id] = 3;
    else if (q.type === 'sleep') ans[q.id] = 7;
    else if (q.type === 'inverse') ans[q.id] = q.goodMax;
    else ans[q.id] = 0;
  }
  return ans;
}

export function scoreQuestion(q, val, allAnswers = {}) {
  if (q.skipWhen && allAnswers[q.skipWhen.id] === q.skipWhen.value) return null;

  if (q.type === 'bool') return val ? 100 : 0;
  if (q.type === 'tri') {
    if (val === 'na') return null;
    return val === 'yes' ? 100 : 0;
  }
  if (q.type === 'rating') {
    const n = Math.min(5, Math.max(1, Number(val) || 1));
    return Math.round((n / 5) * 100);
  }
  if (q.type === 'count' || q.type === 'number') {
    const n = Math.max(0, Number(val) || 0);
    return Math.min(100, Math.round((n / q.target) * 100));
  }
  if (q.type === 'sleep') {
    const h = Math.max(0, Number(val) || 0);
    if (h >= 7 && h <= 8) return 100;
    if (h < 7) return Math.max(0, Math.round(100 - (7 - h) * 25));
    return Math.max(0, Math.round(100 - (h - 8) * 20));
  }
  if (q.type === 'inverse') {
    const h = Math.max(0, Number(val) || 0);
    if (h <= q.goodMax) return 100;
    if (h >= q.badMax) return 0;
    return Math.round(((q.badMax - h) / (q.badMax - q.goodMax)) * 100);
  }
  return null;
}

export function computeDailyResult(answers = {}, weights = {}) {
  const sectorScores = {};
  let totalWeight = 0;
  let weightedSum = 0;

  for (const sec of SECTORS) {
    const qs = DAILY_QUESTIONS.filter((q) => q.sectorId === sec.id);
    const vals = [];
    let bonusPts = 0;

    for (const q of qs) {
      if (q.type === 'bonus') {
        const n = Math.max(0, Number(answers[q.id]) || 0);
        bonusPts += Math.min(15, n * 5);
        continue;
      }
      const sc = scoreQuestion(q, answers[q.id], answers);
      if (sc !== null) vals.push(sc);
    }

    if (vals.length === 0) {
      sectorScores[sec.id] = null;
      continue;
    }

    const base = vals.reduce((a, b) => a + b, 0) / vals.length;
    const finalSec = Math.min(100, Math.round(base + bonusPts));
    sectorScores[sec.id] = finalSec;

    const w = Number(weights[sec.id] ?? sec.defaultWeight);
    totalWeight += w;
    weightedSum += finalSec * w;
  }

  const total = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(1)) : 0;
  return { total, sectorScores };
}

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 4) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return num / Math.sqrt(denX * denY);
}

export function computeDominoInsights(items) {
  if (items.length < 4) return [];
  const pairs = [];

  for (let i = 0; i < SECTORS.length; i++) {
    for (let j = i + 1; j < SECTORS.length; j++) {
      const a = SECTORS[i];
      const b = SECTORS[j];
      const xs = [];
      const ys = [];
      for (const it of items) {
        const va = it.sectorScores[a.id];
        const vb = it.sectorScores[b.id];
        if (typeof va === 'number' && typeof vb === 'number') {
          xs.push(va);
          ys.push(vb);
        }
      }
      const r = pearsonCorrelation(xs, ys);
      if (r !== null && r >= 0.65) {
        pairs.push({ a, b, r: Number(r.toFixed(2)), pct: Math.round(r * 100) });
      }
    }
  }
  return pairs.sort((p1, p2) => p2.r - p1.r).slice(0, 3);
}

export function computeDashboardStats(state) {
  const weights = state.weights || {};
  const entries = Object.entries(state.dailyLogs || {})
    .sort(([d1], [d2]) => d1.localeCompare(d2))
    .map(([date, log]) => {
      const res = computeDailyResult(log.answers, weights);
      return {
        date,
        week: getWeekNumber(date),
        note: log.note || '',
        total: res.total,
        sectorScores: res.sectorScores,
      };
    });

  // تجميع تلقائي للأيام داخل الأسابيع (1 إلى 52)
  const weekBuckets = {};
  for (const day of entries) {
    if (!weekBuckets[day.week]) weekBuckets[day.week] = [];
    weekBuckets[day.week].push(day);
  }

  const weeklySeries = Object.entries(weekBuckets)
    .map(([wk, days]) => {
      const total = Number((days.reduce((a, d) => a + d.total, 0) / days.length).toFixed(1));
      const sectorScores = {};
      for (const s of SECTORS) {
        const valid = days.map((d) => d.sectorScores[s.id]).filter((v) => typeof v === 'number');
        sectorScores[s.id] = valid.length ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)) : 0;
      }
      return {
        week: Number(wk),
        daysCount: days.length,
        lastDate: days[days.length - 1].date,
        total,
        sectorScores,
      };
    })
    .sort((a, b) => a.week - b.week);

  if (entries.length === 0) {
    return {
      daysCount: 0,
      weeksCount: 0,
      current: 0,
      delta: 0,
      avg: 0,
      ath: { value: 0, label: '—' },
      maxDrawdown: 0,
      currentDrawdown: 0,
      circuitBreaker: { active: false, reasons: [], planText: state.arbaeen?.['37']?.answer || '' },
      sectorAverages: SECTORS.map((s) => ({ ...s, avg: 0 })),
      strongest: null,
      weakest: null,
      dominoInsights: [],
      dailySeries: [],
      weeklySeries: [],
    };
  }

  const current = entries[entries.length - 1].total;
  const prev = entries.length > 1 ? entries[entries.length - 2].total : current;
  const delta = Number((current - prev).toFixed(1));
  const avg = Number((entries.reduce((a, d) => a + d.total, 0) / entries.length).toFixed(1));

  let ath = { value: entries[0].total, label: entries[0].date };
  let runningPeak = entries[0].total;
  let maxDrawdown = 0;

  for (const d of entries) {
    if (d.total >= ath.value) ath = { value: d.total, label: d.date };
    if (d.total > runningPeak) runningPeak = d.total;
    if (runningPeak > 0) {
      const dd = ((runningPeak - d.total) / runningPeak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  const currentDrawdown = ath.value > 0 ? Number((((ath.value - current) / ath.value) * 100).toFixed(1)) : 0;

  let consecutiveDrops = 0;
  for (let i = entries.length - 1; i > 0; i--) {
    if (entries[i].total < entries[i - 1].total) consecutiveDrops++;
    else break;
  }

  const reasons = [];
  if (consecutiveDrops >= 3) reasons.push(`هبوط متتالي لـ ${consecutiveDrops} أيام`);
  if (currentDrawdown >= 18) reasons.push(`تراجع ${currentDrawdown}% عن القمة`);

  const sectorAverages = SECTORS.map((s) => {
    const valid = entries.map((d) => d.sectorScores[s.id]).filter((v) => typeof v === 'number');
    const sAvg = valid.length ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)) : 0;
    return { ...s, avg: sAvg };
  });

  const ranked = [...sectorAverages].sort((a, b) => b.avg - a.avg);

  return {
    daysCount: entries.length,
    weeksCount: weeklySeries.length,
    current,
    delta,
    avg,
    ath,
    maxDrawdown: Number(maxDrawdown.toFixed(1)),
    currentDrawdown,
    circuitBreaker: {
      active: reasons.length > 0,
      reasons,
      planText: state.arbaeen?.['37']?.answer?.trim() || '',
    },
    sectorAverages,
    strongest: ranked[0],
    weakest: ranked[ranked.length - 1],
    dominoInsights: computeDominoInsights(entries),
    dailySeries: entries,
    weeklySeries,
  };
}

export function computeSectorHistory(state, sectorId) {
  const weights = state.weights || {};
  return Object.entries(state.dailyLogs || {})
    .sort(([d1], [d2]) => d1.localeCompare(d2))
    .slice(-30)
    .map(([date, log]) => {
      const res = computeDailyResult(log.answers, weights);
      return { date, score: res.sectorScores[sectorId] };
    })
    .filter((item) => typeof item.score === 'number');
}

export function computeArbaeenStreak(arbaeenMap = {}) {
  let maxStreak = 0;
  let currentStreak = 0;
  for (let d = 1; d <= 40; d++) {
    if (arbaeenMap[String(d)]?.done) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
}

export function generateArbaeenMarkdown(arbaeenMap = {}) {
  const lines = [
    '# وثيقة الأربعين — جرد ومراجعة ذاتية',
    `> تاريخ التصدير: ${getTodayKey()}`,
    '',
  ];
  for (const phase of ARBAEEN_PHASES) {
    lines.push(`## المرحلة ${phase.id}: ${phase.title}`, '');
    for (let day = phase.range[0]; day <= phase.range[1]; day++) {
      const entry = arbaeenMap[String(day)];
      lines.push(`### اليوم ${day} (${entry?.done ? 'مكتمل' : 'غير مكتمل'})`);
      lines.push(`**السؤال:** ${ARBAEEN_PROMPTS[day - 1]}`, '');
      lines.push(entry?.answer?.trim() ? entry.answer.trim() : '_لم تُكتب إجابة بعد._', '', '---', '');
    }
  }
  return lines.join('\n');
}

export function exportSummaryCardPNG(stats, state) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#0b0f13';
  ctx.strokeStyle = '#1e2630';
  ctx.lineWidth = 2;
  ctx.fillRect(44, 44, 992, 1262);
  ctx.strokeRect(44, 44, 992, 1262);

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(96, 110, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 34px monospace';
  ctx.fillText(`LIFE-IDX v3 // ${state.year}`, 122, 122);

  const arbaeenDone = Object.values(state.arbaeen || {}).filter((d) => d?.done).length;
  ctx.fillStyle = '#8b95a5';
  ctx.font = '22px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`DAYS ${stats.daysCount} | ARBAEEN ${arbaeenDone}/40`, 994, 120);
  ctx.textAlign = 'left';

  const kpis = [
    { label: 'TODAY', value: `${stats.current}`, color: '#f3f4f6' },
    { label: 'AVG', value: `${stats.avg}`, color: '#3b82f6' },
    { label: 'ATH', value: `${stats.ath.value}`, color: '#22c55e' },
    { label: 'MAX DD', value: `-${stats.maxDrawdown}%`, color: '#ef4444' },
  ];

  kpis.forEach((k, idx) => {
    const x = 80 + idx * 236;
    ctx.fillStyle = '#11161c';
    ctx.fillRect(x, 166, 216, 124);
    ctx.strokeStyle = '#1e2630';
    ctx.strokeRect(x, 166, 216, 124);
    ctx.fillStyle = '#8b95a5';
    ctx.font = '600 18px monospace';
    ctx.fillText(k.label, x + 18, 202);
    ctx.fillStyle = k.color;
    ctx.font = 'bold 42px monospace';
    ctx.fillText(k.value, x + 18, 264);
  });

  // 10 أشرطة للقطاعات
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('متوسط القطاعات الـ 10', 994, 354);

  stats.sectorAverages.forEach((s, idx) => {
    const y = 406 + idx * 78;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '600 22px sans-serif';
    ctx.fillText(s.name, 994, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = s.color;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${s.avg}`, 80, y);
    ctx.fillStyle = '#11161c';
    ctx.fillRect(156, y - 16, 560, 18);
    ctx.fillStyle = s.color;
    ctx.fillRect(156, y - 16, Math.round((s.avg / 100) * 560), 18);
  });

  ctx.fillStyle = '#4b5563';
  ctx.font = '18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`GENERATED BY LIFE-IDX • ${getTodayKey()}`, 540, 1272);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `life-idx-v3-${getTodayKey()}.png`;
  a.click();
}
