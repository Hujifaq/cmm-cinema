import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import { Activity, Files, Folder, LayoutGrid, Ticket } from 'lucide-react';
import { AppleSpotlight, type SearchResult } from '../components/ui/apple-spotlight';
// The small bridge stays testable independently of React and the browser renderer.
// @ts-expect-error Local CommonJS module uses the project's existing GSAP runtime.
import { createNavSearchTransition } from './nav-search-transition.cjs';
// @ts-expect-error Local CommonJS lifecycle bridge.
import { stabilizeNavEntrance } from './nav-entrance.cjs';

interface Timeline { play(): void; reverse(): void; kill(): void; progress(value: number, suppressEvents?: boolean): void }
interface Gsap { set(target: Element | Element[], values: Record<string, unknown>): void }
declare global { interface Window { gsap?: Gsap } }
interface Offer extends SearchResult { id: number; slide: HTMLElement; section: HTMLElement }
const normalize = (node: Element | null) => (node?.textContent || '').replace(/\s+/g, ' ').trim();
const offers: Offer[] = [...document.querySelectorAll<HTMLElement>('[data-cinema-promos] .promo-slide')].map((slide, id) => ({
  id, icon: <Ticket />, link: `#cinema-promotion-${id}`, slide, section: slide.closest<HTMLElement>('[data-cinema-promos]')!,
  label: normalize(slide.querySelector('h3')),
  description: normalize(slide.querySelector('[data-promo-offer]')),
  keywords: normalize(slide).toLocaleLowerCase()
}));
const nav = document.querySelector<HTMLElement>('[data-cinema-nav]')!;
const top = nav.querySelector<HTMLElement>('[data-nav-top]')!;
const trigger = nav.querySelector<HTMLButtonElement>('[data-nav-search]')!;
const mount = document.getElementById('cinema-search-root')!;
const entrance = stabilizeNavEntrance(nav);
window.addEventListener('pagehide', entrance.dispose, { once: true });

