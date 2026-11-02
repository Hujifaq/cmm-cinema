const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const view = readFileSync(join(__dirname, '../Views/LoginRegister/Index.cshtml'), 'utf8')
  .replace('@await Html.PartialAsync("_PopcornMascot")', readFileSync(join(__dirname, '../Views/Shared/_PopcornMascot.cshtml'), 'utf8'));
const source = readFileSync(join(__dirname, '../wwwroot/js/signup.js'), 'utf8');

function setup({ reduced = false, fine = true, mode = 'register' } = {}) {
  const dom = new JSDOM(view, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:5081/LoginRegister' });
  const { window } = dom;
  const motion = new window.EventTarget(), pointer = new window.EventTarget();
  motion.matches = reduced;
  pointer.matches = fine;
  window.matchMedia = query => query.includes('reduce') ? motion : pointer;
  let timerId = 0, random = 0;
  const timers = new Map();
  window.Math.random = () => random;
  window.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; };
  window.clearTimeout = id => timers.delete(id);
  const fireTimer = delay => {
    const timer = [...timers].find(([, value]) => value.delay === delay);
    assert.ok(timer, `Expected a scheduled ${delay}ms timer`);
    timers.delete(timer[0]);
    timer[1].callback();
  };
  window.eval(source); // Reactions must work independently of animation libraries.
  const document = window.document;
  const form = document.querySelector('[data-signup-form]');
  const mascot = document.querySelector('[data-popcorn-mascot]');
  const page = document.querySelector('[data-signup-page]');
  mascot.getBoundingClientRect = () => ({ left: 100, top: 100, width: 300, height: 300 });
  form.elements.name.getBoundingClientRect = () => ({ left: 500, top: 200, width: 300, height: 48 });
  const move = (type = 'mouse', x = 600, y = 300) => {
    const event = new window.MouseEvent('pointermove', { clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerType', { value: type });
    page.dispatchEvent(event);
  };
  const input = (field, value) => {
    form.elements[field].value = value;
    form.elements[field].dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const toggles = [...form.querySelectorAll('[data-password-toggle]')];
  const card = document.querySelector('[data-signup-card]');
  const switchButton = document.querySelector('[data-auth-switch]');
  const switchTo = mode => { if (card.dataset.authMode !== mode) switchButton.click(); };
  switchTo(mode);
  return { dom, window, document, page, form, mascot, motion, pointer, move, input, toggles, card, switchButton, switchTo, timers, fireTimer, setRandom: value => { random = value; } };
}

test('Poppy follows mouse on fine pointers and looks at the focused Full name field', async () => {
  const ui = setup();
  try {
    ui.move();
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-look-x')) > 0);
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-eye-x')) > 0, 'White eyeballs move with the pupils');
    ui.form.elements.name.focus();
    const focusedLook = ui.mascot.style.getPropertyValue('--poppy-look-x');
    assert.ok(parseFloat(focusedLook) > 0);
    ui.move('mouse', 0, 0);
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-look-x')) < 0, 'Mouse tracking remains active while a field is focused');
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-eye-x')) < 0);
    ui.page.dispatchEvent(new ui.window.Event('pointerleave'));
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-look-x'), focusedLook, 'Leaving the page returns gaze to the focused field');
    ui.form.elements.name.blur();
    await Promise.resolve();
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-look-x'), '');
    ui.move('touch');
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-look-x'), '');
  } finally { ui.dom.window.close(); }
});

test('blinks use varied intervals and reopen without losing the current gaze', () => {
  const ui = setup({ mode: 'login' });
  try {
    ui.move();
    const gaze = ui.mascot.style.getPropertyValue('--poppy-eye-x');
    ui.setRandom(0.5);
    ui.fireTimer(3200);
    assert.equal(ui.mascot.hasAttribute('data-mascot-blinking'), true);
    ui.fireTimer(160);
    assert.equal(ui.mascot.hasAttribute('data-mascot-blinking'), false);
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-eye-x'), gaze);
    assert.ok([...ui.timers.values()].some(timer => timer.delay === 4600), 'Next blink gets a fresh random delay');
  } finally { ui.dom.window.close(); }
});

test('white highlights track independently inside both dark pupils and reset for privacy', () => {
  const ui = setup();
  try {
    const highlights = [...ui.mascot.querySelectorAll('[data-mascot-highlights]')];
    assert.equal(highlights.length, 2);
    highlights.forEach(highlight => {
      assert.ok(highlight.querySelector('ellipse[fill="white"]'));
      assert.match(highlight.parentElement.getAttribute('clip-path'), /poppy-pupil-/);
    });
    ui.move('mouse', 700, 400);
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-highlight-x')) > 0);
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-highlight-y')) > 0);
    assert.ok(Math.abs(parseFloat(ui.mascot.style.getPropertyValue('--poppy-highlight-x'))) > Math.abs(parseFloat(ui.mascot.style.getPropertyValue('--poppy-look-x'))), 'Foreground whites have more parallax travel than dark pupils');
    assert.ok(Math.abs(parseFloat(ui.mascot.style.getPropertyValue('--poppy-look-x'))) > Math.abs(parseFloat(ui.mascot.style.getPropertyValue('--poppy-eye-x'))), 'Pupils move more than the rear eye shells');
    ui.form.elements.name.focus();
    ui.move('mouse', 0, 0);
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-highlight-x')) < 0);
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-highlight-y')) < 0);
    ui.toggles[0].click();
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-highlight-x'), '');
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-highlight-y'), '');
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
  } finally { ui.dom.window.close(); }
});

test('showing a password during a blink cancels reopening and keeps eyes closed', () => {
  const ui = setup();
  try {
    ui.fireTimer(3200);
    ui.toggles[0].click();
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
    assert.equal(ui.mascot.hasAttribute('data-mascot-blinking'), false);
    assert.equal(ui.timers.size, 0, 'No blink callback can reopen private eyes');
    ui.toggles[0].click();
    assert.ok([...ui.timers.values()].some(timer => timer.delay === 3200));
  } finally { ui.dom.window.close(); }
});

test('hidden tabs and pagehide stop blink timers; visibility and bfcache restore them', () => {
  const ui = setup();
  try {
    Object.defineProperty(ui.document, 'hidden', { configurable: true, value: true });
    ui.document.dispatchEvent(new ui.window.Event('visibilitychange'));
    assert.equal(ui.timers.size, 0);
    ui.move();
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-eye-x'), '');
    Object.defineProperty(ui.document, 'hidden', { configurable: true, value: false });
    ui.document.dispatchEvent(new ui.window.Event('visibilitychange'));
    assert.equal(ui.timers.size, 1);
    ui.window.dispatchEvent(new ui.window.PageTransitionEvent('pagehide'));
    assert.equal(ui.timers.size, 0);
    ui.window.dispatchEvent(new ui.window.PageTransitionEvent('pageshow', { persisted: true }));
    assert.equal(ui.timers.size, 1);
    ui.motion.matches = true;
    ui.motion.dispatchEvent(new ui.window.Event('change'));
    assert.equal(ui.timers.size, 0, 'Reduced motion disables idle blinking');
  } finally { ui.dom.window.close(); }
});

test('eyes stay closed while either password is visible and reopen only after both are hidden', () => {
  const ui = setup();
  try {
    ui.toggles[0].click();
    assert.equal(ui.form.elements.password.type, 'text');
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
    ui.move();
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-look-x'), '');
    ui.toggles[1].click();
    ui.toggles[0].click();
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
    ui.toggles[1].click();
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), false);
  } finally { ui.dom.window.close(); }
});

test('Login validates independently of Register and remains a local UI preview', () => {
  const ui = setup({ mode: 'login' });
  try {
    const login = ui.document.querySelector('[data-login-form]');
    assert.equal(login.querySelector('[data-login-submit]').disabled, false);
    assert.equal(login.checkValidity(), false);
    login.elements.email.value = 'guest@example.com';
    login.elements.password.value = 'PreviewOnly123';
    assert.equal(ui.form.checkValidity(), false, 'Register is still incomplete');
    assert.equal(login.checkValidity(), true, 'Login does not depend on Register');
    const event = new ui.window.Event('submit', { bubbles: true, cancelable: true });
    login.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    const status = login.querySelector('[data-login-status]');
    assert.equal(status.hidden, false);
    assert.match(status.textContent, /not available yet/);
    login.elements.email.dispatchEvent(new ui.window.Event('input', { bubbles: true }));
    assert.equal(status.hidden, true);
    assert.equal(ui.window.localStorage?.length ?? 0, 0);
  } finally { ui.dom.window.close(); }
});

test('mascot follows Login fields and switching forms re-hides shown passwords', () => {
  const ui = setup({ mode: 'login' });
  try {
    const login = ui.document.querySelector('[data-login-form]');
    const toggle = login.querySelector('[data-password-toggle]');
    login.elements.email.getBoundingClientRect = () => ({ left: 10, top: 200, width: 100, height: 48 });
    login.elements.email.focus();
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-look-x')) < 0);
    toggle.click();
    assert.equal(login.elements.password.type, 'text');
    assert.equal(toggle.getAttribute('aria-label'), 'Hide password');
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
    ui.switchTo('register');
    assert.equal(login.elements.password.type, 'password');
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), false);
    ui.toggles[0].click();
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
    ui.switchTo('login');
    assert.equal(ui.form.elements.password.type, 'password');
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), false);
  } finally { ui.dom.window.close(); }
});

