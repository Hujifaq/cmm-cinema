const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

// Serve the npm distribution unchanged; no CDN or bundler is needed by Razor.
const destination = join(__dirname, '../wwwroot/lib/swiper');
mkdirSync(destination, { recursive: true });
for (const name of ['swiper-bundle.min.css', 'swiper-bundle.min.js', 'LICENSE']) {
  copyFileSync(join(__dirname, '../node_modules/swiper', name), join(destination, name));
}

// Lenis ships as a UMD build that exposes window.Lenis.
const lenis = join(__dirname, '../wwwroot/lib/lenis');
mkdirSync(lenis, { recursive: true });
for (const [from, to] of [['dist/lenis.min.js', 'lenis.min.js'], ['dist/lenis.css', 'lenis.css'], ['LICENSE', 'LICENSE']]) {
  copyFileSync(join(__dirname, '../node_modules/lenis', from), join(lenis, to));
}
