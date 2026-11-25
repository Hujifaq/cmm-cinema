const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const viewsRoot = join(__dirname, '../Views');
const layout = readFileSync(join(viewsRoot, 'Shared/_HeroLayout.cshtml'), 'utf8');

const hooks = {
  hero: [/\bcinema-hero\b/],
  swiper: [/data-movie-swiper/, /data-movie-grid/, /data-news-swiper/, /data-cinema-promos/],
  'section-title': [/data-section-title/],
  'movie-carousel': [/data-movie-swiper/, /data-movie-grid/],
  'movie-cursor': [/data-movie-swiper/],
  promos: [/data-promo-ribbon/, /data-magnetic-arrow/, /data-cinema-promos/],
  news: [/data-news\b/],
  'quick-book': [/data-qb-form/],
  'movie-detail': [/data-movie-detail/],
  'my-tickets': [/data-tickets-page/],
  signup: [/data-signup-page/],
  'forgot-password': [/data-forgot-password-page/, /data-reset-password-page/],
  profile: [/data-profile-page/],
  'ajax-form': [/data-ajax-form/],
  'admin-movies': [/data-delete-dialog/, /data-cast-list/, /data-edit-toggle/],
  'admin-news': [/data-admin-story-delete-dialog/, /data-cover-input/],
  'admin-promotions': [/data-admin-promo-delete-dialog/, /data-promo-input/],
  'admin-tickets': [/data-admin-ticket-filter/, /data-admin-ticket-dialog/]
};

const views = (function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.cshtml') ? [path] : [];
  });
})(viewsRoot).filter(path => !path.endsWith('_HeroLayout.cshtml') && !path.endsWith('_Layout.cshtml'));

const requested = source => [...source.matchAll(/RequireAssets\(([^)]*)\)/g)]
  .flatMap(match => [...match[1].matchAll(/"([^"]+)"/g)].map(name => name[1]));

test('every view with a behaviour hook requests that behaviour\'s assets', () => {
  const missing = [];
  for (const path of views) {
    const source = readFileSync(path, 'utf8');
    const assets = requested(source);
    for (const [asset, patterns] of Object.entries(hooks)) {
      if (patterns.some(pattern => pattern.test(source)) && !assets.includes(asset)) {
        missing.push(`${relative(viewsRoot, path)} needs "${asset}"`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('the layout only gates assets that views can request', () => {
  const gated = [...layout.matchAll(/RequiresAsset\("([^"]+)"\)/g)].map(match => match[1]);
  assert.deepEqual([...new Set(gated)].sort(), Object.keys(hooks).sort());
});
