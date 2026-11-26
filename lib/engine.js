import { SECTORS, ARBAEEN_PROMPTS, ARBAEEN_PHASES } from './constants';

export function calcWeightedScore(scores, weights) {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const sector of SECTORS) {
    const w = Number(weights?.[sector.id] ?? sector.defaultWeight);
    const s = Number(scores?.[sector.id] ?? 0);
    totalWeight += w;
    weightedSum += s * w;
  }

  if (totalWeight <= 0) return 0;
  return Number((weightedSum / totalWeight).toFixed(1));
}

export function getSortedWeeks(weeks = []) {
  return [...weeks].sort((a, b) => a.week - b.week);
}

export function computeIndexStats(weeks, weights) {
  const sorted = getSortedWeeks(weeks);
  if (sorted.length === 0) {
    return {
      count: 0,
      current: 0,
      delta: 0,
      avg: 0,
      ath: { value: 0, week: null },
      atl: { value: 0, week: null },
      strongest: null,
      weakest: null,
      series: [],
    };
  }

  const series = sorted.map((w) => ({
    ...w,
    total: calcWeightedScore(w.scores, weights),
  }));

  const current = series[series.length - 1].total;
  const prev = series.length > 1 ? series[series.length - 2].total : current;
  const delta = Number((current - prev).toFixed(1));
  const avg = Number(
    (series.reduce((acc, item) => acc + item.total, 0) / series.length).toFixed(1)
  );

  let ath = { value: series[0].total, week: series[0].week };
  let atl = { value: series[0].total, week: series[0].week };

  for (const item of series) {
    if (item.total >= ath.value) ath = { value: item.total, week: item.week };
    if (item.total <= atl.value) atl = { value: item.total, week: item.week };
  }

  const sectorAverages = SECTORS.map((s) => {
    const sum = series.reduce((acc, item) => acc + Number(item.scores[s.id] || 0), 0);
    return { ...s, avg: Number((sum / series.length).toFixed(1)) };
  }).sort((a, b) => b.avg - a.avg);

  return {
    count: series.length,
    current,
    delta,
    avg,
    ath,
    atl,
    strongest: sectorAverages[0],
    weakest: sectorAverages[sectorAverages.length - 1],
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
