const main = document.querySelector('main');
const byId = new Map(workshops.map(workshop => [workshop.id, workshop]));
const routeFor = id => '#workshop/' + id;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

let view = null;
let stopPainting = () => {};
let currentFilter = 'all';
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
  return '<a class="card" href="' + routeFor(workshop.id) + '" data-card="' + workshop.id + '">' +
    '<div class="card-media"><canvas aria-hidden="true"></canvas><span class="card-label">' +
    escapeHtml(categories[workshop.group]) + '</span></div><div class="card-body"><h3>' +
    escapeHtml(workshop.title) + '</h3><p>' + escapeHtml(workshop.summary) + '</p><div class="card-meta">' +
    '<span>8–11 классы</span><span>' + workshop.duration + ' мин</span><span class="card-action">Открыть</span></div></div></a>';
}
function makeCatalog() {
  const paint = painter();
  stopPainting = () => paint.stop();
  main.innerHTML = `
    <div class="shell">
      <section class="hero" aria-labelledby="home-title">
        <div class="hero-copy">
          <p class="kicker">Интерактивные мастер-классы · 8–11 классы</p>
          <h1 id="home-title">Математика <span>живых систем</span></h1>
          <p>Меняйте параметры моделей и разбирайтесь, как математика помогает исследовать сердце, анализировать снимки и проектировать импланты.</p>
          <div class="hero-actions">
            <a href="#catalog" class="button primary">Выбрать мастер-класс</a>
            <a href="#workshop/medicine" class="button secondary">Начать со знакомства</a>
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
          <p>В каждом занятии есть симулятор, задачи двух уровней и сценарий для ведущего.</p>
        </div><span class="count" role="status"></span></div>
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
  const renderCards = group => {
    currentFilter = group;
    const filtered = workshops.filter(workshop => group === 'all' || workshop.group === group);
    paint.forget(cards.querySelectorAll('canvas'));
    cards.innerHTML = filtered.map(card).join('');
    count.textContent = filtered.length + ' из ' + workshops.length + ' занятий';
    for (const button of filters.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.group === group));
    }
    for (const [index, canvas] of [...cards.querySelectorAll('canvas')].entries()) {
      const workshop = filtered[index];
      const key = workshop.model || workshop.stations[0][0];
      const model = models[key];
      const state = initialState(model);
      paint.observe(canvas, (ctx, width, height) => model.draw(ctx, width, height, state, true));
    }
  };
  for (const [key, labelText] of [['all', 'Все темы'], ...Object.entries(categories)]) {
    const button = document.createElement('button');
    button.className = 'filter';
    button.type = 'button';
    button.dataset.group = key;
    button.textContent = labelText;
    button.addEventListener('click', () => renderCards(key));
    filters.append(button);
  }
  renderCards(currentFilter);
  paint.observe(main.querySelector('.hero-figure canvas'), paintHero);
}
function taskCard(item) {
  return '<article class="task"><span class="level">' + (item.advanced ? '10–11 классы · усложнение' : '8–9 классы · основа') +
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
  stopPainting = () => paint.stop();
  main.innerHTML = `
    <article class="shell lesson" aria-labelledby="lesson-title">
      <a href="#catalog" class="breadcrumb">‹ Все мастер-классы</a>
      <header class="lesson-head">
        <div class="lesson-meta"><span>${escapeHtml(categories[workshop.group])}</span><span>8–11 классы</span><span>${workshop.duration} мин</span></div>
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
            <button type="button" class="button secondary reset">Сбросить параметры</button></div>
        </div>
      </section>
      <section class="tasks" aria-labelledby="task-title">
        <h2 id="task-title">Задания</h2>
        <p>Сформулируйте прогноз перед изменением параметров. После попытки откройте разбор.</p>
        <div class="task-list">${workshop.tasks.map(taskCard).join('')}</div>
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
  let model;
  let state;
  let active;
  let lastReadout = '';
  let visibleControls = [];

  const refreshControls = () => {
    for (const { control, row } of visibleControls) row.hidden = Boolean(control.show && !control.show(state));
  };
  const update = (control, value) => {
    state[control.key] = value;
    refreshControls();
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
    active = key;
    model = models[key];
    if (!states.has(key)) states.set(key, initialState(model));
    state = states.get(key);
    visibleControls = model.controls.map(makeControl);
    controlList.replaceChildren(...visibleControls.map(({ row }) => row));
    refreshControls();
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
  activate(workshop.model || workshop.stations[0][0]);
  paint.observe(canvas, (ctx, width, height) => {
    const output = model.draw(ctx, width, height, state, false);
    if (caption.textContent !== output.caption) caption.textContent = output.caption;
    const markup = output.metrics.map(({ label, value }) => '<div class="readout"><dt>' + escapeHtml(label) +
      '</dt><dd>' + escapeHtml(value) + '</dd></div>').join('');
    if (markup !== lastReadout) {
      readouts.innerHTML = markup;
      lastReadout = markup;
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
      document.title = workshop.title + ' · Матмодель';
    } else if (id) {
      main.innerHTML = '<section class="lesson shell"><h1>Занятие не найдено</h1><p><a class="button primary" href="#catalog">Открыть каталог</a></p></section>';
      document.title = 'Занятие не найдено · Матмодель';
    } else {
      makeCatalog();
      document.title = 'Матмодель · Мастер-классы по биомедицине';
    }
  }
  const target = !id && ['catalog', 'guide'].includes(hash) ? document.getElementById(hash) : null;
  if (target) {
    const cardLink = hash === 'catalog' && restoreFocusTo ? document.querySelector('[data-card="' + restoreFocusTo + '"]') : null;
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
