# CMM Cinema — Design System

This is the source of truth for how CMM Cinema looks and moves. Read it before
building or changing any page, component, or animation so that new work matches
what already exists. When this file and the code disagree, the code wins; update
this file in the same change.

Also follow [AGENTS.md](AGENTS.md) (styling conventions and build rules).

---

## 1. The feel in one paragraph

A **playful, tactile, premium cinema**. Deep teal-to-cyan night scenes sit next to
warm cream "paper" pages. Type is **huge, black-weight, uppercase and tightly
tracked**. Surfaces are either **frosted dark glass** (navbar, quick book, search)
or **soft clay** (ticket cards with puffy inner highlights). Almost everything is
a **full pill** (`rounded-full`) or a generous rounded rectangle (16–32px).
Motion is the main personality: things **morph** rather than appear. Pills melt
into each other like liquid (goo), sheets slide in with rounded corners that
flatten as they land, letters rise out of masks, buttons lean toward the cursor
and spring back elastically. Motion is confident but quick, and it always
respects `prefers-reduced-motion`.

**Keywords:** gooey, elastic, clay, glass, cream-on-ink, masked reveals, magnetic,
hand-drawn marker highlights.

**Avoid:** flat corporate blue, thin/light headings, sharp square corners, plain
fades as the only entrance, linear easing (except the marquee), drop-shadow-heavy
material cards, new fonts, new hues outside the palette.

---

## 2. Stack and where things live

