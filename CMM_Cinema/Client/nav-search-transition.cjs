/* Collapse completely, then reveal the next surface at the same anchor. */
function createNavSearchTransition({ gsap, nav, top, stage, onReveal, onConceal, onOpened, onClosed }) {
  const rect = nav.getBoundingClientRect();
  const target = stage.getBoundingClientRect();
  gsap.set(nav, { height: rect.height, marginInline: 'auto', overflow: 'hidden' });
  gsap.set(stage, { width: 0, autoAlpha: 0 });
  const timeline = gsap.timeline({ paused: true, onComplete: onOpened, onReverseComplete: onClosed });
  timeline
    .fromTo(top, { opacity: 1 }, { opacity: 0, duration: .18, ease: 'power3.out', immediateRender: false }, 0)
    .fromTo(nav, { width: rect.width, opacity: 1 }, {
      width: 0, duration: .42, ease: 'power3.inOut', immediateRender: false
    }, 0)
    .to(nav, { opacity: 0, duration: .06, ease: 'none' }, .36)
    // Both surfaces are invisible between .42 and .46, in either direction.
    .call(() => {
      if (timeline.reversed()) onConceal?.();
      else onReveal?.();
    }, [], .46)
    .to(stage, { autoAlpha: 1, duration: .01, ease: 'none' }, .46)
    .fromTo(stage, { width: 0 }, {
      width: target.width, duration: .8, ease: 'elastic.out(1, 0.5)', immediateRender: false
    }, .46);
  return timeline;
}
module.exports = { createNavSearchTransition };
