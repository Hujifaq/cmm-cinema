const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, '../wwwroot/js/cinema-nav.js'), 'utf8');

function setup({ reduced = false, animate = false } = {}) {
  let document;
  class Element {
    constructor() {
      this.listeners = new Map();
      this.attributes = new Map();
      this.children = [];
      this.dataset = {};
      this.style = { removeProperty(name) { delete this[name]; } };
    }
    addEventListener(name, callback) {
      const callbacks = this.listeners.get(name) ?? new Set();
      callbacks.add(callback); this.listeners.set(name, callbacks);
    }
    removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
    dispatchEvent(event) {
      event.target ??= this;
      this.listeners.get(event.type)?.forEach(callback => callback(event));
    }
    emit(type, detail = {}) { this.dispatchEvent({ type, ...detail }); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
    toggleAttribute(name, value) { if (value) this.attributes.set(name, ''); else this.attributes.delete(name); }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    closest(selector) { return selector === '[data-mobile-index]' && 'mobileIndex' in this.dataset ? this : null; }
    focus() { document.activeElement = this; }
    querySelector(selector) { return this.selectors[selector]; }
    querySelectorAll(selector) { return this.collections?.[selector] ?? this.children; }
    getBoundingClientRect() { return { height: 280 }; }
  }
  document = new Element();
  document.hidden = false;
  document.activeElement = null;
  const nav = new Element(), toggle = new Element(), panel = new Element();
  const content = new Element(), stage = new Element();
  const layers = [new Element(), new Element()];
  const labels = Array.from({ length: 4 }, () => new Element());
  const rows = Array.from({ length: 4 }, (_, index) => {
    const row = new Element(); row.dataset.mobileIndex = String(index);
    row.setAttribute('aria-pressed', String(index === 0)); return row;
  });
  const desktop = rows.map((_, index) => {
    const button = new Element(); button.setAttribute('aria-pressed', String(index === 0)); return button;
  });
  panel.children = rows;
  panel.collections = { '[data-mobile-index]': rows, '[data-menu-layer]': layers, '[data-menu-label]': labels };
  stage.children = desktop;
  nav.children = [toggle, panel, stage];
  nav.selectors = { '[data-nav-toggle]': toggle, '[data-mobile-menu]': panel,
    '[data-mobile-menu-content]': content, '[data-gooey-nav]': stage };
  document.querySelectorAll = () => [nav];
  const mobile = new Element(); mobile.matches = true;
  const motion = new Element(); motion.matches = reduced;
  const window = new Element();
  window.matchMedia = query => query.includes('767') ? mobile : motion;
  const timelines = [];
  if (animate) window.gsap = {
    set() {}, to() {}, killTweensOf() {},
    timeline({ onComplete }) {
      const timeline = { killed: false, to() { return this; }, kill() { this.killed = true; },
        progress() { this.complete(); }, complete() { if (!this.killed) onComplete(); } };
      timelines.push(timeline); return timeline;
    }
  };
  runInNewContext(source, { window, document, queueMicrotask,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    ResizeObserver: class { observe() {} disconnect() {} } });
  return { nav, toggle, panel, stage, rows, labels, layers, content, desktop, mobile, motion, document, window, timelines,
    finish: () => timelines.forEach(timeline => timeline.complete()) };
}

test('closed controls are hidden and inert; opening works without GSAP', () => {
  const ui = setup();
  assert.equal(ui.panel.hidden, true);
  assert.equal(ui.panel.inert, true);
  ui.toggle.emit('click');
  assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.panel.hidden, false);
  assert.equal(ui.panel.inert, false);
  ui.document.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(ui.panel.hidden, true);
  assert.equal(ui.document.activeElement, ui.toggle);
});

test('rapid open-close-open keeps the latest state and ignores killed completions', () => {
  const ui = setup({ animate: true });
  ui.toggle.emit('click'); ui.toggle.emit('click'); ui.toggle.emit('click');
  ui.finish();
  assert.equal(ui.panel.hidden, false);
  assert.equal(ui.panel.inert, false);
  assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
  ui.document.emit('pointerdown', { target: new Object() });
  assert.equal(ui.panel.inert, true);
  ui.finish();
  assert.equal(ui.panel.hidden, true);
});

test('mobile selection synchronizes desktop buttons, closes, and returns focus', () => {
  const ui = setup();
  let requested;
  ui.stage.addEventListener('cinema:select', event => { requested = event.detail.index; });
  ui.toggle.emit('click');
  ui.panel.emit('click', { target: ui.rows[2] });
  assert.equal(requested, 2);
  assert.equal(ui.rows[2].getAttribute('aria-pressed'), 'true');
  assert.equal(ui.desktop[2].getAttribute('aria-pressed'), 'true');
  assert.equal(ui.rows[0].getAttribute('aria-pressed'), 'false');
  assert.equal(ui.panel.hidden, true);
  assert.equal(ui.document.activeElement, ui.toggle);
});

test('breakpoint changes close the panel and move focus into the visible controls', () => {
  const ui = setup();
  ui.toggle.emit('click'); ui.rows[1].focus();
  ui.mobile.matches = false; ui.mobile.emit('change');
  assert.equal(ui.panel.hidden, true);
  assert.equal(ui.document.activeElement, ui.desktop[0]);
  ui.mobile.matches = true; ui.mobile.emit('change');
  assert.equal(ui.document.activeElement, ui.toggle);
});

test('reduced motion bypasses tweens; arrow keys and Tab dismissal remain usable', async () => {
  const ui = setup({ reduced: true, animate: true });
  ui.toggle.emit('click');
  assert.equal(ui.timelines.length, 0);
  ui.nav.emit('keydown', { target: ui.toggle, key: 'ArrowDown', preventDefault() {} });
  assert.equal(ui.document.activeElement, ui.rows[0]);
  ui.nav.emit('keydown', { target: ui.rows[0], key: 'End', preventDefault() {} });
  assert.equal(ui.document.activeElement, ui.rows[3]);
  ui.document.activeElement = null;
  ui.nav.emit('focusout');
  await Promise.resolve();
  assert.equal(ui.panel.hidden, true);
});

test('hidden pages finish motion without losing state; pagehide releases listeners', () => {
  const ui = setup({ animate: true });
  ui.toggle.emit('click');
  ui.document.hidden = true; ui.document.emit('visibilitychange');
  assert.equal(ui.panel.hidden, false);
  assert.equal(ui.timelines[0].killed, true);
  ui.window.emit('pagehide');
  assert.equal(ui.panel.hidden, true);
  assert.equal(ui.toggle.listeners.get('click').size, 0);
  assert.equal(ui.document.listeners.get('keydown').size, 0);
});