| Concern | Where |
| --- | --- |
| Framework | ASP.NET Core MVC, Razor views (`CMM_Cinema/Views`) |
| Main layout | `Views/Shared/_HeroLayout.cshtml` — use this for every real page. (`_Layout.cshtml` is the old Bootstrap scaffold; don't build on it.) |
| Design tokens + custom CSS | `CMM_Cinema/Styles/tailwind.css` (Tailwind v4 `@theme`) |
| Generated CSS | `wwwroot/css/styles.css` — **never edit**; run `npm run css:build` from `CMM_Cinema` |
| Hand-written CSS | `wwwroot/css/hero.css` (hero composition), `cinema-nav.css` (nav entrance/state), `page-transition.css` (view transitions) |
| Page/component JS | `wwwroot/js/*.js` — plain IIFEs, one file per behaviour, wired by `data-*` attributes |
| React islands | `Client/*.tsx` + `components/ui/*.tsx`, bundled with esbuild (`npm run build`) |
| Animation libs | GSAP 3 + SplitText (global `window.gsap`), Lenis smooth scroll, Swiper carousels, framer-motion (Spotlight search only) |
| Vendor files | `wwwroot/lib/**` — **never modify** |

Bootstrap supplies the CSS reset (Tailwind Preflight is off), so set `m-0` on
headings/paragraphs and `border-0 bg-transparent p-0` on bare buttons yourself.

**Conventions**
- Style with Tailwind utilities in Razor. Use custom CSS only for artwork, SVG
  tricks, animation states, and selector-driven state (see AGENTS.md).
- JS hooks use `data-*` attributes (`data-goo-button`, `data-ticket-card`…), never
  styling classes.
- Long or repeated class strings go in a Razor variable at the top of the view
  (`var tabClass = "...";`).
- Every behaviour script starts with a guard: element missing / no GSAP /
  reduced motion → bail out and leave the page fully usable.

---

## 3. Color

All shared colors are tokens in `Styles/tailwind.css` and become Tailwind
utilities (`bg-cinema-ink`, `text-cinema-cream`, `ring-cinema-ink/10`…). Use the
tokens, not hex values, in markup.

### 3.1 Core palette

| Token | Hex | Role |
| --- | --- | --- |
| `cinema-ink` | `#071c1e` | Primary text on light pages, dark buttons, chips, tab fill, focus outlines on light bg |
| `cinema-deep` | `#103d3e` | Page background behind everything (`<html>`), `theme-color`, promo slide bg |
| `cinema-cream` | `#fffde6` | Text on dark, active nav pill, primary light buttons, ticket stub on detail page |
| `cinema-paper` | `#fffdf5` | Background of all content pages/sections (movies, tickets, news) |
| `cinema-linen` | `#fbf6e8` | Warm end of the ticket-stub gradient |
| `cinema-cyan` | `#29d9dd` | Bright accent: mobile menu sheet, active mobile link, hover on dark, goo fill for upcoming tickets |
| `cinema-sky` | `#6fd8e4` | Soft accent: poster art, goo fill for past tickets |
| `cinema-sun` | `#ecc861` | Warm accent: poster art |
| `cinema-brick` | `#b94734` | Warm accent: poster art, "Book Now!" goo fill |
| `cinema-logo` | `#1a4466` | Logo navy: "Confirmed" pill, ticket counts, seat chips, "Showtimes" goo fill |
| `cinema-spotlight` | `#1c2c2e` | Dark surface for the search overlay |
| `cinema-nav-hover` | `rgba(255,255,255,.08)` | Hover wash on dark glass (nav actions, quick-book fields) |

### 3.2 Two worlds

1. **Night (dark)** — hero, navbar, marquee, promos, search, quick book.
   Backgrounds: `cinema-deep`, black, or black glass. Text: `cinema-cream` /
   white with opacity steps (`white/65`, `white/60`, `white/40`).
2. **Paper (light)** — every content section. Background `cinema-paper`, text
   `cinema-ink`, secondary text `cinema-ink/60`, tertiary `cinema-ink/50`,
   dividers `cinema-ink/10`–`/30`, subtle fills `cinema-ink/[0.04]`–`/[0.07]`.

Paper sections **overlap the dark one above them** with a big rounded top:
`-mt-12 rounded-t-[40px] md:-mt-16 md:rounded-t-[56px]` (see `_MovieSection`),
and the promos use `--promo-overlap: clamp(24px, 3vw, 48px)`.

### 3.3 Gradients

- **Hero sky:** `linear-gradient(128deg, #020c0d 2%, #124d4e 38%, #218e91 70%, #29d9dd 100%)` (near-black → deep teal → cyan).
- **Ticket stub:** `bg-linear-to-br from-white to-cinema-linen`.
- **Movie glass overlay:** `linear-gradient(145deg, rgba(255,255,255,.16), transparent 38%), rgba(4,6,8,.82)`.
- **View-transition backdrop:** pure `#000`.

### 3.4 Marker highlight colors (randomised on hover)

Hand-drawn highlighter strokes behind titles pick a random color on each hover,
never repeating the previous one. Set via the CSS variable `--highlight-color`.

- Movie cards (`now-showing.js`): `#fde047 #f9a8d4 #86efac #7dd3fc #fdba74 #c4b5fd`
- Ticket cards (`my-tickets.js`): `#fde047 #6fd8e4 #f9a8d4 #86efac #fdba74 #c4b5fd #fca5a5`
- News "Read more" (`news.js`): `#34d399 #f472b6 #fb923c #60a5fa #a78bfa #facc15`
- Default when unset: `#fde047` (yellow).

These pastel/vivid marker colors are the **only** place colors outside the core
palette are allowed.

### 3.5 Drawn poster themes

Movies without a `PosterUrl` get a generated geometric poster (`_MoviePoster`):
`ink-orbit`, `sky-arch`, `sun-eclipse`, `brick-stripes`, `brick-orbit`,
`sun-arch`, `ink-eclipse`, `sky-stripes`. Each is a solid palette background +
one big shape (circle, arch, eclipse, 120° stripes) + huge black uppercase title
at the bottom + a rating pill top-left. Add new themes in the same style
(two palette colors, one bold shape).

---

## 4. Typography

- **Font:** the system sans stack (`font-sans`). The hero logotype and Movies
  page tabs use `"Arial Black", "Helvetica Neue", Arial, sans-serif`. Do not add
  web fonts.
- **Display headings:** `font-black uppercase tracking-tighter leading-[0.9]`
  (or `leading-none`).
  - Page titles: `text-5xl sm:text-6xl lg:text-7xl`
  - Section titles: `text-5xl sm:text-7xl md:text-8xl lg:text-[8rem]`
  - Sub-sections (e.g. "Cast", "E-Receipt"): `text-3xl md:text-4xl`
- **Card titles:** `text-lg font-extrabold leading-tight` up to `text-2xl/3xl font-black uppercase`.
- **Eyebrows / labels:** `text-[10px] font-bold uppercase tracking-widest text-cinema-ink/60`
  (or `text-[11px] tracking-[0.2em] text-cinema-ink/50` for section labels).
- **Body:** `text-base md:text-lg leading-relaxed text-cinema-ink/80`.
- **Buttons/links:** `text-sm font-bold` (or `font-semibold`).
- **Codes:** booking codes / seats use `font-mono font-bold tracking-[0.2em]`.
- **Inline meta lists:** items separated by `border-l border-cinema-ink/30 px-3 first:border-l-0 first:pl-0`.
- Root size: 14px on phones, 16px from 768px.

---

## 5. Shape, spacing, layout

- **Radius scale:** pills `rounded-full` (buttons, chips, tabs, nav, inputs);
  `rounded-2xl` (16px — posters, thumbnails); `rounded-[26px]`–`[28px]`
  (panels, detail cards); `rounded-[32px]` (ticket cards, mobile nav, quick book
  on phones); `rounded-t-[40px]/[56px]` (overlapping section tops).
- **Containers:** `mx-auto max-w-[1440px] px-5 md:px-12` for wide pages;
  `max-w-6xl` for ticket pages.
- **Page top padding:** content pages start with `pt-32 md:pt-40` to clear the
  floating navbar; bottom `pb-16 md:pb-24`.
- **Touch targets:** at least `min-h-11` (44px); main buttons `min-h-12`.
- **Carousels bleed:** Swiper containers use `overflow: visible` and the section
  clips them, so cards run off the screen edge.
- **Focus:** always `focus-visible:outline-2 focus-visible:outline-offset-2/4`
  with `outline-cinema-ink` on light, `outline-cinema-cream` / `outline-cinema-cyan` on dark.
- **Print:** ticket pages hide the nav and buttons (`print:hidden`) and swap
  dark fills for outlines.

---

## 6. Surfaces

### 6.1 Dark glass (navbar, quick book, search)

```
bg-black/55 backdrop-blur-xl backdrop-saturate-150
ring-1 ring-inset ring-white/15
shadow-[0_8px_32px_#0003,inset_0_1px_0_#ffffff14]
rounded-full   (rounded-[32px] on phones)
```
The 1px inner top highlight (`inset_0_1px_0_#ffffff14`) is what makes it read
as glass — keep it.

### 6.2 Claymorphism (ticket cards)

Tokens in `@theme` → utilities `shadow-clay`, `shadow-clay-hover`,
`shadow-clay-stub`, `shadow-clay-raised`, `shadow-clay-pill`.

- `shadow-clay`: soft long drop shadow outside + bright white inset top-left rim
  + faint dark inset bottom-right. Card is `bg-white rounded-[32px]`.
- Hover: lift `-translate-y-1.5` and swap to `shadow-clay-hover` over 500ms
  `cubic-bezier(0.22,1,0.36,1)`.
- `shadow-clay-stub`: inner-only shading for the tear-off stub.
- `shadow-clay-raised`: small poster floating on the card.
- `shadow-clay-pill`: glossy "Confirmed" pill (inset light top, inset dark bottom).
- **Ticket notches:** half-circle cut-outs where the stub tears, painted in
  `bg-cinema-paper` with `shadow-[inset_0_0_6px_rgb(7_28_30/0.14)]` so they read
  as pressed-in holes; the divider is `border-dashed border-cinema-ink/20`.

### 6.3 Movie glass overlay

On poster hover, a dark frosted panel (`backdrop-blur-xl`, gradient from §3.3,
`border-white/20`) shows runtime, rating, title, genre and synopsis.

### 6.4 Clay tube artwork (hero)

The background lines in the hero are shaded SVG "clay tubes" (generated
geometry in `_ClayLineLargeGeometry` / `_ClayLineSmallGeometry`, sources in
`wwwroot/images/hero`). They are generated — regenerate from the scripts rather
than hand-editing paths.

---

## 7. Motion system

### 7.1 Principles

1. **Morph, don't pop.** Prefer a shape changing into another (pill → droplets
   → pill, circle → sheet, small pill → wide search bar) over fading in place.
