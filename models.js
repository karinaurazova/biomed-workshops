const palette = {
  ink: '#211939', muted: '#645676', grid: '#ded5ed', purple: '#6744d0',
  teal: '#007c79', pink: '#c63672', gold: '#9a5a07', pale: '#eee6fa',
};
const number = (value, digits = 1) => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: digits,
}).format(value);
const bounds = (value, min, max) => Math.max(min, Math.min(max, value));
const series = (count, sample) => Array.from({ length: count }, (_, index) => sample(index));
const slider = (key, label, min, max, step, initial) => ({ key, label, min, max, step, initial, kind: 'range' });
const choice = (key, label, options, initial) => ({ key, label, options, initial, kind: 'select' });
const checkbox = (key, label, initial = false) => ({ key, label, initial, kind: 'check' });
const initialState = model => Object.fromEntries(model.controls.map(({ key, initial }) => [key, initial]));
const metric = (label, value) => ({ label, value });
const line = (points, color = palette.purple, dashed = false, dots = false) => ({ points, color, dashed, dots });
const percent = fraction => number(100 * fraction, 1) + '%';

function label(ctx, text, x, y, opts = {}) {
  ctx.fillStyle = opts.color || palette.muted;
  ctx.font = (opts.bold ? '700 ' : '500 ') + (opts.size || 12) + 'px -apple-system, sans-serif';
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  ctx.fillText(text, x, y);
}
function fill(ctx, color, x, y, width, height, radius = 0) {
  ctx.fillStyle = color;
  if (!radius) {
    ctx.fillRect(x, y, width, height);
    return;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}
function stroke(ctx, points, color, width = 2, dashed = false) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  points.slice(1).forEach(point => ctx.lineTo(...point));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dashed ? [5, 5] : []);
  ctx.stroke();
  ctx.setLineDash([]);
}
function circle(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}
function sceneBg(ctx, w, h, color = '#f7f4fc') {
  fill(ctx, color, 0, 0, w, h);
  ctx.beginPath();
  for (let x = 12; x < w; x += 23) {
    for (let y = 12; y < h; y += 23) {
      ctx.moveTo(x + 1, y);
      ctx.arc(x, y, 1, 0, 2 * Math.PI);
    }
  }
  ctx.fillStyle = '#9b83c02c';
  ctx.fill();
}

