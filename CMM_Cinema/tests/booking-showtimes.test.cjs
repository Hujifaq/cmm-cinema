const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

test('changing date keeps filters and refreshes the ticket stamp with the screenings', async () => {
  const dom = new JSDOM(`<div data-showtimes>
    <form action="/Booking/Showtimes" data-booking-filters>
      <input name="movie" value="silent-wills">
      <input name="format" value="2D">
      <select name="cinemaId" data-auto-submit><option value="2" selected>CMM CB12</option></select>
      <select name="language" data-auto-submit><option value="English" selected>English</option></select>
      <div data-date-stamp aria-hidden="true"><small>Thu</small><strong>05</strong><small>Nov</small></div>
      <span data-date-month>November 2026</span>
      <div data-date-options>
        <input type="radio" name="date" value="2026-11-05" checked data-auto-submit>
        <input type="radio" name="date" value="2026-11-07" data-auto-submit>
      </div>
      <button type="button" data-date-scroll="-1"></button>
      <button type="button" data-date-scroll="1"></button>
    </form>
    <section data-screenings>Old screenings</section>
    <p data-booking-status></p>
  </div>`, { url: 'https://cinema.test/Booking/Showtimes', runScripts: 'outside-only' });
  const { window } = dom;
  const requests = [];
  window.ResizeObserver = class { observe() {} };
  window.fetch = async url => {
    requests.push(new URL(url));
    return { ok: true, text: async () => `<span data-date-month>November 2026</span>
      <div data-date-stamp><small>Sat</small><strong>07</strong><small>Nov</small></div>
      <section data-screenings>Saturday screenings</section>` };
  };
  try {
    const document = window.document;
    const originalForm = document.querySelector('form');
    window.eval(readFileSync(join(__dirname, '../wwwroot/js/booking/showtimes.js'), 'utf8'));
    document.querySelector('input[value="2026-11-07"]').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1);
    assert.deepEqual(Object.fromEntries(requests[0].searchParams), {
      movie: 'silent-wills', format: '2D', cinemaId: '2', language: 'English', date: '2026-11-07'
    });
    assert.equal(document.querySelector('form'), originalForm);
    assert.equal(document.querySelector('[data-date-stamp] strong').textContent, '07');
    assert.equal(document.querySelector('[data-date-stamp] small').textContent, 'Sat');
    assert.equal(document.querySelector('[data-date-stamp]').getAttribute('aria-hidden'), 'true');
    assert.equal(document.querySelector('[data-screenings]').textContent, 'Saturday screenings');
    assert.equal(document.querySelector('[data-booking-status]').textContent, 'Showtimes updated.');
    assert.equal(document.querySelector('[data-showtimes]').hasAttribute('aria-busy'), false);
  } finally {
    window.close();
  }
});