2. **Ease out, overshoot a little.** Entrances use `power3/4.out`, `expo.out`,
   `back.out(1.6–2.2)` or `elastic.out(1, 0.3–0.55)`. Exits are faster and use
   `.in` / `.inOut`.
3. **Stagger everything that comes in a group** (letters 0.025–0.065s, items
   0.06–0.1s).
4. **Masked reveals for text.** Letters/lines rise from `yPercent: 105–110`
   inside a clip mask; never just fade text.
5. **Pointer-reactive only on fine pointers.** Hover/magnetic/tilt logic checks
   `(hover: hover) and (pointer: fine)` and `pointerType === 'mouse'`.
6. **Reduced motion = no motion**, not slower motion. Every script and CSS
   animation has a `prefers-reduced-motion: reduce` branch that shows the final
   state immediately.
7. **Never leave content hidden.** If JS fails, content must still appear (see
   the reveal guard, §7.4).
8. **Clean up:** `clearProps` after tweens, revert SplitText on complete, kill on
   `pagehide`.

### 7.2 Easing vocabulary

| Name | Value | Used for |
| --- | --- | --- |
| Signature out | `cubic-bezier(0.22, 1, 0.36, 1)` | CSS hovers: poster tilt, glass morph, clay lift, nav entrance |
| Page swing | `cubic-bezier(0.625, 0.05, 0, 1)` (`--page-ease`) | Page view transitions |
| Snappy out | `cubic-bezier(0.23, 1, 0.32, 1)` | Nav action pill FLIP, promo swiper |
| Marker sweep | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Highlight wipe, news underline |
| Symmetric | `cubic-bezier(0.65, 0, 0.35, 1)` | Ticket tab fill shrinking, tab text color |
| Expo out | `cubic-bezier(0.16, 1, 0.3, 1)` | Ticket tab fill growing |
| Springy | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Chevron rotate, empty-state icon wobble |
| GSAP | `power3.out`, `power4.out`, `expo.out`, `back.out(n)`, `elastic.out(1, n)` | JS entrances and releases |