function plot(ctx, w, h, {
  lines, xmin = 0, xmax, ymin = 0, ymax, axis = '', yaxis = '',
  markers = [], preview = false, background = '#f4f0fb', band = null,
}) {
  fill(ctx, background, 0, 0, w, h);
  const left = preview ? 10 : 46;
  const right = w - (preview ? 10 : 18);
  const top = preview ? 14 : 31;
  const bottom = h - (preview ? 12 : 40);
  const xAt = x => left + (x - xmin) / (xmax - xmin) * (right - left);
  const yAt = y => bottom - (y - ymin) / (ymax - ymin) * (bottom - top);
  if (band) fill(ctx, band.color, xAt(band.left), top, xAt(band.right) - xAt(band.left), bottom - top);
  for (let tick = 0; tick <= 4; tick++) {
    const xr = tick / 4;
    const x = left + xr * (right - left);
    const y = bottom - xr * (bottom - top);
    stroke(ctx, [[x, top], [x, bottom]], palette.grid, 1);
    stroke(ctx, [[left, y], [right, y]], palette.grid, 1);
    if (!preview) {
      label(ctx, number(xmin + xr * (xmax - xmin), 2), x, bottom + 16, { align: 'center', size: 11 });
      label(ctx, number(ymin + xr * (ymax - ymin), 1), left - 7, y + 4, { align: 'right', size: 11 });
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(left - 1, top - 1, right - left + 2, bottom - top + 2);
  ctx.clip();
  for (const trace of lines) {
    const coords = trace.points.map(([x, y]) => [xAt(x), yAt(y)]);
    stroke(ctx, coords, trace.color, preview ? 2 : 2.25, trace.dashed);
    if (trace.dots) coords.forEach(([x, y]) => circle(ctx, x, y, preview ? 1.7 : 3, trace.color));
  }
  for (const mark of markers) {
    if (mark.vertical) {
      stroke(ctx, [[xAt(mark.x), top], [xAt(mark.x), bottom]], mark.color, 1.3, true);
    } else {
      circle(ctx, xAt(mark.x), yAt(mark.y), preview ? 2.1 : 4, mark.color);
    }
  }
  ctx.restore();
  if (!preview) {
    label(ctx, axis, right, h - 8, { align: 'right' });
    label(ctx, yaxis, left, 19);
  }
}
function gauss(x, center, width) {
  return Math.exp(-(((x - center) / width) ** 2));
}
function waveform(t, period) {
  const phase = ((t % period) + period) % period / period;
  return .12 * gauss(phase, .15, .047) - .18 * gauss(phase, .29, .022)
    + .98 * gauss(phase, .325, .022) - .28 * gauss(phase, .364, .029)
    + .24 * gauss(phase, .62, .087);
}
function noiseAt(index, seed = 1) {
  const n = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}
function paintHero(ctx, w, h) {
  const baseline = .57 * h;
  const top = .20 * h;
  ctx.save();
  const spacing = Math.max(22, w / 17);
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, '#cdb6ff00');
  gradient.addColorStop(.17, '#9d78f0');
  gradient.addColorStop(.63, '#e6d5ff');
  gradient.addColorStop(1, '#b88aff45');
  for (let y = top; y < h; y += spacing) {
    stroke(ctx, [[0, y], [w, y]], '#cbb2ff18', 1);
  }
  for (let x = 0; x < w; x += spacing) {
    stroke(ctx, [[x, top - 12], [x, h - 14]], '#cbb2ff19', 1);
  }
  const curve = (offset, scale, drift) => series(624, i => {
    const x = i / 623 * w;
    const t = i / 623 * 3.6 + drift;
    return [x, baseline + offset - scale * waveform(t, .8) + Math.sin(t * 15) * 1.5];
  });
  stroke(ctx, curve(-h * .105, h * .21, .28), '#9c76e55b', 1.35);
  stroke(ctx, curve(h * .115, h * .19, -.22), '#ba8fff60', 1.35);
  stroke(ctx, curve(h * .20, h * .13, -.36), '#be9de534', 1.05);
  ctx.shadowColor = '#bb91ff';
  ctx.shadowBlur = 16;
  stroke(ctx, curve(0, h * .34, 0), gradient, 2.5);
  ctx.restore();
}
function pulseResult(s) {
  const duration = 6.4;
  const points = series(801, i => {
    const t = duration * i / 800;
    return [t, waveform(t, s.period) + s.noise / 100 * noiseAt(i, 7)];
  });
  const truePeaks = [];
  for (let t = .325 * s.period; t < duration; t += s.period) truePeaks.push(t);
  const detected = [];
  for (let i = 1; i < points.length; i++) {
    const [t, y] = points[i];
    const crossed = y >= s.threshold && points[i - 1][1] < s.threshold;
    if (crossed && (!detected.length || t - detected.at(-1).x + 1e-9 >= s.pause)) {
      detected.push({ x: t, y, color: palette.teal });
    }
  }
  return { points, truePeaks, detected, duration };
}
function drawPulse(ctx, w, h, s, preview) {
  const { points, truePeaks, detected, duration } = pulseResult(s);
  const reference = s.reference ? truePeaks.map(x => ({ x, vertical: true, color: palette.pink })) : [];
  plot(ctx, w, h, { lines: [line(points)], xmin: 0, xmax: duration, ymin: -.6, ymax: 1.4,
    axis: 'Время, с', yaxis: 'Уровень сигнала', preview, markers: [...reference, ...detected] });
  return {
    caption: 'Точки — срабатывания детектора. Пунктир при включённом эталоне — заданные удары.',
    metrics: [metric('Заданная частота', number(60 / s.period) + ' уд/мин'),
      metric('Отметки детектора', detected.length), ...(s.reference ? [metric('Удары на записи', truePeaks.length)] : [])],
  };
}
function drawRhythm(ctx, w, h, s, preview) {
  const duration = 6.4;
  const beats = [];
  for (let t = 0; t < duration; t += 2 * s.period) {
    beats.push({ x: t, vertical: true, color: palette.teal });
    if (t + s.period - s.variation < duration) {
      beats.push({ x: t + s.period - s.variation, vertical: true, color: palette.teal });
    }
  }
  // Place each peak at the same offset from its interval boundary so peak intervals
  // match the two lengths shown in the exercise.
  const exact = series(940, i => {
    const t = duration * i / 939;
    let signal = 0;
    for (const beat of beats) {
      const peak = beat.x + .17;
      const u = t - peak;
      signal += .9 * gauss(u, 0, .016) - .20 * gauss(u, .035, .03) + .22 * gauss(u, .18, .055);
    }
    return [t, signal];
  });
  plot(ctx, w, h, { lines: [line(exact)], xmax: duration, ymin: -.4, ymax: 1.2, axis: 'Время, с',
    yaxis: 'Учебный сигнал', preview });
  return { caption: 'Меняя разброс интервалов, сохраняем их среднее значение на полном цикле.',
    metrics: [metric('Средняя частота', number(60 / s.period) + ' уд/мин'),
      metric('Короткий интервал', number(s.period - s.variation, 2) + ' с'),
      metric('Длинный интервал', number(s.period + s.variation, 2) + ' с')] };
}
const memoryPatterns = [
  '0111010001100011000101110',
  '0010000100111110010000100',
  '1000101010001000101010001',
].map(pattern => [...pattern].map(Number));
function drawMemory(ctx, w, h, s, preview) {
  sceneBg(ctx, w, h, '#eee8fa');
  const original = memoryPatterns[Number(s.pattern)];
  const order = series(25, i => i).sort((a, b) => noiseAt(a, 19) - noiseAt(b, 19));
  const flips = new Set(order.slice(0, s.corruption));
  const received = original.map((v, i) => flips.has(i) ? 1 - v : v);
  const distance = target => target.filter((value, i) => value !== received[i]).length;
  const recovered = memoryPatterns.reduce((best, candidate) => distance(best) <= distance(candidate) ? best : candidate);
  const active = s.signal >= s.threshold;
  const cell = Math.min(w / 14, h / 9, 37);
  const margin = (w - 12 * cell) / 2;
  const y0 = Math.max(17, (h - 5 * cell) / 2);
  for (const [pattern, x0, title] of [[received, margin, 'Вход'], [recovered, margin + 7 * cell, 'Восстановление']]) {
    if (!preview) label(ctx, title, x0, y0 - 8, { bold: true });
    pattern.forEach((v, i) => fill(ctx, v ? palette.purple : '#dbcfee',
      x0 + (i % 5) * cell, y0 + Math.floor(i / 5) * cell, cell - 3, cell - 3, 3));
  }
  label(ctx, '›', w / 2, y0 + cell * 2.55, { size: 32, align: 'center', color: palette.purple });
  return {
    caption: 'Учебный нейрон срабатывает при достижении порога. Сеть памяти выбирает ближайший сохранённый рисунок.',
    metrics: [metric('Учебный нейрон', active ? 'Активен' : 'Покой'), metric('Искажения на входе', s.corruption),
      metric('Совпало с исходным', recovered.filter((v, i) => v === original[i]).length + ' из 25')],
  };
}
function drawTumor(ctx, w, h, s, preview) {
  const volume = (t, rate) => 400 / (1 + 3 * Math.exp(-rate * t));
  const natural = t => volume(t, s.growth);
  const affected = t => volume(t, s.growth - s.effect);
  const until = 10;
  plot(ctx, w, h, { lines: [line(series(101, i => [i / 10, natural(i / 10)]), palette.teal, true),
    line(series(101, i => [i / 10, affected(i / 10)]))], xmax: until, ymax: 400,
    axis: 'Условное время', yaxis: 'Относительный объём', preview });
  return { caption: 'Фиолетовая кривая — с условным эффектом. Пунктир — рост при исходном темпе.',
    metrics: [metric('Без условного эффекта', number(natural(until))), metric('С условным эффектом', number(affected(until))),
      metric('Чистый темп модели', number(s.growth - s.effect, 2))] };
}
const healthPeaks = { moderate: [91, 64, 48], high: [132, 94, 68] };
const measures = ['Обычный режим', 'Точечные меры', 'Доп. ограничения'];
function drawPublicHealth(ctx, w, h, s, preview) {
  const peaks = healthPeaks[s.scenario];
  const colors = [palette.pink, palette.purple, palette.teal];
  const traces = peaks.map((peak, i) => line(series(13, week => [week, peak * gauss(week, 6, 2.8 + i * .25)]), colors[i]));
  traces.push(line([[0, s.capacity], [12, s.capacity]], palette.muted, true));
  const selected = peaks.findIndex(peak => peak < s.capacity);
  plot(ctx, w, h, { lines: traces, xmax: 12, ymax: 140, axis: 'Недели вымышленного сценария',
    yaxis: 'Условная нагрузка', preview });
  return {
    caption: 'Розовая — обычный режим. Фиолетовая — точечные меры. Зелёная — дополнительные ограничения. Пунктир — учебный предел.',
    metrics: [metric('Пики трёх сценариев', peaks.join(' / ')),
      metric('Первый вариант ниже предела', selected < 0 ? 'Нет' : measures[selected])],
  };
}
function leverResult(s) {
  const angle = s.angle * Math.PI / 180;
  const force = s.load * s.distance / (s.anchor * Math.sin(angle));
  return { angle, force };
}
function drawLever(ctx, w, h, s, preview) {
  const { angle, force } = leverResult(s);
  const ox = w * .13;
  const y = h * .49;
  const scale = w * .67 / 24;
  const ax = ox + s.anchor * scale;
  const lx = ox + s.distance * scale;
  const length = Math.min(h * .28, w * .13);
  sceneBg(ctx, w, h, '#eae5fa');
  stroke(ctx, [[ox, y], [ox + 24 * scale, y]], '#6043b5', 8);
  ctx.beginPath();
  ctx.moveTo(ox, y); ctx.lineTo(ox - 14, y + 24); ctx.lineTo(ox + 14, y + 24);
  ctx.closePath(); ctx.fillStyle = '#9b81db'; ctx.fill();
  circle(ctx, ox, y, 7, '#fff');
  circle(ctx, ox, y, 3, palette.ink);
  const at = [ax + length * Math.cos(angle), y - length * Math.sin(angle)];
  stroke(ctx, [[ax, y], at], palette.teal, 3);
  circle(ctx, ...at, 5, palette.teal);
  circle(ctx, ax, y, 4, palette.teal);
  stroke(ctx, [[lx, y], [lx, y + length * .65]], palette.pink, 3);
  fill(ctx, palette.pink, lx - 13, y + length * .65, 26, 15, 3);
  if (!preview) {
    label(ctx, 'Тяга', at[0] + 8, at[1] - 6, { color: palette.teal, bold: true });
    label(ctx, 'Груз', lx, y + length * .65 + 31, { align: 'center', color: palette.pink, bold: true });
    label(ctx, 'Ось', ox, y + 44, { align: 'center' });
  }
  return { caption: 'Зелёный отрезок — направление тяги, розовый — действие груза.',
    metrics: [metric('Усилие тяги', number(force) + ' Н'), metric('Момент груза', number(s.load * s.distance / 100, 2) + ' Н·м'),
      metric('Предел 30 Н', force <= 30 + 1e-9 ? 'Хватает' : 'Превышен')] };
}
function flowResult(s) {
  const conductance = 1 / s.r1 + 1 / s.r2;
  const pressure = s.mode === 'flow' ? s.total / conductance : s.pressure;
  return { pressure, q1: pressure / s.r1, q2: pressure / s.r2 };
}
function drawFlow(ctx, w, h, s, preview) {
  const { q1, q2, pressure } = flowResult(s);
  sceneBg(ctx, w, h, '#eee7fa');
  const mid = h / 2;
  const top = h * .26;
  const bottom = h * .74;
  const total = q1 + q2;
  const start = w * .10;
  const junction = w * .29;
  const merge = w * .71;
  const end = w * .90;
  const width1 = 7 + 28 * q1 / total;
  const width2 = 7 + 28 * q2 / total;
  stroke(ctx, [[start, mid], [junction, mid]], '#ae95e6', 28);
  stroke(ctx, [[merge, mid], [end, mid]], '#ae95e6', 28);
  stroke(ctx, [[junction, mid], [junction + 24, top], [merge - 24, top], [merge, mid]], palette.purple, width1);
  stroke(ctx, [[junction, mid], [junction + 24, bottom], [merge - 24, bottom], [merge, mid]], palette.teal, width2);
  if (!preview) {
    label(ctx, 'Ветвь 1 · ' + percent(q1 / total), w / 2, top - width1 / 2 - 7, { align: 'center', bold: true });
    label(ctx, 'Ветвь 2 · ' + percent(q2 / total), w / 2, bottom + width2 / 2 + 18, { align: 'center', bold: true });
  }
  return { caption: 'Толщина ветви показывает её долю общего расхода.',
    metrics: [metric('Ветвь 1', number(q1) + ' мл/мин'), metric('Ветвь 2', number(q2) + ' мл/мин'),
      metric('Общий расход', number(total) + ' мл/мин'), metric('Перепад давления', number(pressure) + ' усл. ед.')] };
}
function drawDiffusion(ctx, w, h, s, preview) {
  const width = Math.sqrt(2 * s.d * s.time);
  const concentration = x => Math.exp(-.5 * (x / width) ** 2) / (Math.sqrt(2 * Math.PI) * width);
  const ymax = Math.max(.55, Math.ceil(concentration(0) * 10) / 10);
  const points = series(161, i => { const x = i / 16 - 5; return [x, concentration(x)]; });
  plot(ctx, w, h, { lines: [line(points)], xmin: -5, xmax: 5, ymax, axis: 'Расстояние от центра, мм',
    yaxis: 'Относительная концентрация', preview, background: '#eee9fa',
    band: { left: -width, right: width, color: '#dcd0f2a0' },
    markers: [{ x: -width, vertical: true, color: palette.teal }, { x: width, vertical: true, color: palette.teal }],
  });
  return { caption: 'Затенён интервал в пределах одного характерного расстояния от центра в обе стороны.',
    metrics: [metric('Характерное расстояние', number(width, 3) + ' мм'), metric('Квадрат расстояния', number(width ** 2, 3) + ' мм²')] };
}
function testResult(s) {
  const present = 10 * s.prevalence;
  const absent = 1000 - present;
  const tp = present * s.sensitivity / 100;
  const tn = absent * s.specificity / 100;
  const fp = absent - tn;
  return { tp, tn, fp, fn: present - tp, ppv: tp + fp > 1e-9 ? tp / (tp + fp) : null };
}
function drawTest(ctx, w, h, s, preview) {
  const x0 = w * .18, y0 = h * .25;
  const width = w * .32, height = h * .28;
  const { tp, fp, fn, tn, ppv } = testResult(s);
  sceneBg(ctx, w, h, '#ece7fa');
  for (const [i, value, name, tint] of [
    [0, tp, 'Верные +', '#d4c3f7'], [1, fp, 'Ложные +', '#f2cce1'],
    [2, fn, 'Ложные −', '#f2cce1'], [3, tn, 'Верные −', '#bfebe3'],
  ]) {
    const x = x0 + (i % 2) * (width + 5), y = y0 + Math.floor(i / 2) * (height + 5);
    fill(ctx, tint, x, y, width, height, 8);
    label(ctx, number(value), x + width / 2, y + height * (preview ? .63 : .47),
      { size: preview ? 19 : 27, align: 'center', bold: true, color: palette.ink });
    if (!preview) label(ctx, name, x + width / 2, y + height * .75, { align: 'center', bold: true });
  }
  if (!preview) {
    label(ctx, 'Состояние есть', x0 + width * .5, y0 - 10, { align: 'center' });
    label(ctx, 'Состояния нет', x0 + width * 1.5 + 5, y0 - 10, { align: 'center' });
  }
  return { caption: 'В таблице показано ожидаемое число исходов для 1 000 человек.',
    metrics: [metric('Верные положительные', number(tp)), metric('Ложные положительные', number(fp)),
      metric('Ложные отрицательные', number(fn)), metric('Верные отрицательные', number(tn)),
      metric('Доля верных среди положительных', ppv === null ? 'Нет положительных' : percent(ppv))] };
}
function logisticSeries(r, start) {
  let x = start;
  return series(67, n => { const point = [n, x]; x = r * x * (1 - x); return point; });
}
function drawLogistic(ctx, w, h, s, preview) {
  const primary = logisticSeries(s.r, s.start);
  const secondary = logisticSeries(s.r, s.start + .001);
  const recent = primary.slice(-4).map(([, x]) => number(x, 3));
  const compare = s.compare ? [line(secondary, palette.teal, true, true)] : [];
  plot(ctx, w, h, { lines: [line(primary, palette.purple, false, true), ...compare], xmax: 66,
    ymax: 1, axis: 'Номер шага', yaxis: 'Значение x', preview, background: '#eee7fa' });
  return { caption: 'Фиолетовый график — первый старт. Зелёный пунктир — второй старт, если он включён.',
    metrics: [metric('Последние значения', recent.join(' / ')),
      ...(s.compare ? [metric('Разница на последнем шаге', number(Math.abs(primary.at(-1)[1] - secondary.at(-1)[1]), 5))] : [])] };
}
function drawDrops(ctx, w, h, s, preview) {
  const values = series(22, i => {
    if (s.pattern === 'steady') return [.46, .463, .458][i % 3];
    if (s.pattern === 'alternate') return i % 2 ? .36 + .008 * noiseAt(i, 8) : .58 + .008 * noiseAt(i, 8);
    return .26 + .42 * (noiseAt(i, 11) + 1) / 2;
  });
  plot(ctx, w, h, { lines: [line(values.map((v, i) => [i + 1, v]), palette.teal, false, true)],
    xmin: 1, xmax: 22, ymin: .2, ymax: .75, axis: 'Номер капли', yaxis: 'Интервал, с', preview });
  return { caption: 'Синтетические интервалы иллюстрируют формы рядов, которые сравнивают в экспериментах.',
    metrics: [metric('Минимальный интервал', number(Math.min(...values), 3) + ' с'),
      metric('Максимальный интервал', number(Math.max(...values), 3) + ' с')] };
}
const rotorSize = [76, 50];
const rotorFrames = new Map();
function rotorFrame(split, step) {
  const [cols, rows] = rotorSize;
  if (!rotorFrames.has(split)) {
    let grid = new Uint8Array(cols * rows);
    const pivot = Math.floor(rows * .48);
    for (let x = split ? 34 : 0; x < cols; x++) {
      for (let y = pivot; y < pivot + 11; y++) grid[y * cols + x] = y - pivot + 1;
    }
    const frames = [grid];
    for (let t = 1; t <= 62; t++) {
      const next = new Uint8Array(grid.length);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (grid[i]) {
            next[i] = grid[i] < 17 ? grid[i] + 1 : 0;
            continue;
          }
          const excitedNeighbor = (x > 0 && grid[i - 1] === 1)
            || (x + 1 < cols && grid[i + 1] === 1)
            || (y > 0 && grid[i - cols] === 1)
            || (y + 1 < rows && grid[i + cols] === 1);
          next[i] = excitedNeighbor ? 1 : 0;
        }
      }
      grid = next;
      frames.push(grid);
    }
    rotorFrames.set(split, frames);
  }
  return rotorFrames.get(split)[step];
}
function drawRotor(ctx, w, h, s, preview) {
  const [columns, rows] = rotorSize;
  const frame = rotorFrame(s.split, s.step);
  fill(ctx, '#20163d', 0, 0, w, h);
  const size = Math.min(w / columns, h / rows) * .95;
  const x0 = (w - size * columns) / 2;
  const y0 = (h - size * rows) / 2;
  const colors = ['#291d47', '#e5ccff', '#a988ee', '#805bc8', '#543686', '#382653'];
  frame.forEach((value, i) => {
    const shade = value > 1 ? Math.min(5, 1 + Math.ceil(value / 4)) : value;
    fill(ctx, colors[shade], x0 + (i % columns) * size, y0 + Math.floor(i / columns) * size, size + .15, size + .15);
  });
  return { caption: 'Светлые клетки возбуждены, фиолетовые восстанавливаются, тёмные готовы к новому возбуждению.',
    metrics: [metric('Шаг модели', s.step), metric('Возбуждённые клетки', frame.filter(v => v === 1).length)] };
}