test('Login is the initial selection and rapid toggles keep only the current form accessible', () => {
  const ui = setup({ mode: 'login' });
  try {
    const login = ui.document.getElementById('auth-login-panel');
    const register = ui.document.getElementById('auth-register-panel');
    assert.equal(ui.card.dataset.authMode, 'login');
    assert.equal(login.hasAttribute('inert'), false);
    assert.equal(register.hasAttribute('inert'), true);
    assert.equal(ui.switchButton.textContent.trim(), 'Register');
    for (let i = 0; i < 11; i++) ui.switchButton.click();
    assert.equal(ui.card.dataset.authMode, 'register');
    assert.equal(login.getAttribute('aria-hidden'), 'true');
    assert.equal(login.hasAttribute('inert'), true);
    assert.equal(register.getAttribute('aria-hidden'), 'false');
    assert.equal(register.hasAttribute('inert'), false);
    assert.equal(ui.document.querySelectorAll('[data-auth-view][data-active]').length, 1);
    assert.equal(ui.switchButton.textContent.trim(), 'Login');
    assert.equal(ui.document.querySelector('[data-auth-announcement]').textContent, 'Register form');
  } finally { ui.dom.window.close(); }
});

test('switching preserves values, moves focus out of the inactive form, and does not submit', () => {
  const ui = setup();
  try {
    let submitted = false;
    ui.form.addEventListener('submit', () => { submitted = true; });
    ui.input('name', 'Cinema Guest');
    ui.form.elements.name.focus();
    ui.switchButton.click();
    assert.equal(ui.document.activeElement, ui.switchButton);
    assert.equal(ui.form.closest('[data-auth-view]').hasAttribute('inert'), true);
    ui.switchButton.click();
    assert.equal(ui.form.elements.name.value, 'Cinema Guest');
    assert.equal(submitted, false);
  } finally { ui.dom.window.close(); }
});

