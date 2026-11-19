const main = document.querySelector('main');
const siteName = document.title;
const allWorkshops = [...workshops, ...advancedWorkshops];
const byId = new Map(allWorkshops.map(workshop => [workshop.id, workshop]));
const ageFor = workshop => workshop.senior ? '10–11 классы' : '8–9 классы';
const routeFor = id => '#workshop/' + id;
const journals = new Map();
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

let view = null;
let stopPainting = () => {};
const filtersByAge = { junior: 'all', senior: 'all' };
let renderAge = () => {};
let restoreFocusTo = null;

function painter() {
  let frame = 0;
  const callbacks = new Map();
  const queue = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      for (const [canvas, render] of callbacks) {
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) continue;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        const pixelWidth = Math.round(width * ratio);
        const pixelHeight = Math.round(height * ratio);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
        }
        const context = canvas.getContext('2d');
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);
        render(context, width, height);
      }
    });
  };
  const observer = new ResizeObserver(queue);
  return {
    observe(canvas, callback) {
      callbacks.set(canvas, callback);
      observer.observe(canvas);
      queue();
    },
    forget(canvases) {
      canvases.forEach(canvas => {
        observer.unobserve(canvas);
        callbacks.delete(canvas);
      });
    },
    queue,
    stop() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      callbacks.clear();
    },
  };
}

