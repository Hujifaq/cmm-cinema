# CMM Cinema

ASP.NET Core MVC application targeting .NET 10.

## Cinema hero

The home page uses a dedicated `_HeroLayout` with a floating glass navbar and
no footer. `_CinemaNav.cshtml` contains the shared demo labels for desktop and
mobile; these buttons demonstrate selection until destinations are added.
Below 768px, the pills become a transparent Menu/Close text button. Cyan and gray sheets
stagger in from the right, their circular leading corners morphing into a
rounded charcoal sidebar that fills the dynamic screen height. The close
control stays above the panel, with safe-area padding around its content.
Large plain labels rise and straighten through
individual masks in a second stagger using the existing local GSAP.
`cinema-nav.js` handles reversal, Escape, outside clicks, keyboard focus,
selection synchronization, viewport changes and reduced motion. Short mobile
viewports scroll inside the menu. Standard styling uses Tailwind; custom CSS
owns the entrance and state selectors. The navbar's drawing area is bounded
locally so the decorative canvas cannot widen the document.
The colored logo is served from `CMM_Logo_Colored.png` (the supplied `.svg`
file contains PNG data). The page entrance opens from the center with a short
slide and content reveal. `Client/nav-entrance.cjs` latches that entrance once
after all delayed labels finish, or immediately on interaction. Moving focus
and closing Spotlight cannot replay the entrance. Reduced motion skips it.
`gooey-nav.js` adapts the supplied WebGL pill effect without React. Selection
breaks into droplets and reforms under the target, including rapid retargeting.
Keyboard arrows, Home and End also select desktop pills. Unavailable WebGL
falls back to a solid active pill, without a drop shadow.

Run `npm test` from `CMM_Cinema` for the mobile disclosure's interaction checks.

`wwwroot/css/hero.css` controls the responsive artwork composition, and
`wwwroot/js/hero.js` uses the existing local GSAP library for the entrance.
The hero fills the current viewport without outer spacing. Both background SVGs
scale uniformly using the hero's width and height; their anchors preserve the
large crossing and the bottom-right loop across portrait and landscape sizes.
The large background crossing uses two independent shaded vector tubes:
`clay-line-large-up.svg` travels upward behind
`clay-line-large-down-right.svg`, which travels down and then right.
GSAP reveals each tube independently, with overlapping timing. They have separate
endpoints above the frame, and a soft crossing shadow establishes their depth.
`clay-line-large-vector.svg` contains the combined composition.
The large tubes draw in 1.8 and 2 seconds with a `power2.out` ease. The small
loop uses the same ease-out curve over 1.25 seconds.
The title rises through fixed SVG row windows, revealing CMM before CINEMA;
the CMM fill and outline share a tween to preserve their alignment.

After the entire entrance finishes, `wwwroot/js/hero-physics.js` gives the four
props a gentle float. Cursor swipes (or taps on touch screens) push and spin them;
they coast, rebound from the hero edges and each other, then settle back toward
their original positions. A fixed-step solver handles fast swipes and rotating
edge bounds. Resizing updates the bounds, hidden tabs pause the simulation,
and reduced-motion mode keeps the artwork still.

The small tube uses smooth circular cross sections, continuous gradient
shading and softbox reflections, with separate front and rear surfaces and
a contact shadow at their crossing. Its shading is generated as editable SVG
geometry rather than traced color islands.
Completed artwork has no reveal mask. Motion preferences are respected, and
the complete composition is visible without JavaScript.

The standalone SVGs in `wwwroot/images/hero` are the editable source assets.
Their definitions are mirrored into `_ClayLineLargeGeometry.cshtml` and
`_ClayLineSmallGeometry.cshtml` so SVG filters render consistently inline.
Regenerate the small loop and its inline definitions together with:

```sh
python3 CMM_Cinema/scripts/generate-small-clay-line.py
```

Run this command from the repository root. No Python packages are required.
Edit its curves, radii and lighting in that script. The large artwork's
definitions are maintained in `_ClayLineLargeGeometry.cshtml` and the
standalone large SVGs.
Keep the corresponding reveal centerlines in `Views/Home/Index.cshtml` aligned
with the generated curves.

The original supplied assets remain in `wwwroot/images/hero` for reference.
The props' empty SVG margins were trimmed. The original clay exports contain
embedded bitmaps; their black luminance masks were corrected for reference,
but the hero now uses the new vector versions.

## Navbar icons and actions

Desktop navigation uses equal side columns to keep Home, Work, About and Contact
centered between the logo and the right-side search/account controls. On mobile,
search stays in the bar and Login / Register appears inside the menu. Account
buttons remain UI placeholders until authentication has routes.