test('switching works without GSAP and with reduced motion; no-JS markup remains readable', () => {
  const ui = setup({ reduced: true, mode: 'login' });
  try {
    ui.switchButton.click();
    assert.equal(ui.card.dataset.authMode, 'register');
    assert.equal(ui.form.closest('[data-auth-view]').hasAttribute('inert'), false);
  } finally { ui.dom.window.close(); }
  const fallback = new JSDOM(view);
  try {
    assert.equal(fallback.window.document.querySelectorAll('[data-auth-view][inert]').length, 0);
    assert.equal(fallback.window.document.querySelector('[data-signup-card]').hasAttribute('data-auth-ready'), false);
  } finally { fallback.window.close(); }
});

test('password mismatch reacts on blur or invalid submission, not on each keystroke, and correction clears it', async () => {
  const ui = setup();
  try {
    ui.input('password', 'MovieNight123');
    ui.input('confirmPassword', 'Different123');
    assert.equal(ui.mascot.hasAttribute('data-mascot-error'), false);
    ui.form.elements.confirmPassword.focus();
    ui.form.elements.confirmPassword.blur();
    await Promise.resolve();
    assert.equal(ui.mascot.hasAttribute('data-mascot-error'), true);
    ui.input('confirmPassword', 'MovieNight123');
    assert.equal(ui.mascot.hasAttribute('data-mascot-error'), false);
    ui.input('confirmPassword', 'Different123');
    assert.equal(ui.form.reportValidity(), false);
    assert.equal(ui.mascot.hasAttribute('data-mascot-error'), true);
    ui.input('confirmPassword', 'MovieNight123');
    ui.form.elements.email.dispatchEvent(new ui.window.Event('invalid'));
    assert.equal(ui.mascot.hasAttribute('data-mascot-error'), false, 'Email errors do not imply a wrong password');
  } finally { ui.dom.window.close(); }
});

test('reduced motion and coarse pointers keep gaze still but preserve privacy and validation states', () => {
  const ui = setup({ reduced: true, fine: false });
  try {
    ui.move();
    ui.form.elements.name.focus();
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-look-x'), '');
    ui.toggles[0].click();
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
    ui.form.elements.password.dispatchEvent(new ui.window.Event('invalid'));
    assert.equal(ui.mascot.hasAttribute('data-mascot-error'), true);
    assert.equal(ui.page.hasAttribute('data-revealed'), true);
  } finally { ui.dom.window.close(); }
});

test('preference changes reset gaze; pagehide clears reactions and bfcache return restores them', () => {
  const ui = setup();
  try {
    ui.move();
    ui.motion.matches = true;
    ui.motion.dispatchEvent(new ui.window.Event('change'));
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-look-x'), '');
    ui.motion.matches = false;
    ui.window.dispatchEvent(new ui.window.PageTransitionEvent('pagehide'));
    ui.move();
    assert.equal(ui.mascot.style.getPropertyValue('--poppy-look-x'), '');
    ui.window.dispatchEvent(new ui.window.PageTransitionEvent('pageshow', { persisted: true }));
    ui.move();
    assert.ok(parseFloat(ui.mascot.style.getPropertyValue('--poppy-look-x')) > 0);
    ui.form.elements.password.dispatchEvent(new ui.window.Event('invalid'));
    ui.window.dispatchEvent(new ui.window.PageTransitionEvent('pagehide'));
    assert.equal(ui.mascot.hasAttribute('data-mascot-error'), false);
  } finally { ui.dom.window.close(); }
});