function card(workshop) {
  return '<a class="card' + (workshop.senior ? ' senior-card' : '') + '" href="' + routeFor(workshop.id) + '" data-card="' + workshop.id + '">' +
    '<div class="card-media"><canvas aria-hidden="true"></canvas><span class="card-label">' +
    escapeHtml(workshop.format || categories[workshop.group]) + '</span></div><div class="card-body"><h3>' +
    escapeHtml(workshop.title) + '</h3><p>' + escapeHtml(workshop.summary) + '</p><div class="card-meta">' +
    '<span>' + ageFor(workshop) + '</span><span>' + workshop.duration + ' мин</span><span class="card-action">Открыть</span></div></div></a>';
}
function makeCatalog() {
  const paint = painter();
  stopPainting = () => paint.stop();
  main.innerHTML = `
    <div class="shell">
      <section class="hero" aria-labelledby="home-title">
        <div class="hero-copy">
          <p class="kicker">Биомедицина · 8–11 классы</p>
          <h1 id="home-title">Мастер-классы по <span>матмоделированию</span> для школьников</h1>
          <p>Меняйте параметры моделей и разбирайтесь, как математика помогает исследовать сердце, анализировать снимки и проектировать импланты.</p>
          <div class="hero-actions">
            <a href="#catalog" class="button primary">Мастер-классы для 8–9</a>
            <a href="#advanced" class="button secondary">Лаборатории для 10–11</a>
          </div>
        </div>
        <figure class="hero-figure" aria-label="Учебный пульсовой сигнал, 75 ударов в минуту">
          <canvas aria-hidden="true"></canvas>
          <div class="signal-tag" aria-hidden="true">Модель сигнала</div>
          <div class="signal-readout" aria-hidden="true"><strong>75</strong> уд/мин</div>
        </figure>
      </section>
      <section class="catalog" id="catalog" aria-labelledby="catalog-title" tabindex="-1">
        <div class="section-head"><div>
          <h2 id="catalog-title">Выберите мастер-класс</h2>
          <p class="catalog-intro"></p>
        </div><span class="count" role="status"></span></div>
        <nav class="age-tabs" aria-label="Выбрать классы">
          <a href="#catalog" data-age="junior">8–9 классы</a>
          <a href="#advanced" data-age="senior">10–11 классы</a>
        </nav>
        <div class="filters" role="group" aria-label="Фильтр по теме"></div>
        <div class="cards"></div>
      </section>
      <section class="guide" id="guide" aria-labelledby="guide-title" tabindex="-1">
        <h2 id="guide-title">Как провести занятие</h2>
        <p>Откройте мастер-класс, отправьте его ссылку школьникам и раздайте по устройству на пару. Сценарий, разборы и вопрос для обсуждения есть под моделью.</p>
        <div class="guide-grid">
          <div><strong>1. Предскажите</strong><p>Попросите пары записать, что они ожидают увидеть после изменения параметра.</p></div>
          <div><strong>2. Проверьте</strong><p>Один ученик управляет моделью, второй записывает наблюдения. Затем они меняются.</p></div>
          <div><strong>3. Объясните</strong><p>Сравните решения и назовите допущение, от которого зависит вывод.</p></div>
        </div>
      </section>
    </div>`;
  const cards = main.querySelector('.cards');
  const filters = main.querySelector('.filters');
  const count = main.querySelector('.count');
  const intro = main.querySelector('.catalog-intro');
  const title = main.querySelector('#catalog-title');
  const ages = main.querySelectorAll('[data-age]');
  let activeAge;
  const renderCards = (age, group) => {
    filtersByAge[age] = group;
    const pool = age === 'senior' ? advancedWorkshops : workshops;
    const filtered = pool.filter(workshop => group === 'all' || workshop.group === group);
    paint.forget(cards.querySelectorAll('canvas'));
    cards.innerHTML = filtered.map(card).join('');
    count.textContent = filtered.length + ' из ' + pool.length + ' занятий';
    for (const button of filters.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.group === group));
    }
    for (const [index, canvas] of [...cards.querySelectorAll('canvas')].entries()) {
      const workshop = filtered[index];
      const key = workshop.model || workshop.stations[0][0];
      const model = models[key];
      const state = initialState(model);
      paint.observe(canvas, (ctx, width, height) => model.draw(ctx, width, height, state, true, model.camera));
    }
  };
  renderAge = age => {
    if (age === activeAge) return;
    activeAge = age;
    const senior = age === 'senior';
    const pool = senior ? advancedWorkshops : workshops;
    cards.classList.toggle('senior-cards', senior);
    title.textContent = senior ? 'Лаборатории для 10–11 классов' : 'Мастер-классы для 8–9 классов';
    intro.textContent = senior
      ? 'Вращайте 3D-модели, проверяйте формулы расчётом и сравнивайте результаты в журнале опытов.'
      : 'Исследуйте модели, проверяйте гипотезы и решайте задачи по биомедицине.';
    for (const link of ages) {
      if (link.dataset.age === age) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    filters.replaceChildren();
    for (const [key, labelText] of [['all', 'Все темы'], ...Object.entries(categories)]) {
      if (key !== 'all' && !pool.some(workshop => workshop.group === key)) continue;
      const button = document.createElement('button');
      button.className = 'filter';
      button.type = 'button';
      button.dataset.group = key;
      button.textContent = labelText;
      button.addEventListener('click', () => renderCards(age, key));
      filters.append(button);
    }
    renderCards(age, filtersByAge[age]);
  };
  paint.observe(main.querySelector('.hero-figure canvas'), paintHero);
}
function taskCard(item, senior) {
  const level = senior ? (item.advanced ? 'Исследование' : 'Расчёт и проверка') : (item.advanced ? 'Усложнение' : 'Основная задача');
  return '<article class="task"><span class="level">' + level +
    '</span><h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.problem) +
    '</p><details><summary>Подсказка</summary><p>' + escapeHtml(item.hint) +
    '</p></details><details><summary>Разбор</summary><p>' + escapeHtml(item.answer) + '</p></details></article>';
}
function sourceList(sources) {
  if (!sources?.length) return '';
  return '<ul>' + sources.map(([text, url]) =>
    '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(text) + '</a></li>').join('') + '</ul>';
}
function makeLesson(workshop) {
  const paint = painter();
  main.innerHTML = `
    <article class="shell lesson${workshop.senior ? ' senior-lesson' : ''}" aria-labelledby="lesson-title">
      <a href="${workshop.senior ? '#advanced' : '#catalog'}" class="breadcrumb">‹ ${ageFor(workshop)}</a>
      <header class="lesson-head">
        <div class="lesson-meta"><span>${escapeHtml(workshop.format || categories[workshop.group])}</span><span>${ageFor(workshop)}</span><span>${workshop.duration} мин</span></div>
        <h1 id="lesson-title">${escapeHtml(workshop.title)}</h1>
        <p>${escapeHtml(workshop.intro)}</p>
      </header>
      <section class="lab" aria-labelledby="lab-title">
        <div class="lab-head"><h2 id="lab-title">Эксперимент</h2><p>${escapeHtml(workshop.prompt)}</p></div>
        <div class="stations"></div>
        <div class="lab-layout">
          <div class="output">
            <div class="chart">
              <canvas role="img" aria-describedby="chart-caption"></canvas>
              <p class="chart-caption" id="chart-caption"></p>
            </div>
            <dl class="readouts" aria-label="Результаты модели"></dl>
          </div>
          <div class="controls"><h3>Параметры</h3><div class="control-list"></div>
            <button type="button" class="button primary animate" hidden>Запустить анимацию</button>
            <button type="button" class="button secondary camera-turn" hidden>Повернуть на 45°</button>
            <button type="button" class="button secondary reset">Сбросить параметры</button></div>
        </div>
      </section>
      ${workshop.senior ? '<section class="journal" aria-labelledby="journal-title"><div class="journal-head"><div><h2 id="journal-title">Журнал опытов</h2><p>Записывайте параметры и показания, чтобы сравнить до шести опытов.</p></div><div class="journal-actions"><button class="button primary record" type="button">Записать опыт</button><button class="button secondary clear-journal" type="button" hidden>Очистить</button></div></div><ol class="journal-list"></ol><span class="journal-status" role="status"></span></section>' : ''}
      <section class="tasks" aria-labelledby="task-title">
        <h2 id="task-title">Задания</h2>
        <p>Сформулируйте прогноз перед изменением параметров. После попытки откройте разбор.</p>
        <div class="task-list">${workshop.tasks.map(item => taskCard(item, workshop.senior)).join('')}</div>
      </section>
      <div class="lesson-notes">
        <details class="note"><summary>Формула и допущения модели</summary><p>${escapeHtml(workshop.formula)}</p>
          <p>${escapeHtml(workshop.limit)}</p>${sourceList(workshop.sources)}</details>
        <details class="note"><summary>Сценарий для ведущего</summary>
          <ol><li>5 мин — постановка вопроса и прогноз.</li><li>10 мин — первое изменение параметров.</li>
            <li>${workshop.duration - 20} мин — задачи в парах.</li><li>5 мин — сравнение результатов.</li></ol>
          <p>${escapeHtml(workshop.notes)}</p><p><strong>Вопрос для обсуждения</strong></p><p>${escapeHtml(workshop.discussion)}</p>
        </details>
      </div>
      <nav class="next" aria-label="Занятия по теме">${workshop.related.map(id =>
        '<a class="button secondary" href="' + routeFor(id) + '">' + escapeHtml(byId.get(id).title) + '</a>').join('')}</nav>
    </article>`;
  const states = new Map();
  const stations = main.querySelector('.stations');
  const controlList = main.querySelector('.control-list');
  const caption = main.querySelector('.chart-caption');
  const readouts = main.querySelector('.readouts');
  const canvas = main.querySelector('.chart canvas');
  const heading = main.querySelector('#lab-title');
  const reset = main.querySelector('.reset');
  const animate = main.querySelector('.animate');
  const turn = main.querySelector('.camera-turn');
  const record = main.querySelector('.record');
  const journalList = main.querySelector('.journal-list');
  const journalStatus = main.querySelector('.journal-status');
  const clearJournal = main.querySelector('.clear-journal');
  const experiments = journals.get(workshop.id) || [];
  let model;
  let state;
  let active;
  let camera;
  let drag;
  let motion = null;
  let animationFrame = 0;
  let pendingRecord = false;
  let lastReadout = '';
  let visibleControls = [];

  stopPainting = () => {
    cancelAnimationFrame(animationFrame);
    paint.stop();
  };
  const cameraEnabled = () => Boolean(camera && (!model.camera.enabled || model.camera.enabled(state)));
  const refreshCamera = () => {
    const enabled = cameraEnabled();
    turn.hidden = !enabled;
    canvas.closest('.chart').classList.toggle('is-rotatable', enabled);
    if (enabled) {
      canvas.tabIndex = 0;
      canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
    } else {
      canvas.removeAttribute('tabindex');
      canvas.removeAttribute('aria-keyshortcuts');
    }
  };
  const moveCamera = (dx, dy) => {
    camera.yaw = (camera.yaw + dx) % 360;
    camera.pitch = bounds(camera.pitch + dy, -85, 85);
    paint.queue();
  };
  const refreshMotionButton = () => {
    animate.hidden = !model?.animation;
    animate.textContent = motion?.playing ? 'Пауза' : motion ? 'Продолжить' : 'Запустить анимацию';
  };
  const clearMotion = () => {
    cancelAnimationFrame(animationFrame);
    motion = null;
    refreshMotionButton();
  };
  const refreshControls = () => {
    for (const { control, row } of visibleControls) row.hidden = Boolean(control.show && !control.show(state));
  };
  const update = (control, value) => {
    if (motion) clearMotion();
    state[control.key] = value;
    refreshControls();
    refreshCamera();
    paint.queue();
  };
  const makeControl = control => {
    const id = 'param-' + control.key;
    const row = document.createElement('div');
    row.className = 'control';
    const name = document.createElement('label');
    name.textContent = control.label;
    name.htmlFor = id;

    if (control.kind === 'select') {
      const select = document.createElement('select');
      select.id = id;
      for (const [value, title] of control.options) select.append(new Option(title, value));
      select.value = state[control.key];
      select.addEventListener('change', () => update(control, select.value));
      row.append(name, select);
    } else if (control.kind === 'check') {
      name.className = 'toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.checked = state[control.key];
      input.addEventListener('change', () => update(control, input.checked));
      name.prepend(input);
      row.append(name);
    } else {
      const range = document.createElement('input');
      const numeric = document.createElement('input');
      range.id = id;
      range.type = 'range';
      numeric.type = 'number';
      numeric.setAttribute('aria-label', control.label + ' — точное значение');
      numeric.inputMode = 'decimal';
      for (const input of [range, numeric]) {
        input.min = control.min;
        input.max = control.max;
        input.step = control.step;
        input.value = state[control.key];
      }
      range.addEventListener('input', () => {
        numeric.value = range.value;
        update(control, range.valueAsNumber);
      });
      numeric.addEventListener('input', () => {
        const value = numeric.valueAsNumber;
        if (!Number.isFinite(value) || value < control.min || value > control.max) return;
        range.value = String(value);
        update(control, range.valueAsNumber);
      });
      const commitNumber = () => {
        range.value = String(Number.isFinite(numeric.valueAsNumber) ? numeric.valueAsNumber : state[control.key]);
        numeric.value = range.value;
        update(control, range.valueAsNumber);
      };
      numeric.addEventListener('blur', commitNumber);
      numeric.addEventListener('keydown', event => {
        if (event.key === 'Enter') commitNumber();
      });
      row.append(name, numeric, range);
    }
    return { control, row };
  };
  const activate = key => {
    clearMotion();
    active = key;
    model = models[key];
    camera = model.camera ? { yaw: model.camera.yaw, pitch: model.camera.pitch } : null;
    drag = null;
    if (!states.has(key)) states.set(key, initialState(model));
    state = states.get(key);
    visibleControls = model.controls.map(makeControl);
    controlList.replaceChildren(...visibleControls.map(({ row }) => row));
    refreshControls();
    refreshMotionButton();
    refreshCamera();
    heading.textContent = model.title;
    canvas.setAttribute('aria-label', model.title);
    for (const button of stations.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.model === key));
    }
    paint.queue();
  };
  if (workshop.stations) {
    stations.setAttribute('role', 'group');
    stations.setAttribute('aria-label', 'Станции мастер-класса');
    for (const [key, text] of workshop.stations) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter';
      button.dataset.model = key;
      button.textContent = text;
      button.addEventListener('click', () => activate(key));
      stations.append(button);
    }
  }
  reset.addEventListener('click', () => {
    states.delete(active);
    activate(active);
  });
  animate.addEventListener('click', () => {
    if (motion?.playing) {
      cancelAnimationFrame(animationFrame);
      motion.playing = false;
      refreshMotionButton();
      return;
    }
    const config = model.animation;
    const { control, row } = visibleControls.find(item => item.control.key === config.key);
    const range = row.querySelector('input[type=range]');
    const numeric = row.querySelector('input[type=number]');
    if (!motion) {
      const target = bounds(config.target ? config.target(state) : control.max, control.min, control.max);
      if (target <= control.min) return;
      motion = { target, elapsed: 0 };
    }
    motion.playing = true;
    refreshMotionButton();
    const started = performance.now() - motion.elapsed;
    const step = now => {
      motion.elapsed = Math.min(config.duration, now - started);
      const fraction = motion.elapsed / config.duration;
      range.value = String(control.min + (motion.target - control.min) * fraction);
      numeric.value = range.value;
      state[control.key] = range.valueAsNumber;
      paint.queue();
      if (fraction < 1) animationFrame = requestAnimationFrame(step);
      else clearMotion();
    };
    animationFrame = requestAnimationFrame(step);
  });
  turn.addEventListener('click', () => moveCamera(45, 0));
  canvas.addEventListener('pointerdown', event => {
    if (!cameraEnabled() || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', event => {
    if (!cameraEnabled() || drag?.id !== event.pointerId) return;
    moveCamera((event.clientX - drag.x) * .55, (event.clientY - drag.y) * .50);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('keydown', event => {
    if (!cameraEnabled()) return;
    const rotations = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] };
    if (rotations[event.key]) moveCamera(...rotations[event.key]);
    else if (event.key === 'Home') {
      camera.yaw = model.camera.yaw;
      camera.pitch = model.camera.pitch;
      paint.queue();
    } else return;
    event.preventDefault();
  });

  const refreshJournal = () => {
    const cell = ({ label, value }) => '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd></div>';
    journalList.innerHTML = experiments.map((entry, index) =>
      '<li><h3>Опыт ' + (index + 1) + '</h3><dl class="journal-params">' + entry.parameters.map(cell).join('') +
      '</dl><dl class="journal-metrics">' + entry.results.map(cell).join('') + '</dl></li>').join('');
    record.disabled = experiments.length >= 6;
    clearJournal.hidden = !experiments.length;
  };
  if (record) {
    journals.set(workshop.id, experiments);
    refreshJournal();
    record.addEventListener('click', () => {
      pendingRecord = true;
      paint.queue();
    });
    clearJournal.addEventListener('click', () => {
      experiments.length = 0;
      pendingRecord = false;
      refreshJournal();
      journalStatus.textContent = 'Журнал очищен.';
      record.focus();
    });
  }
  activate(workshop.model || workshop.stations[0][0]);
  paint.observe(canvas, (ctx, width, height) => {
    const output = model.draw(ctx, width, height, state, false, camera);
    if (caption.textContent !== output.caption) caption.textContent = output.caption;
    const markup = output.metrics.map(({ label, value }) => '<div class="readout"><dt>' + escapeHtml(label) +
      '</dt><dd>' + escapeHtml(value) + '</dd></div>').join('');
    if (markup !== lastReadout) {
      readouts.innerHTML = markup;
      lastReadout = markup;
    }
    if (pendingRecord && experiments.length < 6) {
      pendingRecord = false;
      const parameters = model.controls.filter(control => !control.displayOnly && (!control.show || control.show(state)))
        .map(control => {
          const value = state[control.key];
          const display = control.kind === 'select' ? control.options.find(([key]) => key === value)[1]
            : typeof value === 'number' ? number(value, 4) : value ? 'Да' : 'Нет';
          return metric(control.label, display);
        });
      experiments.push({ parameters, results: output.metrics });
      refreshJournal();
      journalStatus.textContent = 'Записан опыт ' + experiments.length + ' из 6.';
    }
  });
}

