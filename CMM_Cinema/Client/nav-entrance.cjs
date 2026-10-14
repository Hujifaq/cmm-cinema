/* Latch the page entrance once; focus and Spotlight must never restart it. */
function stabilizeNavEntrance(nav, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null;
  let disposed = false;
  const finish = () => {
    if (disposed) return;
    nav.setAttribute('data-nav-entered', '');
    if (timer !== null) { clearTimer(timer); timer = null; }
  };
  const dispose = () => {
    finish();
    disposed = true;
    nav.removeEventListener('focusin', finish);
    nav.removeEventListener('pointerdown', finish, true);
  };
  nav.addEventListener('focusin', finish);
  nav.addEventListener('pointerdown', finish, true);

  if (nav.getAnimations) {
    const entrance = nav.getAnimations({ subtree: true }).filter(animation =>
      animation.animationName?.startsWith('cinema-nav-'));
    if (!entrance.length) finish();
    else {
      // Include delayed child animations, not just the navbar's shorter shell.
      Promise.allSettled(entrance.map(animation => animation.finished)).then(finish);
    }
  } else {
    // Older engines: the last label ends at 985ms, after the 850ms shell.
    timer = setTimer(finish, 1100);
  }
  return { finish, dispose };
}
module.exports = { stabilizeNavEntrance };
