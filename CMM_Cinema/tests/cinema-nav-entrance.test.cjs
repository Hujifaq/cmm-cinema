const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { stabilizeNavEntrance } = require('../Client/nav-entrance.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { finished, resolve, reject };
}
function setup(animations) {
  const dom = new JSDOM('<nav><button>Search</button></nav>');
  const nav = dom.window.document.querySelector('nav');
  if (animations) nav.getAnimations = () => animations;
  const timers = [];
  const lifecycle = stabilizeNavEntrance(nav, {
    setTimer(callback, duration) { const timer = { callback, duration, cleared: false }; timers.push(timer); return timer; },
    clearTimer(timer) { timer.cleared = true; }
  });
  return { dom, nav, lifecycle, timers };
}

test('entrance waits for delayed labels as well as the shorter navbar shell', async () => {
  const shell = deferred(), label = deferred();
  const ui = setup([{ animationName: 'cinema-nav-open', finished: shell.finished },
    { animationName: 'cinema-nav-label', finished: label.finished }]);
  try {
    shell.resolve(); await flush();
    assert.equal(ui.nav.hasAttribute('data-nav-entered'), false);
    label.resolve(); await flush();
    assert.equal(ui.nav.hasAttribute('data-nav-entered'), true);
  } finally { ui.lifecycle.dispose(); ui.dom.window.close(); }
});

test('focus settles the entrance permanently across blur and Spotlight restoration', () => {
  const ui = setup();
  try {
    ui.nav.dispatchEvent(new ui.dom.window.FocusEvent('focusin'));
    assert.equal(ui.nav.hasAttribute('data-nav-entered'), true);
    assert.equal(ui.timers[0].cleared, true);
    ui.nav.dispatchEvent(new ui.dom.window.FocusEvent('focusout'));
    ui.nav.setAttribute('data-search-mode', '');
    ui.nav.removeAttribute('data-search-mode');
    assert.equal(ui.nav.hasAttribute('data-nav-entered'), true);
  } finally { ui.lifecycle.dispose(); ui.dom.window.close(); }
});

test('an early pointer interaction settles the entrance before focus changes', () => {
  const ui = setup();
  try {
    ui.nav.querySelector('button').dispatchEvent(new ui.dom.window.Event('pointerdown', { bubbles: true }));
    assert.equal(ui.nav.hasAttribute('data-nav-entered'), true);
  } finally { ui.lifecycle.dispose(); ui.dom.window.close(); }
});

test('completed or reduced-motion entrances cannot restart later', () => {
  const ui = setup([]);
  try {
    assert.equal(ui.nav.hasAttribute('data-nav-entered'), true);
    assert.equal(ui.timers.length, 0);
    ui.nav.dispatchEvent(new ui.dom.window.FocusEvent('focusin'));
    ui.nav.dispatchEvent(new ui.dom.window.FocusEvent('focusout'));
    assert.equal(ui.nav.hasAttribute('data-nav-entered'), true);
  } finally { ui.lifecycle.dispose(); ui.dom.window.close(); }
});

test('cancelled animations and older-engine fallback also settle instead of replaying', async () => {
  const animation = deferred();
  const ui = setup([{ animationName: 'cinema-nav-open', finished: animation.finished }]);
  try {
    animation.reject(new Error('animation cancelled')); await flush();
    assert.equal(ui.nav.hasAttribute('data-nav-entered'), true);
  } finally { ui.lifecycle.dispose(); ui.dom.window.close(); }
  const fallback = setup();
  try {
    assert.ok(fallback.timers[0].duration > 985);
    fallback.timers[0].callback();
    assert.equal(fallback.nav.hasAttribute('data-nav-entered'), true);
  } finally { fallback.lifecycle.dispose(); fallback.dom.window.close(); }
});