function imageSample(x, y, settings) {
  const orientation = settings.shape === 'b' ? -.38 : .29;
  const dx = x - (settings.cx ?? (settings.shape === 'b' ? .12 : -.05));
  const dy = y - (settings.cy ?? (settings.shape === 'b' ? -.10 : .04));
  const vx = dx * Math.cos(orientation) - dy * Math.sin(orientation);
  const vy = dx * Math.sin(orientation) + dy * Math.cos(orientation);
  const shape = settings.shape === 'b'
    ? Math.sqrt((vx / .69) ** 2 + ((vy - .20 * vx ** 2) / .52) ** 2)
    : Math.sqrt((vx / .64) ** 2 + (vy / .52) ** 2);
  const truePixel = shape <= 1;
  const interior = 1 / (1 + Math.exp((shape - 1) / .07));
  const background = .26 + .09 * x + .08 * Math.sin(x * 3.7 + y * 6.3) + .035 * y;
  const texture = .05 * Math.cos(x * 11 - y * 9) * Math.sin(y * 13);
  const intensity = background + (.57 * interior + texture) * settings.contrast / 100
    + settings.noise / 100 * noiseAt(settings.index, settings.seed);
  return { value: bounds(intensity, 0, 1), truePixel };
}
function imageData(settings) {
  const columns = 42, rows = 34;
  const pixels = series(columns * rows, index => imageSample(
    (index % columns) / (columns - 1) * 2 - 1,
    Math.floor(index / columns) / (rows - 1) * 2 - 1,
    { ...settings, index },
  ));
  return { pixels, columns, rows };
}
function imageFeatures(image, index) {
  const { pixels, columns, rows } = image;
  const x0 = index % columns;
  const y0 = Math.floor(index / columns);
  let near = 0, far = 0, nearCount = 0, farCount = 0;
  for (let y = Math.max(0, y0 - 2); y <= Math.min(rows - 1, y0 + 2); y++) {
    for (let x = Math.max(0, x0 - 2); x <= Math.min(columns - 1, x0 + 2); x++) {
      const value = pixels[y * columns + x].value;
      far += value; farCount++;
      if (Math.abs(x - x0) <= 1 && Math.abs(y - y0) <= 1) {
        near += value; nearCount++;
      }
    }
  }
  return [pixels[index].value, near / nearCount, far / farCount];
}
function maskStats(pixels, mask) {
  let count = 0, extra = 0, missed = 0, correct = 0;
  pixels.forEach(({ truePixel }, i) => {
    if (mask[i]) count++;
    if (mask[i] && truePixel) correct++;
    if (mask[i] && !truePixel) extra++;
    if (!mask[i] && truePixel) missed++;
  });
  return { count, extra, missed, area: count * .25, error: (extra - missed) * .25,
    dice: 2 * correct / (2 * correct + extra + missed) };
}
function imageResult(s, neural) {
  const image = imageData({ shape: s.shape, contrast: s.contrast, noise: s.noise, seed: s.shape === 'b' ? 42 : 4 });
  const threshold = image.pixels.map(p => p.value >= s.threshold / 100);
  const network = neural ? image.pixels.map((_, i) => visionPredict(imageFeatures(image, i))) : null;
  return { image, threshold, network, thresholdStats: maskStats(image.pixels, threshold),
    networkStats: network ? maskStats(image.pixels, network) : null };
}
function imagePanel(ctx, image, mask, x0, y0, pixel, reference) {
  const { pixels, columns } = image;
  pixels.forEach((p, i) => {
    const x = x0 + (i % columns) * pixel;
    const y = y0 + Math.floor(i / columns) * pixel;
    const intensity = Math.round(28 + p.value * 215);
    let color = 'rgb(' + intensity + ',' + intensity + ',' + Math.min(255, intensity + 14) + ')';
    if (mask && mask[i]) color = reference && !p.truePixel ? '#dc648e' : 'rgb(' + Math.round(intensity * .66) + ',' + Math.round(intensity * .61) + ',221)';
    if (mask && reference && !mask[i] && p.truePixel) color = '#64c1ab';
    fill(ctx, color, Math.floor(x), Math.floor(y), Math.ceil(pixel), Math.ceil(pixel));
  });
}
function drawImage(ctx, w, h, s, preview, neural = false) {
  const { image, threshold, network, thresholdStats, networkStats } = imageResult(s, neural);
  const plots = neural ? [[null, 'Снимок'], [threshold, 'Порог'], [network, 'Нейросеть']] : [[null, 'Снимок'], [threshold, 'Выделение']];
  const gap = 8;
  const pixel = Math.min((w - (plots.length + 1) * gap) / (image.columns * plots.length), (h - 36) / image.rows);
  const stripWidth = pixel * image.columns * plots.length + gap * (plots.length - 1);
  const x0 = (w - stripWidth) / 2;
  const y0 = (h - pixel * image.rows) / 2 + (preview ? 1 : 8);
  sceneBg(ctx, w, h, '#ebe4f5');
  plots.forEach(([mask, title], i) => {
    const x = x0 + (image.columns * pixel + gap) * i;
    imagePanel(ctx, image, mask, x, y0, pixel, s.reference && !preview);
    if (!preview) label(ctx, title, x + image.columns * pixel / 2, y0 - 8, { align: 'center', bold: true });
  });
  const area = stats => number(stats.area, 2) + ' мм²';
  const delta = stats => number(Math.abs(stats.error), 2) + ' мм²';
  const metrics = neural
    ? [metric('Порог · площадь', area(thresholdStats)), metric('Сеть · площадь', area(networkStats))]
    : [metric('Выделено пикселей', thresholdStats.count), metric('Площадь', area(thresholdStats))];
  if (s.reference) {
    if (neural) {
      metrics.push(metric('Порог · Dice', percent(thresholdStats.dice)), metric('Сеть · Dice', percent(networkStats.dice)),
        metric('Порог · ошибка площади', delta(thresholdStats)), metric('Сеть · ошибка площади', delta(networkStats)),
        metric('Порог · ошибочные пиксели', thresholdStats.extra + thresholdStats.missed),
        metric('Сеть · ошибочные пиксели', networkStats.extra + networkStats.missed));
    } else {
      metrics.push(metric('Ошибка площади', delta(thresholdStats)), metric('Лишние / пропущенные', thresholdStats.extra + ' / ' + thresholdStats.missed));
    }
  }
  const caption = s.reference ? 'Фиолетовый — выделенная область. Розовый — лишние пиксели. Зелёный — пропуски.'
    : 'Фиолетовый цвет показывает выделенную область. Включите эталон для просмотра ошибок.';
  return { caption, metrics };
}
const stentDesigns = { a: [.24, .72], b: [.115, .95], c: [.055, 1.30] };
function stentResult(s) {
  const [a, b] = stentDesigns[s.design];
  const short = a * (s.diameter - 2) / 2;
  const length = 15 * (1 - short);
  const pressure = b * s.stiffness * Math.max(0, s.diameter - 2.15);
  const works = length >= 12.5 && pressure <= 1.55 && s.diameter >= 3.5;
  return { short, length, pressure, works };
}
function drawStent(ctx, w, h, s, preview) {
  const { short, length, pressure, works } = stentResult(s);
  const mid = h / 2;
  const span = Math.min(w * .68, length * w / 23);
  const start = (w - span) / 2;
  const half = h * .068 * s.diameter;
  sceneBg(ctx, w, h, '#f3e9f6');
  const wall = (side, expanded) => series(77, i => {
    const x = i * w / 76;
    const narrow = h * .32 - h * .14 * gauss(x / w, .5, .20);
    const supported = half * bounds((span / 2 + w * .04 - Math.abs(x - w / 2)) / (w * .04), 0, 1);
    return [x, mid + side * (expanded ? Math.max(narrow, supported) : narrow)];
  });
  for (const side of [-1, 1]) {
    stroke(ctx, wall(side, true), '#e5a4c5', 9);
    if (!preview) stroke(ctx, wall(side, false), '#b75881', 1.2, true);
  }
  if (!preview) {
    const lesion = 12.5 * w / 23;
    stroke(ctx, [[(w - lesion) / 2, h * .15], [(w + lesion) / 2, h * .15]], palette.pink, 1.5, true);
    label(ctx, 'Участок сужения', w / 2, h * .12, { align: 'center', color: palette.pink });
  }
  for (let row = 0; row < 5; row++) {
    const center = mid + (row - 2) * half / 2.4;
    const points = series(21, col => [start + col * span / 20, center + (col % 2 ? 1 : -1) * half * .15]);
    stroke(ctx, points, row % 2 ? '#9e69d0' : palette.purple, 2.4);
    if (row === 4) continue;
    for (let col = 0; col <= 20; col += 2) {
      const x = start + col * span / 20;
      stroke(ctx, [[x, center - half * .15], [x, center + half / 2.4 - half * .15]], '#9970ce', 1.3);
    }
  }
  return {
    caption: 'Фиолетовая сетка — стент после раскрытия. Пунктир — сосуд до раскрытия, розовая линия — после.',
    metrics: [metric('Диаметр', number(s.diameter) + ' мм'), metric('Длина', number(length, 2) + ' мм'),
      metric('Укорочение', percent(short)), metric('Учебное давление', number(pressure, 2)),
      metric('Условия проекта', works ? 'Выполнены' : 'Проверьте пределы')],
  };
}
const poreRadii = [1, 1.3, 1.65, 2];
const poreLength = 4;
function implantResult(s) {
  const power = s.exponent / (s.exponent + 1);
  const pressureFactor = (s.pressure / s.consistency) ** (1 / s.exponent);
  const depths = poreRadii.map(r => Math.min(poreLength, r * (s.time * pressureFactor / 8) ** power));
  const fullTime = 8 * (poreLength / poreRadii[0]) ** (1 / power) / pressureFactor;
  const weight = poreRadii.reduce((sum, r) => sum + r ** 2, 0);
  const ratio = depths.reduce((sum, depth, i) => sum + depth / poreLength * poreRadii[i] ** 2, 0) / weight;
  return { depths, fullTime, ratio };
}
function drawImplant(ctx, w, h, s, preview) {
  const { depths, fullTime, ratio } = implantResult(s);
  sceneBg(ctx, w, h, '#ece8fa');
  const x = preview ? w * .12 : Math.min(70, w * .19);
  const length = w - x - w * .12;
  for (let i = 0; i < poreRadii.length; i++) {
    const y = h * (.20 + .20 * i);
    const radius = poreRadii[i];
    const height = Math.min(radius * h * .078, 49);
    const end = depths[i] / poreLength * length;
    fill(ctx, '#cfc4e8', x, y - height / 2, length, height, 5);
    if (end > 0) fill(ctx, palette.purple, x, y - height / 2, end, height, Math.min(5, end / 2));
    if (!preview) {
      label(ctx, 'R ' + number(radius, 2), x - 7, y + 4, { align: 'right', bold: true });
      label(ctx, number(depths[i], 2) + ' / 4', x + length + 5, y + 4, { size: w < 450 ? 10 : 12 });
    }
  }
  return { caption: 'Фиолетовый участок показывает заполненную длину. Общая доля рассчитывается по объёму.',
    metrics: [metric('Заполнено по объёму', percent(ratio)), metric('Время полной пропитки', number(fullTime, 2)),
      metric('Заполненные каналы', depths.filter(depth => depth >= poreLength - 1e-9).length + ' из 4'),
      metric('Условие на давление', s.pressure <= 3 ? 'Выполнено' : 'Превышен предел')] };
}
const imageControls = [
  slider('threshold', 'Порог яркости, %', 10, 90, 1, 50),
  slider('noise', 'Шум, %', 0, 45, 1, 12),
  slider('contrast', 'Контраст, %', 25, 100, 1, 84),
  choice('shape', 'Снимок', [['a', 'Снимок А'], ['b', 'Снимок Б']], 'a'),
  checkbox('reference', 'Показать эталон'),
];
const models = {
  rhythm: {
    title: 'Модель сердечного ритма',
    controls: [slider('period', 'Средний интервал, с', .5, 1.3, .01, .8),
      slider('variation', 'Вариация интервала, с', 0, .32, .01, .14)],
    draw: drawRhythm,
  },
  memory: {
    title: 'Сигнал и ассоциативная память',
    controls: [slider('signal', 'Сила входного сигнала', 0, 10, 1, 5),
      slider('threshold', 'Порог активации', 0, 10, 1, 6),
      slider('corruption', 'Искажено клеток', 0, 16, 1, 7),
      choice('pattern', 'Образ', [['0', 'Кольцо'], ['1', 'Крест'], ['2', 'Диагонали']], '0')],
    draw: drawMemory,
  },
  tumor: {
    title: 'Рост и условный эффект',
    controls: [slider('growth', 'Темп роста', 0, .22, .01, .13),
      slider('effect', 'Условный эффект', 0, .30, .01, .16)],
    draw: drawTumor,
  },
  publicHealth: {
    title: 'Сравнение защитных мер',
    controls: [choice('scenario', 'Нагрузка', [['moderate', 'Умеренная'], ['high', 'Высокая']], 'moderate'),
      slider('capacity', 'Учебный предел нагрузки', 45, 125, 1, 75)],
    draw: drawPublicHealth,
  },
  pulse: {
    title: 'Сигнал и детектор ударов',
    controls: [slider('period', 'Интервал, с', .4, 1.4, .01, .8),
      slider('noise', 'Шум, %', 0, 45, 1, 12),
      slider('threshold', 'Порог детектора', .05, 1.2, .01, .48),
      slider('pause', 'Пауза детектора, с', 0, .55, .01, .06),
      checkbox('reference', 'Показать заданные удары')],
    draw: drawPulse,
  },
  lever: {
    title: 'Рычаг и нагрузка',
    controls: [slider('anchor', 'Крепление тяги, см', 2, 12, .5, 6),
      slider('distance', 'Плечо груза, см', 6, 24, .5, 15),
      slider('load', 'Сила груза, Н', 2, 24, .5, 12),
      slider('angle', 'Угол тяги, °', 25, 90, 1, 90)],
    draw: drawLever,
  },
  imageArea: { title: 'Пороговое выделение области', controls: imageControls, draw: drawImage },
  flow: {
    title: 'Две параллельные ветви',
    controls: [
      choice('mode', 'Что держим постоянным', [['flow', 'Общий расход'], ['pressure', 'Перепад давления']], 'flow'),
      slider('r1', 'Сопротивление ветви 1', 1, 12, .5, 2),
      slider('r2', 'Сопротивление ветви 2', 1, 12, .5, 4),
      { ...slider('total', 'Общий расход, мл/мин', 30, 180, 5, 120), show: s => s.mode === 'flow' },
      { ...slider('pressure', 'Перепад давления, усл. ед.', 20, 240, 5, 160), show: s => s.mode === 'pressure' },
    ],
    draw: drawFlow,
  },
  diffusion: {
    title: 'Распределение красителя',
    controls: [slider('time', 'Время, мин', 1, 60, 1, 15), slider('d', 'Коэффициент D, мм²/мин', .01, .16, .01, .05)],
    draw: drawDiffusion,
  },
  test: {
    title: 'Исходы тестирования',
    controls: [slider('prevalence', 'Доля с состоянием, %', 0, 100, 1, 10),
      slider('sensitivity', 'Чувствительность, %', 0, 100, 1, 90),
      slider('specificity', 'Специфичность, %', 0, 100, 1, 95)],
    draw: drawTest,
  },
  logistic: {
    title: 'Логистическое отображение',
    controls: [slider('r', 'Параметр r', 1.5, 4, .01, 3.65), slider('start', 'Начальное x₀', .01, .98, .001, .2),
      checkbox('compare', 'Показать второй старт x₀ + 0,001')],
    draw: drawLogistic,
  },
  drops: {
    title: 'Интервалы между каплями',
    controls: [choice('pattern', 'Режим учебного ряда', [['steady', 'Почти регулярный'], ['alternate', 'Чередование'],
      ['variable', 'Нерегулярный']], 'alternate')],
    draw: drawDrops,
  },
  rotor: {
    title: 'Волна возбуждения в ткани',
    controls: [checkbox('split', 'Фронт с разрывом', true), slider('step', 'Шаг модели', 0, 62, 1, 31)],
    animation: { key: 'step', duration: 4400 },
    draw: drawRotor,
  },
  vision: {
    title: 'Пороговый метод и нейросеть',
    controls: imageControls.map(control => control.key === 'reference' ? { ...control, initial: true } : control),
    draw: (ctx, w, h, s, preview) => drawImage(ctx, w, h, s, preview, true),
  },
  stent: {
    title: 'Раскрытие стента в сосуде',
    controls: [choice('design', 'Геометрия ячейки', [['a', 'А · гибкая'], ['b', 'Б · сбалансированная'],
      ['c', 'В · жёсткая']], 'b'), slider('diameter', 'Диаметр после раскрытия, мм', 2.2, 4.4, .1, 3.6),
      slider('stiffness', 'Жёсткость стенки', .7, 1.7, .1, 1)],
    animation: { key: 'diameter', duration: 2300, target: s => s.diameter },
    draw: drawStent,
  },
  implant: {
    title: 'Заполнение цилиндрических пор',
    controls: [slider('pressure', 'Давление P, усл. ед.', .5, 4, .1, 2),
      slider('time', 'Время, усл. ед.', 0, 130, .1, 32),
      slider('consistency', 'Консистенция K', .6, 2, .1, 1),
      slider('exponent', 'Показатель течения n', .6, 1.4, .05, 1)],
    animation: { key: 'time', duration: 3600, target: s => Math.ceil(implantResult(s).fullTime * 1.08) },
    draw: drawImplant,
  },
};
