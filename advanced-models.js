const dark = {
  bg: '#171329', grid: '#392f50', faint: '#5d5075', text: '#dfd5f4',
  purple: '#bc98ff', mint: '#70e5d2', gold: '#ffd18b', pink: '#fa9abf',
};
const degrees = angle => angle * Math.PI / 180;

function darkScene(ctx, w, h) {
  const gradient = ctx.createRadialGradient(w * .50, h * .46, 5, w * .53, h * .50, Math.max(w, h) * .66);
  gradient.addColorStop(0, '#2d2049');
  gradient.addColorStop(1, '#130f24');
  fill(ctx, gradient, 0, 0, w, h);
  for (let x = 16; x < w; x += 24) {
    for (let y = 15; y < h; y += 24) circle(ctx, x, y, .9, '#b89be62f');
  }
}

function projector(w, h, camera, extent, fit = 1) {
  const yaw = degrees(camera.yaw);
  const pitch = degrees(camera.pitch);
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const scale = Math.min(w, h) * fit / extent;
  const focalDistance = 2.4 * extent;
  return ([x, y, z]) => {
    const a = x * cy - z * sy;
    const b = x * sy + z * cy;
    const up = y * cp - b * sp;
    const depth = y * sp + b * cp;
    const perspective = focalDistance / (focalDistance - depth);
    return { x: w / 2 + a * scale * perspective, y: h / 2 - up * scale * perspective, depth };
  };
}

function segment(ctx, a, b, color, width, dashed = false) {
  stroke(ctx, [[a.x, a.y], [b.x, b.y]], color, width, dashed);
}

function polygon(ctx, points, color) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function cameraCaption(ctx, w, h, left, right, preview) {
  if (preview) return;
  label(ctx, left, 15, 23, { bold: true, color: dark.text });
  label(ctx, right, w - 15, h - 12, { align: 'right', color: dark.text });
}

function stentGeometry({ diameter, cells, strut, rings }) {
  const sine = Math.sin(Math.PI / (2 * cells));
  const maximum = strut / sine;
  const chord = diameter * sine;
  const canExpand = diameter <= maximum + 1e-9;
  const height = canExpand ? Math.sqrt(Math.max(0, strut ** 2 - chord ** 2)) : null;
  const length = canExpand ? rings * height + (rings - 1) * .45 : null;
  return { maximum, chord, height, length, canExpand };
}

function drawStent3d(ctx, w, h, s, preview, camera) {
  const shape = stentGeometry(s);
  const displayLength = shape.length ?? (s.rings - 1) * .45;
  const height = shape.height ?? 0;
  const r = Math.min(s.diameter, shape.maximum) / 2;
  const projection = projector(w, h, camera, Math.max(11, displayLength + 1), .87);
  darkScene(ctx, w, h);
  const layers = [];
  const around = (angle, z, radius = r) => [radius * Math.cos(angle), radius * Math.sin(angle), z];
  const addLine = (a, b, type) => {
    const points = [projection(a), projection(b)];
    layers.push({ points, depth: (points[0].depth + points[1].depth) / 2, type });
  };
  for (const end of [-4, 4]) {
    const ring = series(41, i => around(i / 40 * 2 * Math.PI, end, r + .30));
    ring.slice(1).forEach((point, i) => addLine(ring[i], point, 'target'));
  }
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * 2 * Math.PI;
    addLine(around(angle, -4, r + .30), around(angle, 4, r + .30), 'target');
  }
  let previous;
  for (let ring = 0; ring < s.rings; ring++) {
    const points = series(s.cells * 2, i =>
      around(i / s.cells * Math.PI, -displayLength / 2 + ring * (height + .45) + (i % 2) * height));
    for (const [i, point] of points.entries()) {
      addLine(point, points[(i + 1) % points.length], 'wire');
      if (previous && i % 4 === 0) addLine(previous[(i + 1) % points.length], point, 'bridge');
    }
    previous = points;
  }
  layers.sort((a, b) => a.depth - b.depth).forEach(({ points: [a, b], depth, type }) => {
    const color = type === 'target' ? '#70e5d25d' : type === 'bridge' ? '#ac8af3ad'
      : depth < 0 ? '#9c75e994' : shape.canExpand ? '#e8ccff' : dark.pink;
    segment(ctx, a, b, color, type === 'wire' ? 1.9 : 1.15, type === 'target');
  });
  cameraCaption(ctx, w, h, 'Пространственный каркас', 'Пунктир · зона 8 мм', preview);
  return {
    caption: shape.canExpand
      ? 'Вращайте модель за изображение или стрелками. Голубой пунктир показывает участок, который должен перекрыть каркас.'
      : 'Показано предельное раскрытие. Запрошенный диаметр потребовал бы растянуть жёсткие звенья.',
    metrics: [metric('Хорда', number(shape.chord, 3) + ' мм'), metric('Высота кольца', shape.canExpand ? number(height, 3) + ' мм' : '—'),
      metric('Длина каркаса', shape.canExpand ? number(shape.length, 2) + ' мм' : '—'),
      metric('Предел диаметра', number(shape.maximum, 2) + ' мм'),
      metric('Условия стенда', !shape.canExpand ? 'Диаметр вне предела' : shape.length >= 8 ? 'Перекрывает 8 мм' : 'Каркас короток')],
  };
}