`morphicons` 1.7.1 is installed for future icon morphs. It consumes icon path data;
icon artwork is supplied separately. `heroicons` 2.2.0 supplies the search SVG in
`Views/Shared/_SearchIcon.cshtml`, with its MIT license in
`wwwroot/lib/heroicons/LICENSE`. No additional icon runtime is loaded for this
static search icon.

The supplied Spotlight is implemented as a React/TypeScript island in
`CMM_Cinema/components/ui/apple-spotlight.tsx`, built from `Client/cinema-search.tsx`
into `wwwroot/js/cinema-search.bundle.js`. Razor still renders the page. React,
Framer Motion and Lucide provide a dark glass panel up to 768px wide, a search
row matching the navbar height, 32px corners, inline results, shortcut bubbles,
and a changing placeholder. Its cream text, glass treatment and border match
the navbar. `components/ui` holds reusable React UI; existing
Razor components remain in `Views/Shared`. Tailwind scans both. No shadcn CLI
migration is needed because this component imports no shadcn primitives.

The Spotlight component now copies the supplied source's animation structure
and values directly: its flex composition, nested `AnimatePresence` boundaries,
`popLayout`, shared layout IDs, blur/zoom spring, gooey SVG filter, placeholder
motion, results stagger, and shortcut entry/exit springs. The former custom
tray, width spring, silhouette layer and exit scheduler have been removed.
Only the navbar anchor, cinema palette/data, close control and accessible
keyboard wiring are adapted. A source fixture and parity test verify every
motion prop and presence mode against the supplied component.

The surrounding reversible 1.26-second GSAP timeline still collapses the
navbar completely to zero, then expands the anchored Spotlight stage from
zero. The source component owns its internal animations. Its 64px input row
shares the navbar's vertical center, and results extend downward. X, Escape
and backdrop clicks restore the navbar and focus. Reduced motion skips the
outer morph; MotionConfig supplies the user's preference to the source.
The dialog traps keyboard focus, including the source's result/shortcut links.

Search indexes the demo promotion titles, offers, and descriptions already on
the page. Results appear when typing, with arrow-key navigation and Enter to
select. The four shortcut bubbles use promotion queries instead of the
reference's demo documentation links. Selecting a result activates its Swiper
slide and scrolls to the promotion.

Run `npm run build` after editing React: it type-checks TypeScript, bundles the
island and rebuilds Tailwind. `npm run css:build` remains available for Razor-only
styling changes. Do not edit the generated bundle or CSS.

## Promotion slider

The section below the hero is rendered by `Views/Shared/_CinemaPromos.cshtml`.
Its three campaigns are demo content. The retail-inspired cinema banners were
generated with the built-in image generation tool. Their exact prompts are in
[`docs/promo-image-prompts.md`](docs/promo-image-prompts.md). Replace the `offers`
array and images in `wwwroot/images/promos` when real campaigns are ready:

- `midweek-promo-demo.png`: Wednesday buy-one-get-one promotion.
- `late-shows-promo-demo.png`: late shows from ฿150.
- `student-promo-demo.png`: student savings of 20%.

The full artwork scales proportionally on every screen, without cropping its
lettering or adding duplicate text overlays. Screen-reader text also provides
the promotion titles, offers and descriptions for Spotlight search.

Swiper is installed through npm. `npm run vendor:sync` copies its distribution
and license unchanged into `wwwroot/lib/swiper`; `postinstall` runs this sync
automatically. The committed vendor assets let .NET serve the slider without
Node or a CDN at runtime. Run the sync after upgrading Swiper.
`cinema-promos.js` configures touch/drag navigation, arrows and keyboard
navigation. Pagination is removed. Reduced motion makes slide changes instant;
there is no autoplay.
Without JavaScript, the banners appear as a vertical stack.

## Tailwind CSS

Use Tailwind utilities for standard styling. Keep custom CSS for SVG treatments,
artwork coordinates, responsive composition and animation states. Shared cinema
colors live in `Styles/tailwind.css`; the custom hero rules are grouped by
backgrounds, artwork placement, entrance state and responsive composition.

Tailwind CSS v4 uses the CLI to compile `CMM_Cinema/Styles/tailwind.css` into
`CMM_Cinema/wwwroot/css/styles.css`, which is loaded by the shared Razor layout.
The build scans Razor views in `Views` and scripts in `wwwroot/js`.

Run these commands from `CMM_Cinema`:

```sh
npm ci
npm run css:build
dotnet run
```

During development, run `npm run css:watch` in a separate terminal to rebuild
the stylesheet as you edit templates. Use complete Tailwind class names in
templates so the compiler can detect them.

Bootstrap remains available. Tailwind's Preflight reset is disabled to preserve
the existing page styles. Unlayered Bootstrap and site styles take precedence
over Tailwind utilities when they set the same property on the same element.

The generated stylesheet is committed so the app can run without Node.js.
Run `npm run css:build` after changing utility classes and before committing
or publishing; `dotnet build` does not compile Tailwind.
