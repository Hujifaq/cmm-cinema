const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const view = readFileSync(join(__dirname, '../Views/LoginRegister/Index.cshtml'), 'utf8')
  .replace('@await Html.PartialAsync("_PopcornMascot")', readFileSync(join(__dirname, '../Views/Shared/_PopcornMascot.cshtml'), 'utf8'))
  .replace(/\schecked="@Model[^"]*"/g, '');
const source = readFileSync(join(__dirname, '../wwwroot/js/signup.js'), 'utf8');

function setup({ reduced = false, fine = true, wide = true, mode = 'register' } = {}) {
  const dom = new JSDOM(view, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:5081/LoginRegister' });
  const { window } = dom;
  const motion = new window.EventTarget(), pointer = new window.EventTarget(), desktop = new window.EventTarget();
  motion.matches = reduced;
  pointer.matches = fine;
  desktop.matches = wide;
  window.matchMedia = query => query.includes('reduce') ? motion : query.includes('min-width') ? desktop : pointer;
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
  let frameId = 0, now = 0;
  const frames = new Map();
  window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const settle = () => {
    for (let i = 0; i < 240 && frames.size; i++) {
      now += 16;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(now));
    }
  };
  window.eval(source); // Reactions must work independently of animation libraries.
  const document = window.document;
  const form = document.querySelector('[data-signup-form]');
  const mascot = document.querySelector('[data-popcorn-mascot]');
  const page = document.querySelector('[data-signup-page]');
  mascot.getBoundingClientRect = () => ({ left: 100, top: 100, width: 300, height: 300 });
  mascot.querySelector('svg').getBoundingClientRect = () => ({ left: 100, top: 100, width: 300, height: 300 });
  const translate = node => {
    const match = /translate\(([-.\d]+)px, ([-.\d]+)px\)/.exec(node.style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
  };
  const look = () => {
    settle();
    return [...mascot.querySelectorAll('[data-mascot-eye]')].map(eye => ({
      pupil: translate(eye.querySelector('.popcorn-mascot__gaze')),
      glint: translate(eye.querySelector('[data-mascot-highlights]'))
    }));
  };
  const centred = point => !point || (point.x === 0 && point.y === 0);
  const resting = () => look().every(eye => centred(eye.pupil) && centred(eye.glint));
  const tilt = () => parseFloat(mascot.style.getPropertyValue('--poppy-tilt'));
  const submit = target => {
    const event = new window.Event('submit', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
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
  return { dom, window, document, page, form, mascot, motion, pointer, desktop, move, input, toggles, card, switchButton, switchTo, timers, fireTimer, setRandom: value => { random = value; }, look, resting, tilt, submit };
}

test('Poppy follows mouse on fine pointers and looks at the focused Full name field', async () => {
  const ui = setup();
  try {
    ui.move();
    const [left, right] = ui.look();
    assert.ok(left.pupil.x > 0 && right.pupil.x > 0, 'Both pupils turn toward the pointer');
    assert.ok(left.pupil.y > 0 && right.pupil.y > 0);
    assert.ok(ui.tilt() > 0, 'The head leans toward the pointer');
    ui.form.elements.name.focus();
    const focusedLook = ui.look()[0].pupil;
    assert.ok(focusedLook.x > 0);
    ui.move('mouse', 0, 0);
    assert.ok(ui.look()[0].pupil.x < 0, 'Mouse tracking remains active while a field is focused');
    ui.page.dispatchEvent(new ui.window.Event('pointerleave'));
    assert.deepEqual(ui.look()[0].pupil, focusedLook, 'Leaving the page returns gaze to the focused field');
    ui.form.elements.name.blur();
    await Promise.resolve();
    assert.ok(ui.resting(), 'Blurring the field returns the eyes to centre');
    ui.move('touch');
    assert.ok(ui.resting(), 'Touch input does not move the eyes');
  } finally { ui.dom.window.close(); }
});

test('blinks use varied intervals and reopen without losing the current gaze', () => {
  const ui = setup({ mode: 'login' });
  try {
    ui.move();
    const gaze = ui.look();
    assert.ok(gaze[0].pupil.x > 0);
    ui.setRandom(0.5);
    ui.fireTimer(3200);
    assert.equal(ui.mascot.hasAttribute('data-mascot-blinking'), true);
    ui.fireTimer(160);
    assert.equal(ui.mascot.hasAttribute('data-mascot-blinking'), false);
    assert.deepEqual(ui.look(), gaze);
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
    ui.look().forEach(eye => {
      assert.ok(eye.glint.x > 0 && eye.glint.y > 0, 'Each white glint leads its pupil toward the pointer');
      assert.ok(Math.hypot(eye.glint.x, eye.glint.y) <= 9.001, 'The glint stays inside the dark pupil');
    });
    ui.form.elements.name.focus();
    ui.move('mouse', 0, 0);
    ui.look().forEach(eye => assert.ok(eye.glint.x < 0 && eye.glint.y < 0));
    ui.toggles[0].click();
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
    assert.ok(ui.resting(), 'Showing a password re-centres pupils and glints');
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
    assert.ok(ui.resting(), 'Hidden pages do not track the pointer');
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
    assert.ok(ui.resting(), 'Eyes stay centred while a password is visible');
    ui.toggles[1].click();
    ui.toggles[0].click();
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), true);
    ui.toggles[1].click();
    assert.equal(ui.mascot.hasAttribute('data-mascot-private'), false);
  } finally { ui.dom.window.close(); }
});

test('Login validates independently of Register and only blocks invalid submissions', () => {
  const ui = setup({ mode: 'login' });
  try {
    const login = ui.document.querySelector('[data-login-form]');
    assert.equal(login.querySelector('[data-login-submit]').disabled, false);
    assert.equal(login.checkValidity(), false);
    assert.equal(ui.submit(login), true, 'An empty Login form is not sent');
    login.elements.email.value = 'guest@example.com';
    login.elements.password.value = 'MovieNight123';
    assert.equal(ui.form.checkValidity(), false, 'Register is still incomplete');
    assert.equal(login.checkValidity(), true, 'Login does not depend on Register');
    assert.equal(ui.submit(login), false, 'A complete Login form is sent to the server');
    const status = login.querySelector('[data-login-status]');
    status.hidden = false;
    login.elements.email.dispatchEvent(new ui.window.Event('input', { bubbles: true }));
    assert.equal(status.hidden, true, 'Typing clears the previous server message');
    assert.equal(ui.window.localStorage?.length ?? 0, 0);
  } finally { ui.dom.window.close(); }
});

test('Login shows email and password together and requires both before signing in', () => {
  const ui = setup({ mode: 'login', reduced: true });
  try {
    const login = ui.document.querySelector('[data-login-form]');
    assert.equal(login.elements.password.disabled, false);
    assert.equal(login.elements.password.closest('[hidden]'), null);
    login.elements.email.value = 'invalid-email';
    login.elements.password.value = 'MovieNight123';
    assert.equal(ui.submit(login), true, 'Invalid email prevents submission');
    login.elements.email.value = 'guest@example.com';
    login.elements.password.value = '';
    assert.equal(ui.submit(login), true, 'Empty password prevents submission');
    login.elements.password.value = 'MovieNight123';
    assert.equal(ui.submit(login), false);
    ui.switchTo('register');
    ui.switchTo('login');
    assert.equal(login.elements.email.value, 'guest@example.com');
    assert.equal(login.elements.password.value, 'MovieNight123');
  } finally { ui.dom.window.close(); }
});

test('Google sign-in posts its own form and bypasses email validation', () => {
  const ui = setup({ mode: 'login' });
  try {
    const login = ui.document.querySelector('[data-login-form]');
    const google = ui.document.getElementById('auth-login-panel').querySelector('[data-google-login]');
    assert.equal(login.checkValidity(), false);
    assert.equal(google.disabled, false);
    assert.equal(google.type, 'submit');
    assert.notEqual(google.form, login, 'Google is not part of the email form');
    assert.equal(google.form.getAttribute('asp-action'), 'GoogleLogin');
    assert.equal(google.form.checkValidity(), true, 'Google sign-in needs no email or password');
    assert.equal(ui.submit(google.form), false);
  } finally { ui.dom.window.close(); }
});

test('Forgot password links to the reset page without requiring JavaScript', () => {
  const dom = new JSDOM(view);
  try {
    const forgot = dom.window.document.querySelector('[data-forgot-password]');
    assert.equal(forgot.tagName, 'A');
    assert.equal(forgot.hidden, false);
    assert.equal(forgot.getAttribute('asp-controller'), 'Forgotpassword');
    assert.equal(forgot.getAttribute('asp-action'), 'Index');
  } finally { dom.window.close(); }
});

test('Register requires privacy acknowledgement and still validates matching passwords', () => {
  const ui = setup({ reduced: true });
  try {
    ui.input('name', 'Cinema Guest');
    ui.input('email', 'guest@example.com');
    ui.input('password', 'MovieNight123');
    ui.input('confirmPassword', 'MovieNight123');
    assert.equal(ui.form.elements.privacyAcknowledged.checked, false);
    assert.equal(ui.form.checkValidity(), false, 'Privacy checkbox is required');
    assert.equal(ui.submit(ui.form), true);
    ui.form.elements.privacyAcknowledged.checked = true;
    ui.input('confirmPassword', 'Different123');
    assert.equal(ui.form.checkValidity(), false, 'Password confirmation still applies');
    ui.input('confirmPassword', 'MovieNight123');
    assert.equal(ui.form.checkValidity(), true);
    assert.equal(ui.submit(ui.form), false, 'A complete registration is sent to the server');
  } finally { ui.dom.window.close(); }
});

test('Register Google action posts its own form and leaves the Register form untouched', () => {
  const ui = setup();
  try {
    const register = ui.form.closest('[data-auth-view]');
    const google = register.querySelector('[data-google-login]');
    assert.equal(ui.form.checkValidity(), false);
    assert.equal(google.disabled, false);
    assert.equal(google.type, 'submit');
    assert.notEqual(google.form, ui.form, 'Google is not part of the Register form');
    assert.equal(google.form.getAttribute('asp-action'), 'GoogleLogin');
    assert.equal(google.form.checkValidity(), true, 'Google sign-in needs no Register fields');
    assert.equal(ui.form.elements.privacyAcknowledged.checked, false);
  } finally { ui.dom.window.close(); }
});

test('mascot follows Login fields and switching forms re-hides shown passwords', () => {
  const ui = setup({ mode: 'login' });
  try {
    const login = ui.document.querySelector('[data-login-form]');
    const toggle = login.querySelector('[data-password-toggle]');
    login.elements.email.getBoundingClientRect = () => ({ left: 10, top: 200, width: 100, height: 48 });
    login.elements.email.focus();
    assert.ok(ui.look()[0].pupil.x < 0, 'Poppy looks left toward the email field');
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
    assert.equal(fallback.window.document.querySelector('[data-auth-mode-toggle]').hidden, true);
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
    assert.ok(ui.look().every(eye => eye.pupil === null), 'Reduced motion leaves the eyes untouched');
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
    assert.ok(ui.look()[0].pupil.x > 0);
    ui.motion.matches = true;
    ui.motion.dispatchEvent(new ui.window.Event('change'));
    assert.ok(ui.look().every(eye => eye.pupil === null), 'Reduced motion clears the gaze');
    ui.motion.matches = false;
    ui.window.dispatchEvent(new ui.window.PageTransitionEvent('pagehide'));
    ui.move();
    assert.ok(ui.resting(), 'No tracking after pagehide');
    ui.window.dispatchEvent(new ui.window.PageTransitionEvent('pageshow', { persisted: true }));
    ui.move();
    assert.ok(ui.look()[0].pupil.x > 0, 'Tracking resumes after a bfcache return');
    ui.form.elements.password.dispatchEvent(new ui.window.Event('invalid'));
    ui.window.dispatchEvent(new ui.window.PageTransitionEvent('pagehide'));
    assert.equal(ui.mascot.hasAttribute('data-mascot-error'), false);
  } finally { ui.dom.window.close(); }
});
