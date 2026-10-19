const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
const bundle = readFileSync(require.resolve('../wwwroot/js/cinema-search.bundle.js'), 'utf8');
const tick = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));

async function setup(width = 1120, animated = false) {
  const dom = new JSDOM(`<!doctype html><body>
    <header><nav data-cinema-nav><div data-nav-top><button data-nav-search>Search</button><button data-nav-toggle aria-expanded="false">Menu</button></div></nav></header>
    <main><section data-cinema-promos><div data-promo-swiper></div>
      <article class="promo-slide"><h3>Midweek magic</h3><p data-promo-offer>Buy one get one free</p>Wednesday cinema</article>
      <article class="promo-slide"><h3>Student escape</h3><p data-promo-offer>Save 20%</p>Student perks</article>
    </section></main><div id="cinema-search-root"></div></body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window, d = w.document;
  w.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion') ? !animated : query.includes('(hover: hover)'), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () { this.scrolled = true; };
  w.HTMLElement.prototype.getClientRects = function () { return [{}]; };
  w.HTMLElement.prototype.getBoundingClientRect = function () { return { top: 24, left: 12, width: parseFloat(this.style.width) || 0, height: 64, right: width + 12, bottom: 88 }; };
  d.querySelector('[data-cinema-nav]').getBoundingClientRect = () => ({ top: 24, left: 12, width, height: 78 });
  const slideCalls = [];
  d.querySelector('[data-promo-swiper]').swiper = { slideTo: (...args) => slideCalls.push(args) };
  if (animated) w.eval(readFileSync(require.resolve('../wwwroot/lib/gsap/gsap.min.js'), 'utf8'));
  w.eval(bundle);
  await tick();
  const trigger = d.querySelector('[data-nav-search]');
  trigger.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: animated ? 1 : 0 }));
  await tick();
  const input = () => d.querySelector('input');
  const type = async value => {
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input(), value);
    input().dispatchEvent(new w.Event('input', { bubbles: true }));
    await tick();
  };
  return { dom, w, d, trigger, input, type, slideCalls };
}

test('copied Spotlight opens empty, focuses input, and X or Escape restores navbar and focus', async () => {
  const ui = await setup();
  try {
    assert.ok(ui.d.querySelector('[role="dialog"]'));
    assert.equal(ui.d.activeElement, ui.input());
    assert.equal(ui.d.querySelector('[data-cinema-nav]').inert, true);
    assert.equal(ui.d.querySelector('#cinema-search-results'), null);
    ui.d.querySelector('[aria-label="Close search"]').click(); await tick();
    assert.equal(ui.d.querySelector('[role="dialog"]'), null);
    assert.equal(ui.d.querySelector('[data-cinema-nav]').inert, false);
    assert.equal(ui.d.activeElement, ui.trigger);
    ui.trigger.click(); await tick();
    ui.d.dispatchEvent(new ui.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
    assert.equal(ui.d.querySelector('[role="dialog"]'), null);
    assert.equal(ui.d.activeElement, ui.trigger);
  } finally { ui.dom.window.close(); }
});

test('cinema data, result links, arrow navigation and selection work with the copied component', async () => {
  const ui = await setup();
  try {
    await ui.type('student');
    const rows = ui.d.querySelectorAll('#cinema-search-results a');
    assert.equal(rows.length, 1);
    assert.match(rows[0].textContent, /Student escape/);
    ui.input().dispatchEvent(new ui.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    assert.equal(ui.d.activeElement, rows[0]);
    rows[0].click(); await tick();
    assert.deepEqual(ui.slideCalls, [[1, 0]]);
    assert.equal(ui.d.querySelector('[data-cinema-promos]').scrolled, true);
    assert.equal(ui.d.querySelector('[role="dialog"]'), null);
    assert.equal(ui.d.querySelector('main').inert, undefined);
  } finally { ui.dom.window.close(); }
});

test('no matches, Enter selection, and keyboard focus wrapping remain usable', async () => {
  const ui = await setup();
  try {
    await ui.type('not-a-promotion');
    assert.match(ui.d.querySelector('#cinema-search-results').textContent, /No promotions found/);
    ui.input().focus();
    ui.d.dispatchEvent(new ui.w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assert.equal(ui.d.activeElement.getAttribute('aria-label'), 'Close search');
    ui.d.dispatchEvent(new ui.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    assert.equal(ui.d.activeElement, ui.input());
    await ui.type('Wednesday');
    ui.input().dispatchEvent(new ui.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick();
    assert.deepEqual(ui.slideCalls, [[0, 0]]);
  } finally { ui.dom.window.close(); }
});

test('source 64px row shares the navbar center and results grow downward at desktop and mobile widths', async () => {
  for (const width of [1120, 366]) {
    const ui = await setup(width);
    try {
      const stage = ui.d.querySelector('.cinema-spotlight-stage');
      const anchoredStyle = stage.style.cssText;
      assert.equal(stage.style.top, '31px');
      assert.equal(31 + 64 / 2, 24 + 78 / 2);
      assert.equal(stage.style.left, `${12 + width / 2}px`);
      assert.equal(stage.style.width, `${Math.min(768, width)}px`);
      await ui.type('student');
      assert.ok(ui.d.querySelector('#cinema-search-results'));
      assert.equal(stage.style.cssText, anchoredStyle);
    } finally { ui.dom.window.close(); }
  }
});

test('source hover uses presence exits and can reenter without waiting for a custom tray', async () => {
  const ui = await setup(1120, true);
  try {
    await tick(1450);
    const hover = ui.d.querySelector('[data-spotlight-hover]');
    const pointer = type => hover.dispatchEvent(new ui.w.MouseEvent(type, { bubbles: true, relatedTarget: type === 'mouseover' ? null : ui.d.querySelector('[role="dialog"]') }));
    const items = () => [...ui.d.querySelectorAll('.cinema-spotlight-shortcuts')];
    pointer('mouseover'); await tick(1100);
    assert.equal(items().length, 4);
    assert.equal(ui.d.querySelector('.cinema-spotlight-tray'), null);
    pointer('mouseout'); await tick(200);
    assert.equal(items().length, 4, 'source AnimatePresence keeps items mounted through exit');
    pointer('mouseover'); await tick();
    assert.equal(items().length, 4, 'source keys preserve rapid reentry without duplicate items');
    pointer('mouseout'); await tick(1100);
    assert.equal(items().length, 0);
    pointer('mouseover'); await tick(1100);
    const student = items().find(item => item.textContent === '' && item.querySelector('a[href="#cinema-students"]'));
    assert.ok(student);
    student.querySelector('a').click(); await tick();
    assert.equal(ui.input().value, 'student');
    assert.equal(ui.d.querySelectorAll('#cinema-search-results a').length, 1);
  } finally { ui.dom.window.close(); }
});

test('navbar morph still opens and closes around the source entrance and exit', async () => {
  const ui = await setup(1120, true);
  try {
    const stage = ui.d.querySelector('.cinema-spotlight-stage');
    assert.equal(ui.d.querySelector('[data-spotlight-motion]'), null, 'source waits for the navbar collapse');
    await tick(1450);
    assert.equal(stage.style.opacity, '1');
    assert.ok(ui.d.querySelector('[data-spotlight-motion]'));
    await ui.type('student');
    ui.d.querySelector('[aria-label="Close search"]').click();
    await tick(2050);
    assert.equal(ui.d.querySelector('[role="dialog"]'), null);
    assert.equal(ui.d.activeElement, ui.trigger);
    assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  } finally { ui.dom.window.close(); }
});
