class Element {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, on) => {
        if (on) classes.add(name);
        else classes.delete(name);
      },
    };
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.listeners = {};
    this.width = 0;
    this.height = 0;
    this.scrollHeight = 0;
    this.clientWidth = 0;
    this.clientHeight = 0;
    this.parentElement = null;
  }

  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  fire(type, extra = {}) {
    for (const fn of this.listeners[type] ?? []) fn({ target: this, preventDefault() {}, ...extra });
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = nodes;
  }

  click() {
    this.fire('click');
  }

  focus() {}

  closest(selector) {
    if (this.tagName === 'TEXTAREA' && selector === 'textarea') return this;
    if (selector === '.cell') return { dataset: { id: 'unknown' } };
    return null;
  }

  getContext() {
    return {
      putImageData() {},
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    };
  }
}

const elements = new Map();
const byId = (id) => {
  if (!elements.has(id)) elements.set(id, new Element('div'));
  return elements.get(id);
};
const appEl = new Element('main');
appEl.classList.add('app');

globalThis.document = {
  getElementById: byId,
  createElement: (tag) => new Element(tag),
  querySelector: (selector) => (selector === '.app' ? appEl : null),
};
globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
};
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.getComputedStyle = () => ({
  paddingLeft: '0px',
  paddingRight: '0px',
  paddingTop: '0px',
  paddingBottom: '0px',
});

// a 600x300 viewport for the output canvas, so the fit-to-pane maths is exercised
const outputWrap = new Element('div');
outputWrap.clientWidth = 600;
outputWrap.clientHeight = 300;
byId('output').parentElement = outputWrap;

let failed = 0;
function check(label, condition, detail = '') {
  if (condition) return;
  failed++;
  console.log(`FAIL ${label}${detail ? `\n  ${detail}` : ''}`);
}

const handlers = (id, type) => (byId(id).listeners[type] ?? []).length;

try {
  await import('../src/main.js');
  check('main.js loads', true);
} catch (error) {
  check('main.js loads', false, error.stack ?? String(error));
}

for (const [id, type] of [
  ['add', 'click'],
  ['export', 'click'],
  ['import', 'click'],
  ['reset', 'click'],
  ['input', 'change'],
  ['example', 'change'],
  ['import-file', 'change'],
  ['upload-file', 'change'],
]) {
  check(`#${id} handles ${type}`, handlers(id, type) === 1, `got ${handlers(id, type)}`);
}
check('the app handles drops', (appEl.listeners.drop ?? []).length === 1);

const inputSource = byId('input');
const inputValues = inputSource.children.map((option) => option.value);
check(
  'the input picker offers the default first',
  inputValues[0] === 'default',
  inputValues.join(','),
);
check(
  'the input picker offers a custom image entry last',
  inputValues[inputValues.length - 1] === 'custom',
  inputValues.join(','),
);

const select = byId('example');

function safely(label, fn) {
  try {
    fn();
  } catch (error) {
    check(label, false, error.stack ?? String(error));
  }
}

safely('clicking Add cell works', () => byId('add').click());
safely('clicking Reset works', () => byId('reset').click());

const output = byId('output');
check(
  'the output canvas is scaled to fit its pane',
  output.style.width === '300px' && output.style.height === '300px',
  `got ${output.style.width} x ${output.style.height}, expected 300px x 300px`,
);

const cellTextarea = byId('cells').children[0].children[1];
cellTextarea.scrollHeight = 140;
byId('cells').fire('input', { target: cellTextarea });
check(
  'long cells grow instead of scrolling',
  cellTextarea.style.height === '140px',
  `got ${cellTextarea.style.height}`,
);

const log = byId('log');
log.textContent = 'no cell produces an image';
byId('add').click();
check(
  'a stale "no image" notice clears once an image renders',
  log.textContent === '',
  `got ${JSON.stringify(log.textContent)}`,
);

for (const option of select.children) {
  safely(`loading the '${option.value}' example works`, () => {
    select.value = option.value;
    select.fire('change');
  });
  check(`'${option.value}' renders cells`, byId('cells').children.length > 0);
}

console.log(`${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
