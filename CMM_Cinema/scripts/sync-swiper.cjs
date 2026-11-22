const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');


const destination = join(__dirname, '../wwwroot/lib/swiper');
mkdirSync(destination, { recursive: true });
for (const name of ['swiper-bundle.min.css', 'swiper-bundle.min.js', 'LICENSE']) {
  copyFileSync(join(__dirname, '../node_modules/swiper', name), join(destination, name));
}


const lenis = join(__dirname, '../wwwroot/lib/lenis');
mkdirSync(lenis, { recursive: true });
for (const [from, to] of [['dist/lenis.min.js', 'lenis.min.js'], ['dist/lenis.css', 'lenis.css'], ['LICENSE', 'LICENSE']]) {
  copyFileSync(join(__dirname, '../node_modules/lenis', from), join(lenis, to));
}


const gsapLib = join(__dirname, '../wwwroot/lib/gsap');
mkdirSync(gsapLib, { recursive: true });
copyFileSync(join(__dirname, '../node_modules/gsap/dist/ScrollTrigger.min.js'), join(gsapLib, 'ScrollTrigger.min.js'));