### 7.3 Duration guide

- Micro (color, opacity, hover wash): 120–300ms
- Hover transforms: 220–720ms
- Entrances: 0.6–1.15s per element, whole page sequence ≤ ~1.5s
- Elastic settle / release: 0.6–1s
- Page transition: 0.9s total
- Exits: roughly half the entrance

### 7.4 The reveal guard pattern (use for every new animated page)

Content that GSAP will animate in is hidden by CSS until the script marks the
root as revealed, with a 3s safety unhide if scripts never run:

```css
@media (prefers-reduced-motion: no-preference) {
  [data-my-page]:not([data-revealed]) :is([data-reveal-chars], [data-reveal-up]) {
    visibility: hidden;
    animation: movie-detail-unhide 0s 3s forwards;
  }
}
```

The script then: waits for `document.fonts.ready` + one `requestAnimationFrame`,
builds the timeline with `.from()` states (already applied), **then** sets
`data-revealed`. If the user arrived through a page transition
(`html[data-page-arrived]`), delay the timeline by `0.55s` so the new page lands
first; otherwise `0.1s`. See `movie-detail.js` and `my-tickets.js`.

Standard reveal attributes:
- `data-reveal-chars` — SplitText chars with `mask: 'chars'`, `yPercent: 110`, stagger 0.025–0.03, `power4.out`
- `data-reveal-lines` — SplitText lines with mask, `yPercent: 105`
- `data-reveal-up` — `y: 14, autoAlpha: 0`, `power3.out`, stagger 0.06
- `data-reveal-cast` — avatar `scale: 0 → 1` with `back.out(2)`, text slides from `x: -10`

---

## 8. Signature effects (catalog)

### 8.1 Gooey WebGL navbar pill — `gooey-nav.js`

The active desktop nav item has a **cream (`#fffde6`) liquid pill** drawn on a
WebGL2 canvas using signed-distance fields. When the selection changes, the pill
**breaks into up to 15 droplets** that fly along random Bézier paths
(≈600ms ± 300ms variance, spread 40px) and **smooth-merge** back into a pill
under the new item, with spring settling and a white rim highlight. It handles
rapid retargeting mid-flight. Hover shows a faint `rgba(255,255,255,.08)` pill.
Labels are duplicated in a black overlay layer clipped to the pill so text
inverts cleanly. No WebGL → a solid cream fallback pill. Navigation waits 650ms
so the goo finishes before the page changes.

### 8.2 Navbar entrance — `cinema-nav.css` + `Client/nav-entrance.cjs`