function CinemaSearch() {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [departing, setDeparting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timeline = useRef<Timeline | null>(null);
  const requestedOpen = useRef(false);
  const restoreFocus = useRef(true);
  const instant = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();

  const finishClosed = useCallback(() => {
    if (requestedOpen.current) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    timeline.current?.kill(); timeline.current = null;
    for (const property of ['width', 'height', 'margin-inline', 'overflow', 'opacity']) nav.style.removeProperty(property);
    top.style.removeProperty('opacity');
    nav.inert = false;
    nav.removeAttribute('aria-hidden');
    nav.removeAttribute('data-search-mode');
    trigger.setAttribute('aria-expanded', 'false');
    setMounted(false); setReady(false); setRevealed(false); setDeparting(false);
    if (restoreFocus.current) trigger.focus({ preventScroll: true });
  }, []);
  const close = useCallback((restore = true) => {
    if (!requestedOpen.current) return;
    requestedOpen.current = false; restoreFocus.current = restore;
    setClosing(true); setReady(false);
    if (reduce || instant.current || !timeline.current) finishClosed();
    else {
      // Settle the field/tray and results before the outer morph reverses.
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        if (!requestedOpen.current) {
          setDeparting(true);
          if (stageRef.current) stageRef.current.dataset.settled = 'false';
          timeline.current?.reverse();
        }
      }, 550);
    }
  }, [reduce, finishClosed]);

  useEffect(() => {
    const open = (event: MouseEvent) => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = null;
      instant.current = event.detail === 0;
      requestedOpen.current = true; restoreFocus.current = true;
      const menu = nav.querySelector<HTMLButtonElement>('[data-nav-toggle]');
      if (menu?.getAttribute('aria-expanded') === 'true') menu.click();
      setClosing(false); setDeparting(false); setMounted(true);
      if (timeline.current) {
        if (stageRef.current?.dataset.settled === 'true') setReady(true);
        timeline.current.play();
      }
    };
    trigger.addEventListener('click', open);
    return () => trigger.removeEventListener('click', open);
  }, []);

  useLayoutEffect(() => {
    if (!mounted || !stageRef.current) return;
    const stage = stageRef.current;
    entrance.finish();
    nav.setAttribute('data-search-mode', '');
    nav.inert = true; nav.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'true');
    const rect = nav.getBoundingClientRect();
    const width = Math.min(768, rect.width);
    stage.style.left = `${rect.left + rect.width / 2}px`;
    stage.style.width = `${width}px`;
    stage.style.maxWidth = `${rect.width}px`;
    stage.style.setProperty('--spotlight-row-height', `${rect.height}px`);
    const alignStage = () => {
      // Width belongs to the morph. Scroll only updates the viewport anchor.
      const top = nav.getBoundingClientRect().top + (rect.height - 64) / 2;
      stage.style.top = `${top}px`;
      stage.style.setProperty('--spotlight-top', `${top}px`);
    };
    alignStage();
    window.addEventListener('scroll', alignStage, { passive: true });
    window.addEventListener('resize', alignStage);
    inputRef.current?.focus({ preventScroll: true });
    const opened = () => {
      if (!requestedOpen.current) return;
      stage.dataset.settled = 'true';
      inputRef.current?.focus({ preventScroll: true });
      setRevealed(true); setReady(true);
    };
    if (reduce || instant.current || !window.gsap) {
      nav.style.opacity = '0'; stage.style.opacity = '1'; stage.style.visibility = 'visible'; opened();
    } else {
      timeline.current = createNavSearchTransition({ gsap: window.gsap, nav, top, stage,
        onReveal: () => { if (requestedOpen.current) setRevealed(true); },
        onConceal: () => setRevealed(false), onOpened: opened, onClosed: finishClosed });
      timeline.current?.play();
    }
    return () => {
      window.removeEventListener('scroll', alignStage);
      window.removeEventListener('resize', alignStage);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = null;
      timeline.current?.kill(); timeline.current = null;
    };
  }, [mounted, finishClosed]);

  useEffect(() => {
    if (!mounted || !stageRef.current) return;
    if (!requestedOpen.current) { finishClosed(); return; }
    timeline.current?.progress(1, true);
    timeline.current?.kill(); timeline.current = null;
    stageRef.current.style.width = `${Math.min(768, parseFloat(stageRef.current.style.maxWidth))}px`;
    stageRef.current.style.visibility = 'visible';
    stageRef.current.dataset.settled = 'true';
    stageRef.current.style.opacity = '1';
    nav.style.opacity = '0';
    setRevealed(true); setReady(true);
    // A preference change settles the active morph instead of replaying it.
  }, [reduce]);

  useEffect(() => {
    if (ready) inputRef.current?.focus({ preventScroll: true });
  }, [ready]);

  useEffect(() => {
    if (!mounted) return;
    // A true modal: background controls cannot take focus while search is open.
    const siblings = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== mount && !['SCRIPT', 'STYLE'].includes(node.tagName));
    const previous = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); close(); }
      const resultLinks = [...mount.querySelectorAll<HTMLAnchorElement>('#cinema-search-results a')];
      if (event.key === 'Enter' && event.target === inputRef.current && inputRef.current?.value && resultLinks[0]) {
        event.preventDefault(); resultLinks[0].click();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const index = resultLinks.indexOf(event.target as HTMLAnchorElement);
        if (event.target === inputRef.current && resultLinks.length) {
          event.preventDefault(); resultLinks[event.key === 'ArrowDown' ? 0 : resultLinks.length - 1].focus();
        } else if (index >= 0) {
          event.preventDefault();
          (resultLinks[index + (event.key === 'ArrowDown' ? 1 : -1)] || inputRef.current)?.focus();
        }
      }
      if (event.key === 'Tab') {
        const controls = [...mount.querySelectorAll<HTMLElement>('input, button, a[href]')].filter(node => node.getClientRects().length > 0 && !node.closest('[inert]') && !node.matches(':disabled'));
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); controls[controls.length - 1]?.focus(); }
        else if (!event.shiftKey && (index < 0 || index === controls.length - 1)) { event.preventDefault(); controls[0]?.focus(); }
      }
    };
    const width = window.innerWidth;
    const reset = () => { requestedOpen.current = false; restoreFocus.current = true; finishClosed(); };
    const resize = () => { if (window.innerWidth !== width) reset(); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
    window.addEventListener('pagehide', reset);
    return () => {
      siblings.forEach((node, index) => { node.inert = previous[index]; });
      document.removeEventListener('keydown', onKey); window.removeEventListener('resize', resize); window.removeEventListener('pagehide', reset);
      // React effect cleanup restores the header before focus returns to its trigger.
      if (restoreFocus.current && !requestedOpen.current) trigger.focus({ preventScroll: true });
    };
  }, [mounted, close, finishClosed]);

  const select = (id: number) => {
    const offer = offers.find(item => item.id === id);
    if (!offer) return;
    requestedOpen.current = false; restoreFocus.current = false; finishClosed();
    const slider = offer.section.querySelector('[data-promo-swiper]') as HTMLElement & { swiper?: { slideTo(index: number, speed: number): void } };
    slider?.swiper?.slideTo(id, reduce ? 0 : 700);
    offer.section.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'center' });
  };
  return mounted ? <div className="cinema-spotlight fixed inset-0 z-50 font-sans text-cinema-cream"
    role="dialog" aria-modal="true" aria-label="Search cinema promotions" id="cinema-search"
    onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={stageRef} className="cinema-spotlight-stage absolute" style={{ opacity: 0 }}>
      <AppleSpotlight results={offers} onSelect={result => { if (result.id !== undefined) select(result.id); }}
        inputRef={inputRef} handleClose={() => close()} isOpen={revealed && !departing} interactive={ready && !closing}
        shortcuts={[
          { label: 'Promotions', icon: <LayoutGrid />, link: '#cinema-promotions', query: ' ' },
          { label: 'Midweek', icon: <Folder />, link: '#cinema-midweek', query: 'Wednesday' },
          { label: 'Late shows', icon: <Activity />, link: '#cinema-late', query: 'late' },
          { label: 'Students', icon: <Files />, link: '#cinema-students', query: 'student' }
        ]} />
    </div>
  </div> : null;
}

if (nav && trigger && mount) createRoot(mount).render(<MotionConfig reducedMotion="user"><CinemaSearch /></MotionConfig>);
