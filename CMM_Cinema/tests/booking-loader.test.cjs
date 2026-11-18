const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const source = readFileSync(join(__dirname, '../wwwroot/js/booking/booking-loader.js'), 'utf8');

function setup() {
  const dom = new JSDOM(`<form id="confirm-booking" data-loader-form><input type="checkbox" name="seatIds" value="D4" checked></form>
    <button type="submit" form="confirm-booking" data-confirm-submit>Continue</button>
    <div data-booking-loader hidden><p><span data-loader-line>One</span><span data-loader-line>Two</span><span data-loader-line>Three</span></p><p role="status" data-loader-status></p></div>`,
  { runScripts: 'outside-only', pretendToBeVisual: true });
  const posted = [];
  dom.window.HTMLFormElement.prototype.submit = function () { posted.push(this.id); };
  dom.window.eval(source);
  const d = dom.window.document;
  return { dom, d, posted, loader: d.querySelector('[data-booking-loader]'), lines: [...d.querySelectorAll('[data-loader-line]')] };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Confirm booking shows the loader, cycles the lines, then posts the form once', async () => {
  const ui = setup();
  try {
    assert.equal(ui.loader.hidden, true);
    ui.d.querySelector('[data-confirm-submit]').click();
    assert.equal(ui.loader.hidden, false);
    assert.equal(ui.d.documentElement.classList.contains('bk-loader-open'), true);
    assert.equal(ui.lines[0].dataset.state, 'active');
    assert.match(ui.d.querySelector('[data-loader-status]').textContent, /Confirming your booking/);
    assert.deepEqual(ui.posted, [], 'The form waits for the loader to be seen');

    ui.d.querySelector('[data-confirm-submit]').click();
    await wait(1500);
    assert.equal(ui.lines[0].dataset.state, 'leaving');
    assert.equal(ui.lines[1].dataset.state, 'active');

    await wait(800);
    assert.deepEqual(ui.posted, ['confirm-booking'], 'Posted exactly once despite a second click');
  } finally { ui.dom.window.close(); }
});

test('returning through the history cache hides a loader left open', () => {
  const ui = setup();
  try {
    ui.d.querySelector('[data-confirm-submit]').click();
    const pageshow = new ui.dom.window.Event('pageshow');
    pageshow.persisted = true;
    ui.dom.window.dispatchEvent(pageshow);
    assert.equal(ui.loader.hidden, true);
    assert.equal(ui.d.documentElement.classList.contains('bk-loader-open'), false);
    assert.equal(ui.lines.every(line => !line.dataset.state), true);
  } finally { ui.dom.window.close(); }
});

test('leaving while the loader is up skips the cross-document page transition', () => {
  const ui = setup();
  try {
    let skipped = 0;
    const idle = new ui.dom.window.Event('pageswap');
    idle.viewTransition = { skipTransition: () => skipped++ };
    ui.dom.window.dispatchEvent(idle);
    assert.equal(skipped, 0, 'Ordinary navigation keeps its transition');

    ui.d.querySelector('[data-confirm-submit]').click();
    const swap = new ui.dom.window.Event('pageswap');
    swap.viewTransition = { skipTransition: () => skipped++ };
    ui.dom.window.dispatchEvent(swap);
    assert.equal(skipped, 1);
  } finally { ui.dom.window.close(); }
});
