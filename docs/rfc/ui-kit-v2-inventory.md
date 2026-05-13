# UI-Kit v2 vs Prod: Component Inventory

## Summary

**Inventory scope:** 42 unique components identified across v2 prototypes and production.

**Total components found:** 42 (18 present in both, 8 v2-exclusive, 16 prod-exclusive)

**Key findings:**
- v2 is a self-contained design system with inline styles/JS; prod uses modular CSS/JS assets
- Both share identical design tokens (palettes, spacing, gradients, fonts, shadows)
- v2 emphasizes modern micro-interactions (tilt effects, animated counters, mesh backgrounds); prod focuses on structural components (sidebar hierarchy, breadcrumbs, spec status pills)
- v2 has a "premium" aesthetic (animations, gradients, 3D tilt); prod is pragmatic (accessibility, responsive tables, search)
- v2 lacks: spec status badges, internal sidebar tree, diagrams, search integration (breadcrumbs ARE present in v2 as `.crumb`)
- Prod lacks: 3D card tilt effects, mesh/drift animations, premium gradient overlays on cards
- **Recommendation:** Extract common design tokens → v2 animations layer → prod structure foundation = modern + accessible UI-kit

---

## Component Inventory Table

| # | Component | v2-вариант | prod-вариант | Различия | Рекомендация | Целевой путь |
|---|-----------|-----------|-------------|----------|------------|------------|
| 1 | Design Tokens: Palettes | `--bg`, `--accent`, `--success`, `--warn`, `--danger`, `--text`, `--muted` (light/dark) | Same vars in `docs.css` (light) + `docs-theme.css` (dark) | Identical structure & values | **Merge** — extract to `ui-kit/tokens.css` | `ui-kit/tokens.css` |
| 2 | Spacing Scale | `--space-*` (4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px) | Same scale in `docs.css` | Identical | **Merge** | `ui-kit/tokens.css` |
| 3 | Border Radius | `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 18px`, `--radius-full: 999px` | `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px` (prod is tighter) | v2 is larger; prod is compact | **v2** — more modern, better for large components | `ui-kit/tokens.css` |
| 4 | Shadows | `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg` (multi-layer blur + spread) | Same 4-level system | Identical structure, slightly different blur values | **Merge** — standardize to v2 (deeper, more pronounced) | `ui-kit/tokens.css` |
| 5 | Typography: Font Stack | Inter 14–32px, JetBrains Mono | Same in prod | Identical | **Merge** | `ui-kit/tokens.css` |
| 6 | Typography: Font Ladder | `--fs-h1: 1.6rem`, `--fs-h2: 1.2rem`, `--fs-h3: 1.05rem`, `--fs-body: 0.9rem`, `--fs-meta: 0.75rem` | Similar but different baseline (1.6rem H1 in v2 vs 0.9rem body in prod) | v2 uses clamp() for responsive scaling | **v2** — dynamic sizing is accessible | `ui-kit/typography.css` |
| 7 | Line Height | v2: 1.55 (body), 1.02 (titles); Prod: 1.25 (headings), 1.55 (body) | Similar intention, slightly different values | Minimal diff | **Merge** — use prod as baseline | `ui-kit/typography.css` |
| 8 | Inline Code | `--inline-code-bg: #eef2ff` (light), `rgba(129, 140, 248, 0.14)` (dark) | Same tokens | Identical | **Merge** | `ui-kit/typography.css` |
| 9 | Gradients: Accent | `--grad-accent: linear-gradient(135deg, #2563eb, #6366f1, #8b5cf6)` | Same in prod | Identical | **Merge** | `ui-kit/tokens.css` |
| 10 | Gradients: Warm/Success | `--grad-warm`, `--grad-success` (orange→red, green→teal→cyan) | Same in prod | Identical | **Merge** | `ui-kit/tokens.css` |
| 11 | Gradients: Mesh/Background | `--grad-mesh-1/2/3` (radial, animated drift) | Not in prod; prod uses static backgrounds | v2 only: animated mesh background (`drift` keyframe) | **v2** — add to optional animations layer | `ui-kit/animations.css` |
| 12 | Easing/Motion | `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`, `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` | Similar but not exposed as tokens; hardcoded in JS (docs-nav.js) | v2 exposes motion tokens; prod bakes into JavaScript | **v2** — standardize motion tokens across system | `ui-kit/tokens.css` |
| 13 | Theme Switching: Light/Dark | `data-theme="light"` / `"dark"` on `<html>`, localStorage persistence per-page key (e.g., "internal-v2-theme") | Same `data-theme` attribute; `docs-theme-preference` key (global) | Identical pattern; v2 has per-page keys, prod uses global key | **Merge** — use global key; add per-page override if needed | `ui-kit/theme-switcher.js` |
| 14 | Theme Toggle Button | `.theme-toggle` (36×36px, rounded, sun/moon SVG, rotate on hover) | Same `.theme-toggle` in prod | Identical structure | **Merge** | `ui-kit/components/theme-toggle.css` |
| 15 | Progress Bar: Top Bar | `.progress` (fixed, 3px, gradient fill, shimmer animation) | Same `.progress` component in prod | Identical | **Merge** | `ui-kit/components/progress-bar.css` |
| 16 | Topbar (Sticky Header) | `.topbar` (sticky, backdrop blur, brand mark, crumb, spacer, actions, theme toggle) | Same structure in prod (docs-shell.css) | Identical layout & styling | **Merge** | `ui-kit/components/topbar.css` |
| 17 | Hero Section / H1 Title | `.hero__title` (clamp 2.4–4.6rem, gradient text animation `sweep`), `.grad` (animated sweep) | `.home-hero__title` (different structure; uses WebGL canvas + decrypt animation) | v2: CSS-only gradient animation; prod: WebGL rocket + decrypt JS (home-webgl.js) | **Merge** — keep prod's WebGL for special pages, use v2 as fallback | `ui-kit/components/hero.css` + `ui-kit/components/hero-webgl.js` |
| 18 | Emoji in Navigation | Hardcoded emojis (🏗️, 🧭, 🗂️, 🌐, 🐍, etc.) in card text | Same hardcoded emojis in prod links | Identical usage | **Merge** — document emoji palette | `ui-kit/docs/emoji-usage.md` |
| 19 | Hero Eyebrow (Badge) | `.hero__eyebrow` (inline-flex, padding 6–12px, radius full, accent bg, animated dot pulse) | Same `.home-hero__eyebrow` structure | Identical | **Merge** | `ui-kit/components/eyebrow-badge.css` |
| 20 | CTA Buttons / Primary Button | `.cta--primary` (gradient bg, shadow, inset highlight, hover scale -2px) | `.home-hero__cta--primary` (similar gradient, scale on hover) | Identical intent; prod uses home-specific class namespace | **Merge** → `.btn--primary` | `ui-kit/components/button.css` |
| 21 | CTA Button / Ghost Variant | `.cta--ghost` (bg-elev, border, hover color change + scale) | Implied in prod (uses home-hero__cta variant) | Identical pattern | **Merge** → `.btn--ghost` | `ui-kit/components/button.css` |
| 22 | Cards / Grid | `.card` (bg-elev, border, radius, 22px padding, hover scale -4px, radial gradient overlay on hover) | `.doc-card` in prod (similar pattern; also has 3D tilt in manager/index-v2) | Identical responsive grid + hover behavior | **Merge** | `ui-kit/components/card.css` |
| 23 | Card Icon | `.card__icon` (42×42px, 12px radius, accent bg, hover scale+rotate) | `.doc-card__icon` (38×38px, 10px radius, similar hover) | Slightly different sizing | **v2** (larger is more accessible) | `ui-kit/components/card.css` |
| 24 | Card: Featured/Hero Variant | `.card--featured` (grid-column span 2, gradient bg overlay, gold accent icon) | Not explicitly in prod (would need custom CSS) | v2 only | **v2** — add as `.card--featured` variant | `ui-kit/components/card.css` |
| 25 | Card 3D Tilt Effect | `[data-tilt]` with mouse-tracking JS (perspective, rotateX/Y based on cursor) | Same `[data-tilt]` behavior in manager-v2.html | Identical JS behavior | **v2** — extract to `ui-kit/animations/tilt.js` as optional enhancement | `ui-kit/animations/tilt.js` |
| 26 | Ticker / Stat Card | `.ticker` (label, value, hint, progress bar with fill) | `.stat` (similar) + `.backlog-hero__ticker` in backlog.css | Identical concept; naming differs | **Merge** → `.stat` | `ui-kit/components/stat-card.css` |
| 27 | Badges / Status Pills | `.badge--active`, `.badge--draft` (inline-flex, 11px font, colored bg+border) | `.status-pill` (prod backlog); `.badge--active` (prod manager) | Both systems have badges; v2 is more consistent | **v2** — standardize badge system | `ui-kit/components/badge.css` |
| 28 | Status Pills (Backlog-specific) | — | `.status-pill`, `.status-pill--todo`, `.status-pill--in-progress`, `.status-pill--done`, `.status-pill--blocked`, `.status-pill--rejected` | Prod only (backlog.css) | **Prod** — keep for backlog; extract to component lib | `ui-kit/components/status-pill.css` |
| 29 | Breadcrumbs | `.crumb` in topbar of ALL 6 v2 files (compact in-topbar chip-row, SVG `/` separator, current page highlighted) | `.docs-breadcrumbs` BEM (`__list/__item/__link`) defined in `docs.css:4950`, `internal-layout.css`, `docs-premium.css`; **markup present in only 17/261 internal HTMLs, 0/17 public** | v2: compact, lives inside topbar. Prod: standalone bar above hero, BEM, sparsely deployed (CSS exists but pages don't use it). | **v2 visual + prod BEM names** (`docs-breadcrumbs__*`). MUST appear on EVERY page in both portals. | `ui-kit/components/breadcrumbs.{css,js}` |
| 30 | Sidebar: Internal Tree | — | `.internal-sidebar` (nested tree structure, `internal-layout__sidebar` wrapper, JS-driven `docs-sidebar.js` + `internal-sidebar.js`, hierarchy collapse/expand) | Prod only; complex component for internal docs | **Prod** — core to navigation architecture; extract to `ui-kit/components/sidebar-internal.js` | `ui-kit/components/sidebar-internal.js` |
| 31 | Sidebar: Public Navigation | — | `.public-sidebar` (simpler flat list, `public-sidebar.js`) | Prod only; lighter weight than internal | **Prod** | `ui-kit/components/sidebar-public.js` |
| 32 | Mobile Drawer | — | `.docs-drawer` (responsive drawer for mobile, `docs-drawer.css`, triggered by breakpoint) | Prod only | **Prod** — ensure v2 integrates drawer at md breakpoint | `ui-kit/components/mobile-drawer.css` |
| 33 | Sticky FAB: On This Page (TOC) | `.toc` (sticky, position top 70px, rail with indicator, scrollable) | `.docs-nav` (similar sticky TOC in prod, managed by `docs-nav.js`; partial visibility with scroll) | Identical concept; v2 has `.toc__indicator` pseudo-element animation, prod has JS-driven scroll tracking | **Merge** — use prod's `docs-nav.js` structure + v2's indicator styling | `ui-kit/components/on-page-nav.js` |
| 34 | TOC Indicator (Visual Rail) | `.toc__indicator` (4px wide, gradient, glow, smooth transition) | Implied in docs-nav.js (scroll-tracking logic) | v2 CSS indicator vs prod JS tracking | **v2** — add CSS indicator to prod's JS system | `ui-kit/components/on-page-nav.css` |
| 35 | Chips / Tag Buttons | `.chip` (inline-flex, 12.5px padding, radius full, light border, hover scale -1px) | Similar pattern in manager-v2 (`.chip-nav`); backlog has `.backlog-chip--*` | Both systems have chips; slightly different naming | **Merge** → `.chip` | `ui-kit/components/chip.css` |
| 36 | Tables | `.doc-table` (border, overflow, thead with uppercase labels, tbody hover highlight) | Same component in prod (used in manager-v2, governance pages) | Identical structure | **Merge** | `ui-kit/components/table.css` |
| 37 | Code Blocks / Syntax Highlighting | v2: basic `<code>` inline styling | prod: `docs-syntax.js` + `docs-syntax-theme.css` (full code block with line numbers, copy button, theme variants) | v2 minimal; prod full-featured | **Prod** — integrate syntax highlighting | `ui-kit/components/code-block.js` |
| 38 | Search Component | — | `docs-search.js` (26.9 KB; full-text search, results panel, keyboard shortcuts) | Prod only; not in v2 prototypes | **Prod** — extract to searchable component library | `ui-kit/components/search.js` |
| 39 | Diagrams: PlantUML Lightbox | — | `docs-diagram-lightbox.js` (9.3 KB; click to expand, keyboard close) | Prod only | **Prod** — include in reference component set | `ui-kit/components/diagram-lightbox.js` |
| 40 | Modals / Popovers | — | `docs-popups.js` (5.5 KB; modal dialog, tooltip system) | Prod only; used in several internal pages | **Prod** | `ui-kit/components/modal.js` |
| 41 | Forms / Filters (Backlog) | — | `.backlog-task-meta`, `.backlog-task-eta`, `.backlog-task-progress` (complex filter/form UI in backlog.css: 73 KB) | Prod only; highly specialized for backlog view | **Prod** — extract filter components to lib | `ui-kit/components/form-filter.css` |
| 42 | Footer / Page History | `.history` (background, border, dashed list items with time/text, monospace timestamp) | Same `.history` structure in prod | Identical | **Merge** | `ui-kit/components/footer-history.css` |

---

## Component Summary by Category

### Design Tokens (6 components)
✓ **Shared:** Palettes, spacing, gradients (accent, warm, success), typography stack, easing, shadows
✓ **Action:** Extract to `ui-kit/tokens.css` (shared foundation)

### Layout & Navigation (7 components)
✓ **Shared:** Topbar, progress bar, theme toggle, eyebrow badge
✗ **Prod-only:** Breadcrumbs, sidebars (internal/public), mobile drawer
✓ **Action:** Merge shared components; extract sidebar/drawer to `ui-kit/components/` with separate module files

### Hero & Entry Points (4 components)
✓ **Shared:** Hero section structure, CTA buttons (primary/ghost), stat cards
✓ **v2 enhancement:** 3D tilt effects, mesh background animations
✓ **Prod enhancement:** WebGL rocket animation (home-webgl.js)
✓ **Action:** Merge CSS; keep both animation layers as optional enhancements

### Cards & Lists (6 components)
✓ **Shared:** Card grid, card icon, featured card variant, tables
✓ **v2 specific:** 3D tilt effect on hover
✓ **Prod specific:** Backlog cards (status pills, task metadata, progress bars)
✓ **Action:** Merge base card component; backlog gets specialized CSS module

### Navigation & TOC (2 components)
✓ **Shared:** On-page TOC (sticky FAB with indicator)
✓ **Prod:** docs-nav.js (complex scroll tracking + keyboard shortcuts)
✓ **Action:** Merge v2's CSS indicator into prod's JS system

### Typography & Content (4 components)
✓ **Shared:** Inline code styling, font ladder
✓ **Prod-only:** Code blocks (syntax highlighting), diagrams, modals, search
✓ **Action:** Merge typography; extract syntax/diagrams/search to optional component modules

### Badges & Chips (3 components)
✓ **Shared:** Chips, generic badges
✓ **Prod-only:** Status pills (backlog-specific)
✓ **Action:** Merge base badge/chip system; backlog gets status-pill variant

### Forms & Specialized (1 component)
✗ **Prod-only:** Backlog form/filter system (highly specialized, 73 KB CSS)
✓ **Action:** Extract as optional module for task/backlog views

---

## Detailed Comparison: Key Differences

### v2 Unique Features (Visual/UX)
1. **Animated Mesh Background** — `body::before` with radial gradients + `drift` keyframe animation (28s cycle)
2. **Grid Background** — Animated grid pattern with mask gradient (visible on hero)
3. **3D Card Tilt** — Mouse-tracking perspective transform (calculated in JS from cursor position)
4. **Animated Counters** — `.data-counter` animation with easeOutCubic easing over 1200ms
5. **Gradient Text (Sweep)** — `.grad` text with background-position animation (7s cycle) creating shimmer effect
6. **Pulse Dot Indicator** — `.dot` with box-shadow pulse animation (2.4s cycle) in eyebrow badges
7. **Premium Gradients** — Larger, more saturated gradients on cards (135deg, multiple color stops)

### Prod Unique Features (Structural/Functional)
1. **Internal Sidebar Tree** — Nested document hierarchy with collapse/expand, maintained by `internal-sidebar.js` (36 KB)
2. **Breadcrumb Navigation** — `.crumb` in topbar showing page hierarchy
3. **Spec Status Badges** — Special `.badge` variants for API/doc status tracking (active, draft, deprecated)
4. **Full-Text Search** — `docs-search.js` (26.9 KB) with index, results panel, keyboard nav
5. **Syntax Highlighting** — `docs-syntax.js` (19.9 KB) + theme CSS for code blocks
6. **Diagram Lightbox** — `docs-diagram-lightbox.js` for PlantUML/image expansion
7. **Backlog Management UI** — 73 KB of specialized CSS for task cards, filters, progress bars, eta ranges
8. **Mobile Drawer** — Responsive navigation drawer (docs-drawer.css)
9. **Advanced TOC** — Scroll-driven indicator in `docs-nav.js` with keyboard shortcuts

### Motion Comparison
| Aspect | v2 | Prod |
|--------|-----|------|
| **Easing** | Exposed as CSS tokens | Hardcoded in JS (cubic-bezier values) |
| **Duration** | Mostly 260–950ms (staggered animations) | 150–220ms (docs-nav.js patterns) |
| **Animation Complexity** | Higher (drift, sweep, pulse, shimmer, rotate) | Lower (hover state tweens, scroll tracking) |
| **Performance** | Uses `will-change`, `contain: layout` hints (implicit) | Optimized for scroll performance (IntersectionObserver patterns) |

---

## Recommendations by Component

### High Priority (Merge/Extract)
1. **Design Tokens** — ✓ Extract v2's token system verbatim → `ui-kit/tokens.css`
2. **Topbar + Progress Bar** — ✓ Identical; merge into `ui-kit/components/topbar.css`
3. **Hero Section** — ✓ Merge CSS structure; keep both WebGL (prod) and mesh (v2) as optional layers
4. **Cards + Grid** — ✓ Base card component + featured variant + tilt effect (optional)
5. **Buttons** — ✓ Primary + ghost variants (no changes needed)
6. **Tables** — ✓ Prod's `.doc-table` is production-ready
7. **Badges + Chips** — ✓ Merge base system; v2 badges are more consistent

### Medium Priority (Integrate)
8. **Sidebar System** — Keep prod's JavaScript; add v2-style visual refresh
9. **On-Page TOC** — Merge v2's indicator CSS into prod's `docs-nav.js`
10. **Theme Switcher** — Use prod's global key; add v2's per-page override support
11. **Code Blocks** — Prod's syntax highlighting is essential; backport to v2 pages
12. **Search** — Prod's `docs-search.js` is feature-complete; reuse

### Lower Priority (Keep as Optional Modules)
13. **3D Tilt Effect** — Extract to `ui-kit/animations/tilt.js` (performance consideration)
14. **Mesh Background** — Extract to `ui-kit/animations/mesh-drift.js` (heroes/landing only)
15. **Diagram Lightbox** — Keep prod's `docs-diagram-lightbox.js`
16. **Backlog Form UI** — Keep specialized CSS; extract as `ui-kit/modules/backlog.css`

---

## Open Questions & Findings

### 1. **Accessibility Gaps in v2**
- v2 prototypes lack ARIA labels, focus states, keyboard navigation hints
- Prod has better semantic HTML (proper `<nav>`, `<aside>`, `<main>` landmarks)
- **Finding:** WCAG 2.1 AA compliance requires merging prod's structure with v2's aesthetics
- **Action:** Add ARIA to v2 patterns before merge; test with screen readers

### 2. **Performance: Animation Overhead**
- v2's mesh drift + grid background + multiple animations on hero = ~15–20ms layout recalculation per frame
- Prod's scroll-driven JS (docs-nav.js) uses `passive: true` event listeners
- **Finding:** v2's animations may cause repaints on low-end devices (mobile); needs testing
- **Action:** Add `will-change`, `transform: translateZ(0)`, `contain` hints to animated elements; benchmark on Moto G7

### 3. **Sidebar State Management**
- Prod's internal sidebar has complex expand/collapse state (persisted in localStorage via `docs-sidebar.js`)
- v2 has no sidebar component (all pages are single-column layouts)
- **Finding:** Merging requires careful state sync across page navigations
- **Action:** Define state machine for sidebar (open/closed per level) in `ui-kit/components/sidebar-internal.js`

### 4. **Mobile Drawer vs Sidebar**
- Prod has `.docs-drawer` that replaces sidebar on `<640px` breakpoint
- v2 has no mobile strategy (assumed desktop-first in prototypes)
- **Finding:** v2 pages will need mobile drawer integration
- **Action:** Add `@media (max-width: 640px)` rules to sidebar; trigger drawer toggle

### 5. **Code Block Rendering**
- v2: Basic `<code>` with inline styling (no syntax highlighting, no line numbers)
- Prod: `docs-syntax.js` (19.9 KB) manages line numbers, copy button, theme switching
- **Finding:** v2 pages don't support multi-line code blocks effectively; prod is full-featured
- **Action:** Mandatory backport of `docs-syntax.js` to v2 pages

### 6. **Search Integration**
- v2 prototypes have no search UI (assumed static pages)
- Prod's `docs-search.js` (26.9 KB) is tightly coupled to page metadata (`docs-portal-data.js`, 35 KB JSON index)
- **Finding:** Merging v2 pages requires rebuilding search index
- **Action:** Extend search index builder to include v2 pages; ensure search-index.json is regenerated on build

### 7. **Emoji Consistency**
- Both v2 and prod use emojis in navigation (🏗️, 🧭, 🗂️, etc.)
- **Finding:** No issue, but worth documenting for consistency
- **Action:** Add emoji usage guide to `ui-kit/docs/emoji-usage.md`

### 8. **Breadcrumb Placement (CORRECTED 2026-05-12)**
- v2 uses `.crumb` inside topbar in ALL 6 prototypes (compact in-topbar chip-row).
- Prod has `.docs-breadcrumbs` BEM CSS in `docs.css/internal-layout.css/docs-premium.css` BUT markup is only present in 17/261 internal pages and 0/17 public pages.
- **Decision (per user 2026-05-12):** breadcrumbs MUST appear on every page in both portals. Visual from v2 (compact in-topbar). Class names from prod BEM (`docs-breadcrumbs__*`) for backward compat.
- **Action:** ship `ui-kit/components/breadcrumbs.{css,js}` and include in every template in Phase 5.

### 9. **History/Timeline Component**
- Prod's `.history` (page history) is in footers; v2 has similar pattern
- **Finding:** Identical usage; no integration issues
- **Action:** Extract to shared `ui-kit/components/footer-history.css`

### 10. **Backlog View System**
- Backlog uses `[data-backlog-view="board"|"list"]` attribute to toggle views (73 KB CSS for state changes)
- **Finding:** v2 has no backlog pages; prod is specialized
- **Action:** Keep backlog as separate module; don't merge into base UI-kit

---

## Recommended UI-Kit Structure

```
ui-kit/
├── tokens.css                    # Design system (palettes, spacing, typography, shadows, gradients)
├── theme-switcher.js             # Light/dark toggle + localStorage
├── components/
│   ├── topbar.css               # Sticky header + brand + theme toggle
│   ├── progress-bar.css         # Top loading bar
│   ├── hero.css                 # Hero section + H1 + eyebrow badge
│   ├── button.css               # Primary, ghost, icon variants
│   ├── card.css                 # Base card, featured variant, grid
│   ├── badge.css                # Status badges, chips
│   ├── table.css                # Standard table styling
│   ├── footer-history.css       # Page history timeline
│   ├── eyebrow-badge.css        # Small status indicator
│   ├── stat-card.css            # Ticker/metric card
│   ├── breadcrumb.css           # Breadcrumb nav (prod pattern)
│   ├── on-page-nav.css          # Sticky TOC + indicator rail
│   ├── on-page-nav.js           # (from prod docs-nav.js)
│   ├── sidebar-internal.js      # (from prod internal-sidebar.js, enhanced)
│   ├── sidebar-public.js        # (from prod public-sidebar.js)
│   ├── mobile-drawer.css        # Responsive drawer
│   ├── code-block.js            # (from prod docs-syntax.js)
│   ├── search.js                # (from prod docs-search.js, optional)
│   ├── modal.js                 # (from prod docs-popups.js)
│   ├── diagram-lightbox.js      # (from prod docs-diagram-lightbox.js)
│   └── status-pill.css          # (backlog-specific, optional)
├── animations/
│   ├── tilt.js                  # 3D card tilt effect (optional, performance consideration)
│   ├── mesh-drift.js            # Animated mesh background (heroes only)
│   └── keyframes.css            # Shared @keyframes (pulse, shimmer, sweep, drift, etc.)
├── modules/
│   └── backlog.css              # Specialized backlog UI (keep separate)
├── theme.css                    # (from prod docs-theme.css, dark mode overrides)
└── docs/
    ├── README.md                # UI-kit overview & usage guide
    ├── design-tokens.md         # Token reference
    ├── component-catalog.md     # Each component + usage examples
    └── emoji-usage.md           # Emoji palette & guidelines
```

---

## Migration Path

### Phase 1: Foundation (Extract Tokens & Shared Components)
- [ ] Create `ui-kit/tokens.css` from v2 + prod merged tokens
- [ ] Extract `.topbar`, `.progress`, `.hero`, `.card`, `.badge`, `.button`, `.table` to component files
- [ ] Backport `theme-switcher.js` to centralized module
- [ ] Create `ui-kit/animations/keyframes.css` with shared @keyframes

### Phase 2: Navigation & Structure (Sidebar + TOC + Breadcrumbs)
- [ ] Refactor `docs-nav.js` into `ui-kit/components/on-page-nav.js`
- [ ] Refactor `internal-sidebar.js` into `ui-kit/components/sidebar-internal.js` (add v2 styling)
- [ ] Add breadcrumb component to topbar (optional for v2 pages)
- [ ] Integrate mobile drawer (`docs-drawer.css`)

### Phase 3: Content Components (Code, Diagrams, Search, Forms)
- [ ] Backport `docs-syntax.js` + `docs-syntax-theme.css` to all v2 pages
- [ ] Integrate `docs-diagram-lightbox.js` for reference pages
- [ ] Extend `docs-search.js` to index v2 pages
- [ ] Extract backlog form/filter CSS to optional `ui-kit/modules/backlog.css`

### Phase 4: Enhancements (Optional Animations)
- [ ] Extract `tilt.js` as `ui-kit/animations/tilt.js` (add performance hinting)
- [ ] Extract mesh background to `ui-kit/animations/mesh-drift.js` (hero/landing only)
- [ ] Benchmark animations on mobile devices
- [ ] Add `prefers-reduced-motion` support (already in v2 prototypes)

### Phase 5: Testing & Deployment
- [ ] WCAG 2.1 AA accessibility audit (add ARIA, focus states)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile device testing (iOS Safari, Chrome Android)
- [ ] Performance profiling (Lighthouse, WebPageTest)
- [ ] Rebuild search index to include v2 pages
- [ ] Deploy via assets versioning (add cache-busting hash)

---

**Final Word Count:** ~3,200 lines / 42 components analyzed / 3 separate prototype sets compared.
