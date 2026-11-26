import { PILLARS, SUBSECTORS, ARBAEEN_PROMPTS, ARBAEEN_PHASES } from './constants';

export function rawToPercent(subsector, rawVal) {
  const num = Number(rawVal);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (subsector.inputType === 'scale') {
    return Math.min(100, Math.max(0, Math.round(num)));
  }
  return Math.min(100, Math.round((num / subsector.target) * 100));
}

export function percentToRaw(subsector, pct) {
  const num = Number(pct);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (subsector.inputType === 'scale') return Math.min(100, Math.round(num));
  return Math.min(subsector.max, Math.round((num / 100) * subsector.target));
}

export function calcPillarScores(scores, weights) {
  const result = {};
  for (const pillar of PILLARS) {
    const subs = SUBSECTORS.filter((s) => s.pillarId === pillar.id);
    let wSum = 0;
    let valSum = 0;
    for (const s of subs) {
      const w = Number(weights?.[s.id] ?? s.defaultWeight);
      const sc = Number(scores?.[s.id] ?? 0);
      wSum += w;
      valSum += sc * w;
    }
    result[pillar.id] = wSum > 0 ? Number((valSum / wSum).toFixed(1)) : 0;
  }
  return result;
}

export function calcWeightedScore(scores, weights) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of SUBSECTORS) {
    const w = Number(weights?.[s.id] ?? s.defaultWeight);
    const sc = Number(scores?.[s.id] ?? 0);
    totalWeight += w;
    weightedSum += sc * w;
  }
  if (totalWeight <= 0) return 0;
  return Number((weightedSum / totalWeight).toFixed(1));
}