const voxelSpacing = .65;
const voxelX = 32;
const voxelY = 30;
const ellipsoid = [5.3, 4, 4.2];
const analyticVolume = 4 / 3 * Math.PI * ellipsoid.reduce((value, axis) => value * axis, 1);
const faceShapes = [
  { shift: [-1, 0, 0], color: '#7452b1', corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { shift: [1, 0, 0], color: '#ac89ec', corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { shift: [0, -1, 0], color: '#5c3f94', corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { shift: [0, 1, 0], color: '#c6acf9', corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { shift: [0, 0, -1], color: '#8362be', corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  { shift: [0, 0, 1], color: '#b69af1', corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
];

function voxelVolume({ thickness, noise, threshold }) {
  const layers = Math.floor(20 / thickness);
  const zStart = -layers * thickness / 2;
  const count = voxelX * voxelY * layers;
  const values = new Float32Array(count);
  const truth = new Uint8Array(count);
  const mask = new Uint8Array(count);
  const index = (x, y, z) => (z * voxelY + y) * voxelX + x;
  const position = (x, y, z) => [(x - voxelX / 2) * voxelSpacing, (y - voxelY / 2) * voxelSpacing, zStart + z * thickness];
  let accepted = 0, trueCount = 0, overlap = 0;
  for (let z = 0; z < layers; z++) {
    for (let y = 0; y < voxelY; y++) {
      for (let x = 0; x < voxelX; x++) {
        const i = index(x, y, z);
        const [cx, cy, cz] = position(x + .5, y + .5, z + .5);
        const d = Math.hypot((cx + .35) / ellipsoid[0], (cy - .3) / ellipsoid[1], (cz + .18) / ellipsoid[2]);
        const soft = 1 / (1 + Math.exp((d - 1) / .085));
        const texture = .032 * Math.sin(cx * .56 + cz * .35) + .025 * Math.cos(cy * .82);
        const nearby = .19 * Math.exp(-((cx - 6.3) ** 2 / 7 + (cy + 2.4) ** 2 / 5 + (cz - 1) ** 2 / 8));
        const jitter = noiseAt(x * 173 + y * 53 + Math.round(cz * 100) * 13, 83);
        values[i] = bounds(.22 + .62 * soft + nearby + texture + noise / 100 * jitter, 0, 1);
        truth[i] = Number(d <= 1);
        mask[i] = Number(values[i] >= threshold / 100);
        accepted += mask[i];
        trueCount += truth[i];
        overlap += mask[i] * truth[i];
      }
    }
  }
  return {
    values, truth, mask, layers, index, position, accepted, trueCount, overlap,
    voxelMeasure: voxelSpacing ** 2 * thickness, dice: 2 * overlap / (accepted + trueCount),
  };
}

function volumeSurface(volume) {
  const { layers, index, position, mask } = volume;
  const faces = [];
  const inside = (x, y, z) => x >= 0 && x < voxelX && y >= 0 && y < voxelY && z >= 0 && z < layers;
  for (let z = 0; z < layers; z++) {
    for (let y = 0; y < voxelY; y++) {
      for (let x = 0; x < voxelX; x++) {
        if (!mask[index(x, y, z)]) continue;
        for (const { shift: [dx, dy, dz], corners, color } of faceShapes) {
          if (inside(x + dx, y + dy, z + dz) && mask[index(x + dx, y + dy, z + dz)]) continue;
          faces.push({ color, corners: corners.map(([a, b, c]) => position(x + a, y + b, z + c)) });
        }
      }
    }
  }
  return faces;
}

let cachedVolume;
function drawVolume3d(ctx, w, h, s, preview, camera) {
  const key = [s.thickness, s.noise, s.threshold].join('/');
  if (cachedVolume?.key !== key) cachedVolume = { key, result: voxelVolume(s), faces: null };
  const { result } = cachedVolume;
  const z = bounds(Math.floor((s.slice + result.layers * s.thickness / 2) / s.thickness), 0, result.layers - 1);
  darkScene(ctx, w, h);
  if (s.view === 'volume' || preview) {
    cachedVolume.faces ??= volumeSurface(result);
    const project = projector(w, h, camera, 24, 1.14);
    const scaleX = voxelX * voxelSpacing / 2, scaleY = voxelY * voxelSpacing / 2;
    const zPlane = result.position(0, 0, z + .5)[2];
    const plane = [[-scaleX, -scaleY, zPlane], [scaleX, -scaleY, zPlane], [scaleX, scaleY, zPlane], [-scaleX, scaleY, zPlane]].map(project);
    const faces = [];
    for (const { corners, color } of cachedVolume.faces) {
      const coords = corners.map(project);
      const [a, b, c, d] = coords;
      // With the y-axis turned upwards in world space, front faces wind clockwise on the screen.
      if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) >= 0) continue;
      faces.push({ coords, color, depth: (a.depth + b.depth + c.depth + d.depth) / 4 });
    }
    faces.sort((a, b) => a.depth - b.depth).forEach(({ coords, color }) => polygon(ctx, coords, color));
    if (!preview) {
      for (const [i, point] of plane.entries()) segment(ctx, point, plane[(i + 1) % plane.length], '#76dfd2b2', 1.3, true);
      cameraCaption(ctx, w, h, 'Воксельная поверхность', 'Пунктир · выбранный срез', preview);
    }
  } else {
    const size = Math.min((w - 36) / voxelX, (h - 51) / voxelY);
    const x0 = (w - voxelX * size) / 2;
    const y0 = (h - voxelY * size) / 2;
    for (let y = 0; y < voxelY; y++) {
      for (let x = 0; x < voxelX; x++) {
        const i = result.index(x, y, z);
        const brightness = Math.round(result.values[i] * 185 + 30);
        const shade = result.mask[i] && !result.truth[i] ? '#ffb479'
          : result.truth[i] && !result.mask[i] ? '#60d9c2'
          : result.mask[i] ? '#b28ee8' : 'rgb(' + brightness + ',' + brightness + ',' + (brightness + 14) + ')';
        fill(ctx, shade, x0 + x * size, y0 + (voxelY - 1 - y) * size, size + .13, size + .13);
      }
    }
    cameraCaption(ctx, w, h, 'Поперечный срез', 'Слой ' + (z + 1) + '/' + result.layers, preview);
  }
  const measured = result.accepted * result.voxelMeasure;
  const reference = result.trueCount * result.voxelMeasure;
  const millimeters = v => number(v, 1) + ' мм³';
  return {
    caption: s.view === 'volume' ? 'Поверните маску за изображение или стрелками. В режиме среза можно увидеть ошибки выделения.'
      : 'Фиолетовый — совпадения с эталоном. Оранжевый — лишняя область. Зелёный — пропуски.',
    metrics: [metric('Выделено вокселей', number(result.accepted, 0)),
      metric('Объём маски', millimeters(measured)), metric('Объём эталонной маски', millimeters(reference)),
      metric('Аналитический объём', millimeters(analyticVolume)), metric('Ошибка объёма', millimeters(Math.abs(measured - analyticVolume))),
      metric('Dice', percent(result.dice))],
  };
}

function solvePorousNetwork({ radius, inlet, cross, bypass }) {
  const nx = 5, ny = 3, nz = 3;
  const nodes = [];
  const index = (x, y, z) => x * ny * nz + y * nz + z;
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) nodes.push({ xyz: [x, y, z], neighbors: [], pressure: inlet * (1 - x / (nx - 1)) });
    }
  }
  const pipes = [];
  const connect = (a, b, r, length = 1, shortcut = false) => {
    const conductance = r ** 4 / length;
    nodes[a].neighbors.push([b, conductance]);
    nodes[b].neighbors.push([a, conductance]);
    pipes.push({ a, b, conductance, shortcut });
  };
  for (const [i, { xyz: [x, y, z] }] of nodes.entries()) {
    if (x < nx - 1) connect(i, index(x + 1, y, z), x === 2 ? radius : 1);
    if (cross && y < ny - 1) connect(i, index(x, y + 1, z), .78);
    if (cross && z < nz - 1) connect(i, index(x, y, z + 1), .78);
  }
  if (bypass) connect(index(2, 0, 0), index(4, 2, 2), 1.05, Math.sqrt(12), true);

  const internal = nodes.filter(({ xyz: [x] }) => x > 0 && x < nx - 1);
  let iterations = 0;
  for (; iterations < 1600; iterations++) {
    let change = 0;
    for (const node of internal) {
      let sum = 0, weight = 0;
      for (const [i, g] of node.neighbors) {
        sum += nodes[i].pressure * g;
        weight += g;
      }
      const next = sum / weight;
      change = Math.max(change, Math.abs(next - node.pressure));
      node.pressure = next;
    }
    if (change < 1e-10) break;
  }
  let inflow = 0;
  const outflows = Array(9).fill(0);
  for (const pipe of pipes) {
    const from = nodes[pipe.a], to = nodes[pipe.b];
    pipe.flow = pipe.conductance * (from.pressure - to.pressure);
    if (from.xyz[0] === 0 && to.xyz[0] > 0) inflow += pipe.flow;
    if (from.xyz[0] < nx - 1 && to.xyz[0] === nx - 1) outflows[pipe.b % 9] += pipe.flow;
  }
  const total = outflows.reduce((a, b) => a + b, 0);
  const average = total / outflows.length;
  const variation = Math.sqrt(outflows.reduce((sum, flow) => sum + (flow - average) ** 2, 0) / outflows.length) / average;
  return { nodes, pipes, total, variation, balance: Math.abs(inflow - total), outflows, iterations: iterations + 1 };
}

let cachedNetwork;
function drawPorous3d(ctx, w, h, s, preview, camera) {
  const key = [s.radius, s.inlet, s.cross, s.bypass].join('/');
  if (cachedNetwork?.key !== key) cachedNetwork = { key, result: solvePorousNetwork(s) };
  const { nodes, pipes, total, variation, balance, outflows, iterations } = cachedNetwork.result;
  const project = projector(w, h, camera, 7.5, 1.03);
  const points = nodes.map(({ xyz: [x, y, z] }) => project([(y - 1) * 1.42, (z - 1) * 1.42, (x - 2) * 1.28]));
  const maxFlow = Math.max(...pipes.map(pipe => Math.abs(pipe.flow)));
  darkScene(ctx, w, h);
  const geometry = pipes.map(pipe => ({ depth: (points[pipe.a].depth + points[pipe.b].depth) / 2, pipe }));
  points.forEach((point, index) => geometry.push({ depth: point.depth, index }));
  geometry.sort((a, b) => a.depth - b.depth).forEach(({ pipe, index, depth }) => {
    if (pipe) {
      const width = .85 + 4 * Math.sqrt(Math.abs(pipe.flow) / maxFlow);
      const color = pipe.shortcut ? dark.gold : Math.abs(pipe.flow) < 1e-6 ? '#78589d75'
        : depth < 0 ? '#b691ee93' : dark.purple;
      segment(ctx, points[pipe.a], points[pipe.b], color, width);
      return;
    }
    const pressure = nodes[index].pressure / s.inlet;
    const color = 'rgb(' + Math.round(102 + 120 * pressure) + ',' + Math.round(209 - 66 * pressure) + ',226)';
    circle(ctx, points[index].x, points[index].y, 2.7, color);
  });
  cameraCaption(ctx, w, h, '45 узлов · ' + pipes.length + ' каналов', 'Сиреневый · высокое давление', preview);
  return {
    caption: 'Вращайте модель за изображение или стрелками. Жёлтая линия показывает обход, когда он включён.',
    metrics: [metric('Общий расход', number(total, 2)),
      metric('Разброс по выходам', percent(variation)), metric('Самый нагруженный выход', number(Math.max(...outflows), 2)),
      metric('Ошибка баланса', balance < 1e-7 ? '< 0,0000001' : number(balance, 8)), metric('Итераций решения', iterations)],
  };
}

function logisticExperiment(r, start, samples) {
  let x = start, exponentSum = 0;
  const points = [];
  for (let step = 0; step < 1200 + samples; step++) {
    x = r * x * (1 - x);
    if (step < 1200) continue;
    points.push(x);
    exponentSum += Math.log(Math.max(1e-12, Math.abs(r * (1 - 2 * x))));
  }
  const tail = points.slice(-64);
  let period = null;
  for (let p = 1; p <= 16; p++) {
    if (tail.slice(p).every((value, i) => Math.abs(value - tail[i]) < 1e-7)) {
      period = p;
      break;
    }
  }
  return { points, period, exponent: exponentSum / samples };
}
const diagramMin = 2.75;
const diagramMax = 4;
let diagram;
function bifurcationDiagram() {
  diagram ??= series(414, i => {
    const r = diagramMin + (diagramMax - diagramMin) * i / 413;
    return logisticExperiment(r, .23717, 64).points;
  });
  return diagram;
}
function drawBifurcation(ctx, w, h, s, preview) {
  darkScene(ctx, w, h);
  const result = logisticExperiment(s.r, s.start, s.samples);
  const second = s.compare ? logisticExperiment(s.r, s.start + .0001, s.samples) : null;
  const split = !preview && w > 520;
  const firstW = split ? w * .63 : w;
  const left = 32, top = preview ? 13 : 36, bottom = h - 34;
  const right = firstW - 15;
  const xAt = f => left + f * (right - left);
  const yAt = value => bottom - value * (bottom - top);
  for (let i = 0; i <= 4; i++) {
    const y = yAt(i / 4);
    stroke(ctx, [[left, y], [right, y]], dark.grid, 1);
    if (!preview) label(ctx, number(i / 4, 2), left - 6, y + 4, { color: dark.text, align: 'right', size: 11 });
  }
  const all = bifurcationDiagram();
  ctx.fillStyle = '#c4a1ef6b';
  all.forEach((points, i) => {
    const x = xAt(i / (all.length - 1));
    for (const v of points) ctx.fillRect(x, yAt(v), .8, 1);
  });
  const mark = xAt((s.r - diagramMin) / (diagramMax - diagramMin));
  stroke(ctx, [[mark, top], [mark, bottom]], dark.mint, 1.5);
  if (!preview) {
    label(ctx, 'Диаграмма бифуркаций', left, 22, { color: dark.text, bold: true });
    for (let i = 0; i <= 5; i++) {
      label(ctx, number(diagramMin + i * .25, 2), xAt(i / 5), bottom + 18,
        { color: dark.text, align: 'center', size: 10 });
    }
  }
  const tail = result.points.slice(-20);
  if (split) {
    const chartMin = firstW + 14, chartMax = w - 16;
    const position = (value, i) => [chartMin + (chartMax - chartMin) * i / (tail.length - 1), yAt(value)];
    for (let i = 0; i <= 4; i++) {
      stroke(ctx, [[chartMin, yAt(i / 4)], [chartMax, yAt(i / 4)]], dark.grid, 1);
    }
    if (second) stroke(ctx, second.points.slice(-20).map(position), dark.gold, 1.3, true);
    const trace = tail.map(position);
    stroke(ctx, trace, dark.mint, 1.6);
    trace.forEach(([x, y]) => circle(ctx, x, y, 2, dark.mint));
    label(ctx, 'Последние 20 шагов', chartMin, 22, { color: dark.text, bold: true });
  } else if (!preview) {
    const shotW = Math.min(106, w * .30);
    const lastX = w - shotW - 19;
    fill(ctx, '#292141', lastX - 5, top + 5, shotW + 12, 53, 6);
    const p = (value, i) => [lastX + shotW * i / (tail.length - 1), top + 49 - value * 35];
    if (second) stroke(ctx, second.points.slice(-20).map(p), dark.gold, 1.2, true);
    stroke(ctx, tail.map(p), dark.mint, 1.4);
  }
  return {
    caption: 'Зелёная линия на карте отмечает r. Зелёный ряд — основной старт, золотой пунктир — соседний старт.',
    metrics: [metric('Показатель Ляпунова λ', number(result.exponent, 5)),
      metric('Обнаруженный период', result.period ?? 'Не найден до 16'),
      metric('Длина наблюдения', s.samples),
      ...(second ? [metric('Расхождение на последнем шаге', number(Math.abs(result.points.at(-1) - second.points.at(-1)), 6))] : [])],
  };
}

Object.assign(models, {
  stent3d: {
    title: 'Геометрический стенд',
    camera: { yaw: -51, pitch: -23 },
    controls: [slider('diameter', 'Диаметр D, мм', 2.5, 7, .1, 4.8),
      slider('strut', 'Длина звена ℓ, мм', 1, 2.4, .05, 1.55),
      slider('cells', 'Ячеек в одном кольце', 4, 12, 1, 7),
      slider('rings', 'Число колец', 3, 8, 1, 6)],
    draw: drawStent3d,
  },
  volume3d: {
    title: 'Реконструкция воксельной маски',
    camera: { yaw: -31, pitch: -32, enabled: s => s.view === 'volume' },
    controls: [
      { ...choice('view', 'Представление', [['volume', '3D-маска'], ['slice', 'Поперечный срез']], 'volume'), displayOnly: true },
      { ...slider('slice', 'Положение среза, мм', -8, 8, .5, 0), displayOnly: true },
      slider('thickness', 'Толщина среза, мм', .5, 2.5, .25, 1),
      slider('threshold', 'Порог яркости, %', 35, 80, 1, 55),
      slider('noise', 'Амплитуда шума, %', 0, 25, 1, 12)],
    draw: drawVolume3d,
  },
  porous3d: {
    title: 'Трёхмерная сеть каналов',
    camera: { yaw: -48, pitch: -22 },
    controls: [slider('radius', 'Радиус узкого слоя', .35, 1, .05, .70),
      slider('inlet', 'Входное давление', 20, 160, 5, 100),
      checkbox('cross', 'Поперечные связи', true),
      checkbox('bypass', 'Добавить обходной канал')],
    draw: drawPorous3d,
  },
  bifurcation: {
    title: 'Карта режимов и численная оценка λ',
    controls: [slider('r', 'Параметр r', 2.75, 4, .001, 3.83),
      slider('start', 'Начальное x₀', .01, .98, .001, .2),
      choice('samples', 'Шагов наблюдения', [['64', '64'], ['256', '256'], ['1024', '1 024']], '256'),
      checkbox('compare', 'Сравнить два близких старта')],
    draw: (ctx, w, h, s, preview) => drawBifurcation(ctx, w, h, { ...s, samples: Number(s.samples) }, preview),
  },
});