On first load the glass bar **opens from the centre**:
`clip-path: inset(0 44% 0 44% round 999px) → inset(0 round 999px)` with
`translateY(-16px → 0)`, 850ms signature-out. Logo fades up at 320ms, nav at
400ms, each label staggers in at `440ms + index × 65ms`. It plays once and is
latched (`data-nav-entered`) on finish or first interaction; it never replays on
focus, search close, or arriving via a page transition.

### 8.3 Mobile menu sheet morph — `cinema-nav.js`

Below 768px, "Menu" text flips to "Close" (vertical text roll, 300ms). Three
stacked sheets — **cyan, gray `#616a6c`, charcoal `#121617`** — slide in from the
right with stagger 0.075s, `power4.out`, 0.7s. Each starts as `xPercent: 100,
scaleX: 0.82, borderRadius: 50% 0 0 50%` (a half-circle bulge) and **morphs into
a flat `32px 0 0 32px` sidebar** as it lands. Large labels (`clamp(2rem,8vw,3.5rem)`)
rise from `yPercent: 140, rotation: 8` through masks, stagger 0.085s. Closing
reverses faster (0.38s, `power3.inOut`). Active item is cyan.

### 8.4 Nav action hover pill (FLIP) — `cinema-nav-actions.js`

One shared translucent pill slides between the Search and Login buttons on
hover/focus using a FLIP transform animation (240ms, `cubic-bezier(0.23,1,0.32,1)`).
It scales from the old button's box to the new one, so the capsule seems to
stretch and travel.

### 8.5 Navbar → search morph — `Client/nav-search-transition.cjs` + Spotlight

Opening search: nav contents fade (0.18s), the whole bar **collapses in width
to 0** (0.42s, `power3.inOut`), then the search stage **springs open** from 0
to full width (0.8s, `elastic.out(1, 0.5)`), anchored in the same spot. The
Spotlight panel (framer-motion) enters with a spring (stiffness 170, damping 17)
from a blurred, stretched state and exits with `blur(20px)`, `scaleX 1.3`. The
input container uses a shared `layoutId` so it morphs between states. Hovering a
movie result floats a **poster preview beside the cursor** that follows with
`quickTo` (0.5s) and tilts up to ±12° based on horizontal speed, popping in with
`back.out(1.7)`.

### 8.6 Page transitions — `page-transition.css`

Desktop only (≥768px, motion allowed), cross-document View Transitions on a
black stage: the old page **shrinks to 0.8 from its bottom edge, then swings
out left** (`translate -50%`, `rotate -5deg`); the new page **swings in from the
right** (`translate 100%`, `rotate 5deg`, `scale 0.85 → 1`). 0.9s with
`--page-ease`. The navbar has its own `view-transition-name` and stays perfectly
still. Pages arriving this way get `html[data-page-arrived]`.

### 8.7 Hero entrance — `hero.js` + `hero.css`

1. Clay tubes **draw themselves** via animated mask strokes (large: 1.8s and 2s,
   offset 0.12s; small loop: 1.25s from 0.2s; all `power2.out`).
2. "CMM" then "CINEMA" letters **pop up from `scale: 0.1`** with
   `elastic.out(1, 0.45)`, 1.15s, staggered 0.065s per letter (CMM at 0.18s,
   CINEMA at 0.32s). The cream fill and the cream outline layer on top are
   tweened together so they stay registered.
3. Props (glasses, star, clapperboard, popcorn) are **thrown in** by the physics
   engine about 1s before the timeline ends.

Composition is art-directed in `hero.css` with breakpoints for phone portrait,
tablet (≤4:3), ultra-wide (≥2:1) and landscape phones. The hero fills `h-dvh`.

### 8.8 Hero prop physics — `hero-physics.js`

After the entrance, props gently float. Cursor swipes (or taps) push and spin
them; they coast, bounce off the hero edges and each other (restitution 0.82,
fixed 1/120s step), then drift home. Paused when the tab is hidden, disabled for
reduced motion.

### 8.9 Promo marquee — `_CinemaMarquee`

Black strip above the nav, white 13–14px semibold text separated by `✦`.
Scrolls left infinitely (40s, linear — the only linear animation). Pauses on
hover and via a toggle. Reduced motion: static wrapped text.

### 8.10 Promo carousel + magnetic arrows — `cinema-promos.js`, `cinema-magnetic.js`