function route(first = false) {
  const hash = location.hash.slice(1);
  const id = hash.startsWith('workshop/') ? hash.slice('workshop/'.length) : '';
  const workshop = byId.get(id);
  const nextView = workshop ? id : id ? 'missing' : 'home';
  if (view !== nextView) {
    if (view && byId.has(view)) restoreFocusTo = view;
    stopPainting();
    view = nextView;
    if (workshop) {
      makeLesson(workshop);
      document.title = workshop.title + ' · ' + siteName;
    } else if (id) {
      main.innerHTML = '<section class="lesson shell"><h1>Занятие не найдено</h1><p><a class="button primary" href="#catalog">Открыть каталог</a></p></section>';
      document.title = 'Занятие не найдено · ' + siteName;
    } else {
      makeCatalog();
      document.title = siteName;
    }
  }
  if (nextView === 'home') renderAge(hash === 'advanced' ? 'senior' : 'junior');
  const targetId = hash === 'advanced' ? 'catalog' : hash;
  const target = !id && ['catalog', 'guide'].includes(targetId) ? document.getElementById(targetId) : null;
  if (target) {
    const cardLink = targetId === 'catalog' && restoreFocusTo ? document.querySelector('[data-card="' + restoreFocusTo + '"]') : null;
    restoreFocusTo = null;
    (cardLink || target).focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  } else {
    window.scrollTo(0, 0);
    if (!first) main.focus({ preventScroll: true });
  }
}
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', () => route());
route(true);
