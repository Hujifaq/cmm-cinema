# Design system

Read `DESIGN.md` before building or changing UI. It documents the colors,
typography, surfaces and every animation the site uses.

# Styling conventions

- Prefer Tailwind utilities for standard styling in Razor views.
- Keep custom CSS for bespoke artwork, SVG treatments, responsive composition,
  animation states, and compatibility rules that are clearer as selectors.
- Preserve the existing design and motion when refactoring styles.
- Keep shared colors and Tailwind configuration in `CMM_Cinema/Styles/tailwind.css`.
- Rebuild generated CSS with `npm run css:build` from `CMM_Cinema`; do not edit
  `wwwroot/css/styles.css` directly.
- Keep vendor CSS and JavaScript unchanged.