Swiper with peeking slides (1.04–1.08 per view), 700ms glide, rewind. Arrow
buttons are **magnetic**: the cream circle moves 50% toward the cursor and the
arrow icon 25%, 0.4s `power3.out`; on leave they snap back with
`elastic.out(1, 0.3)` over 1s. Keyboard navigation is instant.

### 8.11 Movie card hover — `tailwind.css` + `now-showing.js`

- **3D tilt:** up to ±1.2° following the pointer (`--tilt-x/--tilt-y`), plus
  `scale(1.012)`.
- **Glass morph:** the info overlay starts as a small blurred rounded blob in
  the centre (`clip-path: inset(43% round 42%)`, `scale .86`, `rotate 2deg`,
  `blur 3px`) and **expands into the full rectangle** (720ms signature-out).
- **Poster** behind darkens/desaturates and scales 1.025.
- **Glare:** a 180px radial highlight follows the pointer (`mix-blend-mode: screen`).
- **Marker highlight:** the title's hand-drawn highlighter **wipes in left to
  right** (`clip-path: inset(0 100% 0 0) → inset(0)`, 650ms) in a random color.

### 8.12 News section — `news.js`

- "Read more" has a **hand-drawn double underline** that **melts into a full
  highlighter block** on hover (underline squashes `scaleY .2` and fades; block
  grows from `scaleY .15`).
- Clicking a thumbnail: the card **flies up into the feature frame** (0.9s
  `power3.inOut`), the remaining cards close the gap with FLIP, the outgoing
  story re-enters the row from off-screen left, and the text swaps line by line
  (old lines slide up out of masks, new lines rise in).
- Thumbnails zoom to 1.04 on hover (600ms).

### 8.13 Gooey buttons — `_GooButton` + `_GooFilter` + `goo-button.js`

Ink pill with a cream label. An SVG goo filter (`feGaussianBlur stdDeviation 6`
+ alpha matrix `20 -8`) fuses shapes. On hover an **accent fill floods from the
exact entry point** (0.6s) while a **blob stretches out of the pill toward the
cursor** and bulges past the edge. The whole layer leans slightly toward the
pointer. On leave the blob is **pulled out past the exit point and pinches off**.
Press squashes (`scaleX 1.06, scaleY .88`) and releases with
`elastic.out(1, 0.35)`. Keyboard focus floods from the centre. The page must
include `@await Html.PartialAsync("_GooFilter")` once.

```razor
@await Html.PartialAsync("_GooButton", (Label: "Book Now!", Href: "#", Accent: "bg-cinema-brick"),
    new ViewDataDictionary(ViewData) { ["GooLightLabel"] = true })
```
Accents in use: `bg-cinema-brick`, `bg-cinema-logo`, `bg-cinema-cyan`, `bg-cinema-sky`.
Use `GooLightLabel` for dark accents (label stays cream), omit it for light ones
(label turns ink).

### 8.14 Quick Book — `_QuickBook` + `quick-book.js`

A dark-glass pill form. Custom listbox dropdowns **ooze out of the trigger**:
a black blob scales in with `elastic.out(1, 0.55)` while two goo droplets drip
away (SVG filter `qb-goo`), options blur-rise in with stagger 0.035s. The active
option is marked by a **cream liquid pill** with tails (`qb-goo-sm`) that slides
between options with `elastic.out(1, 0.75)`. Closing squashes the blob to a line.
Chosen label rolls (old up, new in with `back.out(2.2)`). Submit button: an ink
circle **floods the whole button** on hover (label turns cream, arrow rotates
-45°), the button leans toward the cursor, presses to 0.95 and releases
elastically. Missing field → trigger shakes (`x: -8, 7, -5, 3, 0`).

### 8.15 My Tickets — `my-tickets.js`

- Tabs: each tab has an ink fill that **grows as a circle from its centre**
  when selected (`circle(0%) → circle(75%)`, 850ms expo-out) and shrinks when
  deselected (600ms). The count badge pops (`scale .4 → 1`, `back.out(3)`).
- Card entrance (page load and tab switch): card rises `y: 48`, poster
  **wipes up** (`clip-path: inset(100% 0 0 0 round 16px) → inset(0)`), stub
  **tears into place** from `x: 24, rotate: 3` with `back.out(1.6)`, then the
  button pops. 0.1s between cards.
