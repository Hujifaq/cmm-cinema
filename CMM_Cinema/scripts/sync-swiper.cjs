const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

// Serve the npm distribution unchanged; no CDN or bundler is needed by Razor.
const destination = join(__dirname, '../wwwroot/lib/swiper');
mkdirSync(destination, { recursive: true });
for (const name of ['swiper-bundle.min.css', 'swiper-bundle.min.js', 'LICENSE']) {
  copyFileSync(join(__dirname, '../node_modules/swiper', name), join(destination, name));
}
