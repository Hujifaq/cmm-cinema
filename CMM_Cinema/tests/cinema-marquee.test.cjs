const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const source = readFileSync(join(__dirname, '../wwwroot/js/cinema-marquee.js'), 'utf8');
const partial = readFileSync(join(__dirname, '../Views/Shared/_CinemaMarquee.cshtml'), 'utf8');

const run = html => {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const errors = [];
  dom.window.addEventListener('error', event => errors.push(event.error));
  dom.window.eval(source);
  return { dom, document: dom.window.document, errors };
};

test('the shared marquee without a pause button runs without errors', () => {
  const ui = run(partial.replace(/^@\{[\s\S]*?\n\}\n/, ''));
  try {
    assert.ok(ui.document.querySelector('[data-marquee]'));
    assert.equal(ui.document.querySelector('[data-marquee-toggle]'), null);
    assert.deepEqual(ui.errors, []);
  } finally { ui.dom.window.close(); }
});

test('a pause button, when present, toggles the marquee and its label', () => {
  const ui = run(`<section data-marquee><button data-marquee-toggle hidden aria-pressed="false">
    <span data-marquee-pause-icon></span><span data-marquee-play-icon hidden></span></button></section>`);
  try {
    const marquee = ui.document.querySelector('[data-marquee]');
    const toggle = ui.document.querySelector('[data-marquee-toggle]');
    assert.equal(toggle.hidden, false);
    toggle.click();
    assert.equal(marquee.hasAttribute('data-paused'), true);
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(toggle.getAttribute('aria-label'), 'Resume promotions');
    assert.equal(ui.document.querySelector('[data-marquee-play-icon]').hidden, false);
    toggle.click();
    assert.equal(marquee.hasAttribute('data-paused'), false);
    assert.equal(toggle.getAttribute('aria-label'), 'Pause promotions');
  } finally { ui.dom.window.close(); }
});