- Hover: clay lift, poster zooms 1.06 and tilts -1°, random marker highlight.
- Empty state: dashed rounded box with a ticket icon that wobbles on hover.

### 8.16 Movie detail — `movie-detail.js`

Poster **unmasks upward** (`clip-path` 1.1s expo-out) while its image settles
from `scale 1.25`; eyebrow line and title letters rise through masks; meta
items fade up; goo buttons pop in with `back.out(1.6)`; cast avatars scale in.

### 8.17 Section titles — `Client/now-showing-title.tsx`

`[data-section-title]` is mounted as a React SplitText: letters **rise** in when
scrolled into view (1.25s, 50ms stagger), and on hover letters near the cursor
**lift on a spring** (stiffness 180, damping 19). Other effects available in
`components/ui/split-text.tsx`: `fade`, `blur`, `flip`, `pop`, `skew`, `wave`.

### 8.18 Smaller details

- Movies page tabs: giant Arial Black words; inactive at `cinema-ink/35`.
  Switching re-staggers cards in (`y: 28`, 0.6s, stagger 0.05).
- Breadcrumb: muted links, chevron separators, current page in an
  `bg-cinema-ink/[0.07]` pill.
- Quick-book chevron rotates 180° with the springy curve.
- Smooth scrolling everywhere via Lenis (`lerp: 0.14`), off for reduced motion.

---

## 9. Recipes

### New content page

```razor
@{ Layout = "_HeroLayout"; ViewData["Title"] = "Page - CMM Cinema"; }

<section class="min-h-screen overflow-x-clip bg-cinema-paper pb-16 pt-32 font-sans text-cinema-ink md:pb-24 md:pt-40" data-my-page>
    @await Html.PartialAsync("_GooFilter")
    <div class="mx-auto max-w-[1440px] px-5 md:px-12">
        @await Html.PartialAsync("_Breadcrumb", new (string, string?)[] { ("Home", "/"), ("Page", null) })
        <h1 class="m-0 text-5xl font-black uppercase leading-[0.9] tracking-tighter sm:text-6xl lg:text-7xl" data-reveal-chars>Page</h1>
        ...
    </div>
</section>
```
Then add a reveal guard in `tailwind.css` (§7.4), a `wwwroot/js/my-page.js`
modelled on `movie-detail.js`, register the script in `_HeroLayout.cshtml`
(`defer`), and run `npm run css:build`.

### Buttons — pick one

| Need | Use |
| --- | --- |
| Main call to action | `_GooButton` |
| Primary on light | `rounded-full bg-cinema-ink text-cinema-cream min-h-12 px-6 text-sm font-bold` |
| Secondary on light | same with `border border-cinema-ink bg-transparent text-cinema-ink` |
| Primary on dark | `rounded-full bg-cinema-cream text-cinema-ink hover:bg-white` |
| Text link | `border-b-2 border-cinema-ink pb-0.5 text-sm font-bold no-underline` or the marker highlight |
| Status chips | `rounded-full px-3 py-1.5 text-[11px] font-bold leading-none` — `bg-cinema-logo text-white shadow-clay-pill` (active) or `border border-cinema-ink/40` (muted) |

### Title with marker highlight

```razor
<span class="relative inline-block"><span class="relative z-10">@Title</span>@await Html.PartialAsync("_AnnotationHighlight")</span>
```
Put it inside an element with `data-movie-card` or `data-ticket-card` for the
hover wipe, and set `--highlight-color` from JS for the random color.

---

## 10. Checklist before you finish

- [ ] Only palette tokens used (marker colors excepted); no new fonts.
- [ ] Headings are black-weight uppercase with tight tracking.
- [ ] Rounded pills / large radii; no sharp corners.
- [ ] Entrance uses masked or morphing motion with stagger, not a bare fade.
- [ ] Hover effects gated to fine pointers; touch still works.
- [ ] `prefers-reduced-motion: reduce` shows everything instantly.
- [ ] Content is visible if JS or GSAP fails (reveal guard with 3s fallback).
- [ ] Focus-visible outlines present; touch targets ≥ 44px.
- [ ] Works at 320px wide with no horizontal scroll.
- [ ] `npm run css:build` run; `styles.css` and `wwwroot/lib` not hand-edited.
- [ ] `npm test` still passes if you touched nav, hero, promos, or search.