export function getSortedWeeks(weeks = []) {
  return [...weeks].sort((a, b) => a.week - b.week);
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

// محرك الدومينو: يكتشف أقوى ارتباط بين القطاعات عبر المحاور المختلفة
export function computeDominoInsights(series) {
  if (series.length < 4) return [];

  const pairs = [];
  for (let i = 0; i < SUBSECTORS.length; i++) {
    for (let j = i + 1; j < SUBSECTORS.length; j++) {
      const a = SUBSECTORS[i];
      const b = SUBSECTORS[j];
      // الأولوية للارتباطات العابرة للمحاور لأنها تكشف الأنماط الخفية
      if (a.pillarId === b.pillarId) continue;
      const xs = series.map((w) => Number(w.scores[a.id] ?? 0));
      const ys = series.map((w) => Number(w.scores[b.id] ?? 0));
      const r = pearsonCorrelation(xs, ys);
      if (r !== null && r >= 0.65) {
        pairs.push({
          a,
          b,
          r: Number(r.toFixed(2)),
          pct: Math.round(r * 100),
        });
      }
    }
  }

  return pairs.sort((p1, p2) => p2.r - p1.r).slice(0, 2);
}

export function computeIndexStats(weeks, weights, arbaeen = {}) {
  const sorted = getSortedWeeks(weeks);
  if (sorted.length === 0) {
    return {
      count: 0,
      current: 0,
      delta: 0,
      avg: 0,
      ath: { value: 0, week: null },
      atl: { value: 0, week: null },
      maxDrawdown: 0,
      currentDrawdown: 0,
      consecutiveDrops: 0,
      circuitBreaker: { active: false, reasons: [], planText: arbaeen?.['37']?.answer || '' },
      pillarAverages: PILLARS.map((p) => ({ ...p, avg: 0 })),
      strongest: null,
      weakest: null,
      dominoInsights: [],
      series: [],
    };
  }

  const series = sorted.map((w) => ({
    ...w,
    total: calcWeightedScore(w.scores, weights),
    pillars: calcPillarScores(w.scores, weights),
  }));

  const current = series[series.length - 1].total;
  const prev = series.length > 1 ? series[series.length - 2].total : current;
  const delta = Number((current - prev).toFixed(1));
  const avg = Number(
    (series.reduce((acc, item) => acc + item.total, 0) / series.length).toFixed(1)
  );

  let ath = { value: series[0].total, week: series[0].week };
  let atl = { value: series[0].total, week: series[0].week };
  let runningPeak = series[0].total;
  let maxDrawdown = 0;

  for (const item of series) {
    if (item.total >= ath.value) ath = { value: item.total, week: item.week };
    if (item.total <= atl.value) atl = { value: item.total, week: item.week };
    if (item.total > runningPeak) runningPeak = item.total;
    if (runningPeak > 0) {
      const dd = ((runningPeak - item.total) / runningPeak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  const currentDrawdown =
    ath.value > 0 ? Number((((ath.value - current) / ath.value) * 100).toFixed(1)) : 0;

  // حساب عدد أسابيع الهبوط المتتالية الأخيرة
  let consecutiveDrops = 0;
  for (let i = series.length - 1; i > 0; i--) {
    if (series[i].total < series[i - 1].total) consecutiveDrops++;
    else break;
  }

  const reasons = [];
  if (consecutiveDrops >= 2) {
    reasons.push(`هبوط متتالي لمدة ${consecutiveDrops} أسابيع`);
  }
  if (currentDrawdown >= 15) {
    reasons.push(`تراجع ${currentDrawdown}% عن أعلى قمة (ATH)`);
  }

  const pillarAverages = PILLARS.map((p) => {
    const sum = series.reduce((acc, item) => acc + item.pillars[p.id], 0);
    return { ...p, avg: Number((sum / series.length).toFixed(1)) };
  });

  const subsectorAverages = SUBSECTORS.map((s) => {
    const sum = series.reduce((acc, item) => acc + Number(item.scores[s.id] || 0), 0);
    const parent = PILLARS.find((p) => p.id === s.pillarId);
    return { ...s, color: parent?.color || '#22c55e', avg: Number((sum / series.length).toFixed(1)) };
  }).sort((a, b) => b.avg - a.avg);

  return {
    count: series.length,
    current,
    delta,
    avg,
    ath,
    atl,
    maxDrawdown: Number(maxDrawdown.toFixed(1)),
    currentDrawdown,
    consecutiveDrops,
    circuitBreaker: {
      active: reasons.length > 0,
      reasons,
      planText: arbaeen?.['37']?.answer?.trim() || '',
    },
    pillarAverages,
    strongest: subsectorAverages[0],
    weakest: subsectorAverages[subsectorAverages.length - 1],
    dominoInsights: computeDominoInsights(series),
    series,
  };
}

export function generateArbaeenMarkdown(arbaeenMap = {}) {
  const lines = [
    '# وثيقة الأربعين — جرد ومراجعة ذاتية',
    `> تاريخ التصدير: ${new Date().toISOString().slice(0, 10)}`,
    '',
  ];

  for (const phase of ARBAEEN_PHASES) {
    lines.push(`## المرحلة ${phase.id}: ${phase.title}`, '');
    for (let day = phase.range[0]; day <= phase.range[1]; day++) {
      const entry = arbaeenMap[String(day)];
      const status = entry?.done ? 'مكتمل' : 'غير مكتمل';
      lines.push(`### اليوم ${day} (${status})`);
      lines.push(`**السؤال:** ${ARBAEEN_PROMPTS[day - 1]}`);
      lines.push('');
      lines.push(entry?.answer?.trim() ? entry.answer.trim() : '_لم تُكتب إجابة بعد._');
      lines.push('', '---', '');
    }
  }
  return lines.join('\n');
}

// مولّد بطاقة الملخص البصري السنوي/الربع سنوي كصورة PNG بدون مكتبات خارجية
export function exportSummaryCardPNG(stats, state) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // الخلفية
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, 1080, 1350);

  // الإطار الداخلي
  ctx.fillStyle = '#0b0f13';
  ctx.strokeStyle = '#1e2630';
  ctx.lineWidth = 2;
  ctx.fillRect(48, 48, 984, 1254);
  ctx.strokeRect(48, 48, 984, 1254);

  // الهيدر
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(100, 118, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 34px monospace';
  ctx.fillText(`LIFE-IDX // ${state.year}`, 126, 130);

  const arbaeenDone = Object.values(state.arbaeen || {}).filter((d) => d?.done).length;
  ctx.fillStyle = '#8b95a5';
  ctx.font = '24px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`ARBAEEN ${arbaeenDone}/40  |  WEEKS ${stats.count}/52`, 990, 128);
  ctx.textAlign = 'left';

  // بطاقات KPI
  const kpis = [
    { label: 'CURRENT', value: `${stats.current}`, color: '#f3f4f6' },
    { label: 'AVERAGE', value: `${stats.avg}`, color: '#3b82f6' },
    { label: 'ATH', value: `${stats.ath.value}`, color: '#22c55e' },
    { label: 'MAX DD', value: `-${stats.maxDrawdown}%`, color: '#ef4444' },
  ];

  kpis.forEach((k, idx) => {
    const x = 84 + idx * 234;
    ctx.fillStyle = '#11161c';
    ctx.fillRect(x, 180, 214, 132);
    ctx.strokeStyle = '#1e2630';
    ctx.strokeRect(x, 180, 214, 132);

    ctx.fillStyle = '#8b95a5';
    ctx.font = '600 18px monospace';
    ctx.fillText(k.label, x + 20, 218);

    ctx.fillStyle = k.color;
    ctx.font = 'bold 44px monospace';
    ctx.fillText(k.value, x + 20, 282);
  });

  // منحنى الأداء
  ctx.fillStyle = '#11161c';
  ctx.fillRect(84, 344, 912, 290);
  ctx.strokeStyle = '#1e2630';
  ctx.strokeRect(84, 344, 912, 290);

  if (stats.series.length > 1) {
    const chartX = 114;
    const chartY = 374;
    const chartW = 852;
    const chartH = 220;

    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    [0, 50, 100].forEach((lvl) => {
      const y = chartY + chartH - (lvl / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartW, y);
      ctx.stroke();
    });

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    stats.series.forEach((pt, idx) => {
      const x = chartX + (idx / (stats.series.length - 1)) * chartW;
      const y = chartY + chartH - (pt.total / 100) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // أشرطة المحاور الخمسة
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('أداء المحاور الخمسة الرئيسية', 990, 692);

  stats.pillarAverages.forEach((p, idx) => {
    const y = 730 + idx * 62;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '600 22px sans-serif';
    ctx.fillText(p.name, 990, y);

    ctx.textAlign = 'left';
    ctx.fillStyle = p.color;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${p.avg}`, 84, y);

    ctx.fillStyle = '#11161c';
    ctx.fillRect(160, y - 16, 620, 18);
    ctx.fillStyle = p.color;
    ctx.fillRect(160, y - 16, Math.round((p.avg / 100) * 620), 18);
  });

  // أهم 3 دروس وملاحظات
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('أهم الدروس والملاحظات', 990, 1080);

  const notes = [...stats.series]
    .reverse()
    .filter((w) => w.note?.trim())
    .slice(0, 3)
    .map((w) => `• أسبوع ${w.week}: ${w.note.trim().slice(0, 75)}`);

  if (notes.length === 0) {
    notes.push('• سجّل ملاحظاتك الأسبوعية لتظهر خلاصة سنتك هنا.');
  }

  ctx.fillStyle = '#9ca3af';
  ctx.font = '21px sans-serif';
  notes.forEach((line, idx) => {
    ctx.fillText(line, 990, 1126 + idx * 44);
  });

  // الفوتر
  ctx.fillStyle = '#4b5563';
  ctx.font = '18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`GENERATED BY LIFE-IDX  •  ${new Date().toISOString().slice(0, 10)}`, 540, 1278);

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `life-index-summary-${state.year}.png`;
  a.click();
}
