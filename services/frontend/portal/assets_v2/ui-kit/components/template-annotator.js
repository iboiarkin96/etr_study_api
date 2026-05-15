/* ui-kit/components/template-annotator.js
   ────────────────────────────────────────
   Drop-in template-anatomy overlay. Any docs page that loads this script
   (plus template-annotator.css) gets a pill toggle in the topbar and, when
   enabled, a right-side annotation rail with numbered callouts that point
   at every well-known block on the page.

   Templates do NOT need any extra markup — the script auto-injects the
   toggle button and the SVG overlay, and discovers annotatable blocks via
   CSS selectors from the registry below. To add new annotatable blocks,
   append a new entry to BLOCK_REGISTRY.
   ────────────────────────────────────────────────────────────────────────── */

const BLOCK_REGISTRY = [
  { block: 'topbar',           num: 1,
    selector: 'header.topbar',
    what: 'Global navigation bar',
    desc: 'Sticky site-wide header. Contains brand, breadcrumbs, theme toggle.',
    comp: '<header class="topbar">' },

  { block: 'brand',            num: 2,
    selector: '.topbar__brand',
    what: 'Brand + portal name',
    desc: 'Portal identity link. Emoji icon + site/portal name text.',
    comp: 'topbar__brand' },

  { block: 'breadcrumbs',      num: 3,
    selector: 'nav.topbar__breadcrumbs, .docs-breadcrumbs',
    what: 'Breadcrumb trail',
    desc: 'Hierarchical path. Final item has aria-current="page".',
    comp: 'docs-breadcrumbs' },

  { block: 'theme-toggle',     num: 4,
    selector: '.docs-theme-toggle',
    what: 'Theme toggle',
    desc: 'Flashlight light/dark switch. Persists in localStorage.',
    comp: 'theme-toggle' },

  { block: 'sidebar',          num: 5,
    selector: 'aside[data-component="sidebar"], .docs-sidebar',
    what: 'Left-rail section nav',
    desc: 'JSON-driven tree via data-nav-src. Collapse state persisted.',
    comp: 'sidebar component' },

  { block: 'eyebrow',          num: 6,
    selector: '.home-hero__eyebrow, .page-head .eyebrow',
    what: 'Content-type eyebrow',
    desc: 'Signals archetype: Handbook, Practice, Reference…',
    comp: 'home-hero__eyebrow' },

  { block: 'h1',               num: 7,
    selector: 'main h1, article.docs-prose h1, .page-head h1',
    what: 'Article title (h1)',
    desc: 'Main page heading. Exactly one h1 per page.',
    comp: 'docs-prose h1' },

  { block: 'lede',             num: 8,
    selector: '.lede, .page-head p.lede',
    what: 'Lead paragraph (lede)',
    desc: 'Intro summary below the title. Larger muted text.',
    comp: '.lede inside .docs-prose' },

  { block: 'prose',            num: 10,
    selector: 'article.docs-prose',
    what: 'Prose container',
    desc: 'Wraps all article content. Applies typography scale.',
    comp: 'article.docs-prose' },

  { block: 'h2',               num: 11,
    selector: 'article.docs-prose h2[id]',
    what: 'Section heading (h2)',
    desc: 'Level-2 heading. id required for TOC scroll-spy.',
    comp: 'docs-prose h2[id]' },

  { block: 'h3',               num: 12,
    selector: 'article.docs-prose h3[id]',
    what: 'Sub-section heading (h3)',
    desc: 'Level-3 heading. Nested under its h2 in the TOC.',
    comp: 'docs-prose h3[id]' },

  { block: 'paragraph',        num: 13,
    selector: 'article.docs-prose p:not(.lede)',
    what: 'Body paragraph',
    desc: 'Standard prose text. Width: --layout-prose-max.',
    comp: 'docs-prose p' },

  { block: 'ordered-list',     num: 14,
    selector: 'article.docs-prose ol',
    what: 'Ordered list',
    desc: 'Numbered list. Use for sequential steps.',
    comp: 'docs-prose ol' },

  { block: 'link',             num: 15,
    selector: 'article.docs-prose p a[href]',
    what: 'Inline link',
    desc: 'Cross-reference or external link. Accent colour.',
    comp: 'docs-prose a' },

  { block: 'history-footer',   num: 16,
    selector: 'footer.docs-history',
    what: 'Page history footer',
    desc: 'Revision changelog at the bottom of every doc page.',
    comp: 'footer.docs-history' },

  { block: 'history-date',     num: 17,
    selector: '.docs-history__date',
    what: 'Edit timestamp',
    desc: 'ISO date of the revision (YYYY-MM-DD).',
    comp: '.docs-history__date' },

  { block: 'author-chip',      num: 18,
    selector: '[data-component="author-chip"]',
    what: 'Author chip',
    desc: 'Avatar + name from data-person-id. Links to profile.',
    comp: 'author-chip' },

  { block: 'history-note',     num: 19,
    selector: '.docs-history__note',
    what: 'Revision note',
    desc: 'Short text describing what changed.',
    comp: '.docs-history__note' },

  { block: 'toc',              num: 20,
    selector: 'aside.docs-toc',
    what: 'TOC right rail',
    desc: '"On this page" nav. 2-level h2/h3 via toc.js.',
    comp: 'aside.docs-toc' },

  { block: 'toc-active',       num: 21,
    selector: '.docs-toc__item--active',
    what: 'Active TOC item',
    desc: 'Current section highlighted by scroll-spy.',
    comp: '.docs-toc__item--active' },

  { block: 'toc-fab',          num: 22,
    selector: '[data-component="toc-fab"]',
    what: 'TOC mobile FAB',
    desc: 'Float button (≤ 1024 px) opens TOC as sheet.',
    comp: 'toc-fab component' },

  { block: 'rocket',           num: 23,
    selector: '[data-component="rocket"]',
    what: 'Scroll-to-top rocket',
    desc: 'Animated FAB with progress ring. Appears at 300 px.',
    comp: 'rocket component' },

  /* ── Extended blocks (showcase / landings / ops / reference) ──────────── */

  { block: 'card-grid',        num: 24,
    selector: '.docs-card-grid',
    what: 'Card grid layout',
    desc: 'Auto-fill responsive grid wrapper for docs-card tiles.',
    comp: 'docs-card-grid' },

  { block: 'card',             num: 25,
    selector: '.docs-card',
    what: 'Content card',
    desc: 'Generic clickable card with head / body / footer.',
    comp: 'docs-card' },

  { block: 'pill',             num: 26,
    selector: '.docs-pill',
    what: 'Inline pill',
    desc: 'Small coloured label (info, success, warn, danger, neutral).',
    comp: 'docs-pill' },

  { block: 'status-pill',      num: 27,
    selector: '.docs-status-pill',
    what: 'Status pill',
    desc: 'Workflow state badge (accepted, done, in-progress, blocked).',
    comp: 'docs-status-pill' },

  { block: 'chip',             num: 28,
    selector: '.docs-chip',
    what: 'Meta chip',
    desc: 'Compact tag for meta info (duration, level, type).',
    comp: 'docs-chip' },

  { block: 'status-timeline',  num: 29,
    selector: '[data-component="status-timeline"]',
    what: 'Decision timeline',
    desc: 'ADR temporal flow (current / decided / supersedes).',
    comp: 'status-timeline' },

  { block: 'diagram',          num: 30,
    selector: '.docs-diagram',
    what: 'Code diagram',
    desc: 'PlantUML / SVG diagram wrapper with caption.',
    comp: 'docs-diagram' },

  { block: 'table',            num: 31,
    selector: '.docs-table',
    what: 'Data table',
    desc: 'Striped / sticky-head data table for references & matrices.',
    comp: 'docs-table' },

  { block: 'endpoint-card',    num: 32,
    selector: '.docs-endpoint-card, [data-component="endpoint-card"]',
    what: 'API endpoint card',
    desc: 'Collapsible request / response block with method badge.',
    comp: 'docs-endpoint-card' },

  { block: 'method-badge',     num: 33,
    selector: '.docs-method-badge',
    what: 'HTTP method badge',
    desc: 'GET / POST / PATCH / DELETE coloured pill.',
    comp: 'docs-method-badge' },

  { block: 'http-pill',        num: 34,
    selector: '.docs-http-pill',
    what: 'HTTP status pill',
    desc: 'Response code badge (2xx success, 4xx client, 5xx server).',
    comp: 'docs-http-pill' },

  { block: 'button',           num: 35,
    selector: '.docs-btn',
    what: 'Button',
    desc: 'Primary / secondary CTA button.',
    comp: 'docs-btn' },

  { block: 'lp-hero',          num: 36,
    selector: '.lp-hero',
    what: 'Landing hero',
    desc: 'Full-bleed landing hero with WebGL slot + tickers.',
    comp: 'lp-hero' },

  { block: 'home-hero',        num: 37,
    selector: '.home-hero',
    what: 'Section hero',
    desc: 'Compact hero for section index pages.',
    comp: 'home-hero' },

  { block: 'tickers',          num: 38,
    selector: '.docs-tickers',
    what: 'Animated metric counters',
    desc: 'Row of live-animated number tickers (data-target).',
    comp: 'docs-tickers' },

  { block: 'terminal-card',    num: 39,
    selector: '[data-component="terminal-card"]',
    what: 'Terminal card',
    desc: 'Typewriter / shell simulation block.',
    comp: 'terminal-card' },

  { block: 'pillar',           num: 40,
    selector: '.lp-pillar',
    what: 'Feature pillar',
    desc: 'Tone-coded landing tile (analysis, governance, sre, uikit).',
    comp: 'lp-pillar' },

  { block: 'kpi-card',         num: 41,
    selector: '.cockpit-kpi-card',
    what: 'KPI metric card',
    desc: 'Big number + sparkline + delta caption.',
    comp: 'cockpit-kpi-card' },

  { block: 'sparkline',        num: 42,
    selector: '[data-component="sparkline"]',
    what: 'Sparkline',
    desc: 'Inline mini line chart (data-values, data-color).',
    comp: 'sparkline' },

  { block: 'filter-chip',      num: 43,
    selector: '.docs-chip--filter',
    what: 'Filter chip',
    desc: 'Pressable toggle chip for list filtering.',
    comp: 'docs-chip--filter' },

  { block: 'view-switcher',    num: 44,
    selector: '[data-component="view-switcher"]',
    what: 'View switcher',
    desc: 'Board / Table / Timeline mode toggle group.',
    comp: 'view-switcher' },

  { block: 'cockpit-timeline', num: 45,
    selector: '.cockpit-timeline',
    what: 'Sprint timeline',
    desc: 'Multi-lane timeline of phases or sprint items.',
    comp: 'cockpit-timeline' }
];

/* ── Layout constants ─────────────────────────────────────────────────── */
const BOX_W         = 244; /* wide enough for 24-char labels at 10.5px semibold */
const BOX_H_COMPACT = 30;
const BOX_H_OPEN    = 104;
const BOX_GAP       = 4;
const BOX_X         = 6;   /* gap from the body's right edge */
const BOX_TOP_MIN   = 14;  /* never let a box overflow above the page edge */

/* ── State ────────────────────────────────────────────────────────────── */
const expandedSet = Object.create(null);
let rendered = [];
let rTimer;
let svg;
let btn;
/* Snapshot of shell collapse state so we can restore it on annot-mode OFF.
   Annot-mode force-expands sidebar + TOC so callouts point at full
   components, not at their slim "bookmark tab" / icon-rail variants. */
const shellSnap = { toc: false, sidebar: false };

/* ── Helpers ──────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tok(name, fallback) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim();
  return v || fallback;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) {
    if (Object.prototype.hasOwnProperty.call(attrs, k)) {
      el.setAttribute(k, attrs[k]);
    }
  }
  return el;
}

/* ── DOM injection (one-time setup) ───────────────────────────────────── */
function injectToggle() {
  const existing = document.getElementById('annot-toggle');
  if (existing) return existing;

  const html =
    '<button class="annot-toggle" id="annot-toggle" type="button"' +
    ' aria-pressed="false" aria-label="Toggle annotations">' +
      '<span class="annot-toggle__dot" aria-hidden="true"></span>' +
      '<span class="annot-toggle__label annot-toggle__label--enable">Enable annotations</span>' +
      '<span class="annot-toggle__label annot-toggle__label--disable">Disable annotations</span>' +
    '</button>';

  const actions = document.querySelector('.topbar__actions');
  if (actions) {
    actions.insertAdjacentHTML('afterbegin', html);
  } else {
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('annot-toggle').classList.add('annot-toggle--floating');
  }
  return document.getElementById('annot-toggle');
}

function injectSVG() {
  const existing = document.getElementById('annot-svg');
  if (existing) return existing;
  const s = svgEl('svg', {
    class: 'annot-svg', id: 'annot-svg', 'aria-hidden': 'true'
  });
  document.body.appendChild(s);
  return s;
}

/* ── Layout ───────────────────────────────────────────────────────────── */
function cleanup() {
  rendered.forEach(el => el.parentNode && el.parentNode.removeChild(el));
  rendered = [];
  if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function discoverItems() {
  const out = [];
  BLOCK_REGISTRY.forEach(entry => {
    const el = document.querySelector(entry.selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') return;
    const sy = window.scrollY || window.pageYOffset || 0;
    out.push({
      block: entry.block,
      what:  entry.what,
      desc:  entry.desc,
      comp:  entry.comp,
      elR:   r.right,
      elCy:  r.top + sy + r.height / 2
    });
  });
  out.sort((a, b) => a.elCy - b.elCy);
  /* Local, page-scoped numbering — restarts from 1 on every page so users
     see 1..N for whatever blocks actually exist, not gaps from the global
     registry index. */
  out.forEach((item, i) => { item.num = i + 1; });
  return out;
}

function layout() {
  cleanup();
  if (!svg) return;

  const bw = document.documentElement.offsetWidth;
  const bh = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  svg.setAttribute('width', bw);
  svg.setAttribute('height', bh);

  const accent = tok('--accent', '#4f8ef7');
  const bg     = tok('--bg',     '#ffffff');

  const items = discoverItems();

  /* Top floor — keep boxes below the topbar so the first one is never
     covered by the (full-viewport-width, z-1000) header. Falls back to
     BOX_TOP_MIN when no topbar is present. */
  const topbarEl = document.querySelector('header.topbar, .topbar');
  let topFloor = BOX_TOP_MIN;
  if (topbarEl) {
    const tr = topbarEl.getBoundingClientRect();
    const sy = window.scrollY || window.pageYOffset || 0;
    topFloor = Math.max(BOX_TOP_MIN, tr.bottom + sy + BOX_GAP);
  }

  /* Collision avoidance: clamp natural Y to topFloor, then push down. The
     clamp also guarantees boxes "open downward" — when expanded height
     would shift the center above topFloor, the top edge is pinned. */
  const ys = items.map(a => {
    const natural = a.elCy - (expandedSet[a.block] ? BOX_H_OPEN : BOX_H_COMPACT) / 2;
    return Math.max(topFloor, natural);
  });
  for (let i = 1; i < ys.length; i++) {
    const prevH = expandedSet[items[i - 1].block] ? BOX_H_OPEN : BOX_H_COMPACT;
    const floor = ys[i - 1] + prevH + BOX_GAP;
    if (ys[i] < floor) ys[i] = floor;
  }

  const annX     = bw - BOX_W - BOX_X;
  const boxEdgeX = annX;
  const hasOpen  = Object.keys(expandedSet).length > 0;
  const openOverlay = [];

  items.forEach((ann, idx) => {
    const boxY     = ys[idx];
    const isOpen   = !!expandedSet[ann.block];
    const isDimmed = hasOpen && !isOpen;
    const boxH     = isOpen ? BOX_H_OPEN : BOX_H_COMPACT;
    const boxCy    = boxY + boxH / 2;

    const dotX   = Math.min(ann.elR, boxEdgeX - 20);
    const elbowX = Math.max(dotX + 4, Math.min(boxEdgeX - 8, dotX + 28));

    const poly = svgEl('polyline', {
      points: [
        boxEdgeX + ',' + boxCy,
        elbowX   + ',' + boxCy,
        elbowX   + ',' + ann.elCy,
        dotX     + ',' + ann.elCy
      ].join(' '),
      fill: 'none',
      stroke: accent,
      'stroke-width':     isOpen ? '2.5' : '1.5',
      'stroke-dasharray': isOpen ? 'none' : '5 3',
      'stroke-linecap':   'round',
      'stroke-linejoin':  'round',
      opacity:            isOpen ? '0.95' : isDimmed ? '0.1' : '0.45'
    });
    svg.appendChild(poly);

    const dot = svgEl('circle', {
      cx: dotX, cy: ann.elCy,
      r:       isOpen ? '4.5' : '3',
      fill:    accent,
      opacity: isOpen ? '1' : isDimmed ? '0.12' : '0.8'
    });
    svg.appendChild(dot);

    if (!isOpen) {
      const bx = (elbowX + dotX) / 2;
      svg.appendChild(svgEl('circle', {
        cx: bx, cy: ann.elCy, r: '9',
        fill: accent, stroke: bg, 'stroke-width': '1.5',
        opacity: isDimmed ? '0.12' : '1'
      }));
      const nt = svgEl('text', {
        x: bx, y: ann.elCy + 3.5,
        'text-anchor': 'middle',
        'font-size':   ann.num >= 10 ? '7' : '8',
        'font-weight': '700',
        'font-family': 'system-ui, sans-serif',
        fill:    '#fff',
        opacity: isDimmed ? '0' : '1'
      });
      nt.textContent = ann.num;
      svg.appendChild(nt);
    } else {
      openOverlay.push(poly, dot);
    }

    const box = document.createElement('div');
    box.className = 'annot-box' + (isOpen ? ' is-open' : '') + (isDimmed ? ' is-dimmed' : '');
    box.dataset.annBlock = ann.block;
    box.style.cssText = 'left:' + annX + 'px;top:' + boxY + 'px;width:' + BOX_W + 'px';
    box.innerHTML =
      '<div class="annot-box__row">' +
        '<span class="annot-box__num">' + ann.num + '</span>' +
        '<span class="annot-box__what">' + esc(ann.what) + '</span>' +
        '<span class="annot-box__chevron">›</span>' +
      '</div>' +
      '<div class="annot-box__detail">' +
        '<span class="annot-box__desc">' + esc(ann.desc) + '</span>' +
        '<code class="annot-box__comp">' + esc(ann.comp) + '</code>' +
      '</div>';

    box.addEventListener('click', e => {
      const id = e.currentTarget.dataset.annBlock;
      if (expandedSet[id]) delete expandedSet[id]; else expandedSet[id] = true;
      layout();
    });

    document.body.appendChild(box);
    rendered.push(box);
  });

  /* Lift the open annotation's line + dot above every other SVG node */
  openOverlay.forEach(node => svg.appendChild(node));
}

/* ── Mode toggle ──────────────────────────────────────────────────────── */
function forceExpandShell() {
  const toc = document.querySelector('.docs-toc');
  const shell = document.querySelector('.docs-shell, body.docs-shell');
  shellSnap.toc = document.body.getAttribute('data-toc-collapsed') === 'true'
    || (toc && toc.hasAttribute('data-collapsed'));
  shellSnap.sidebar = shell && shell.classList.contains('is-sidebar-collapsed');

  if (toc) toc.removeAttribute('data-collapsed');
  document.body.removeAttribute('data-toc-collapsed');
  if (shell) shell.classList.remove('is-sidebar-collapsed');
}

function restoreShell() {
  const toc = document.querySelector('.docs-toc');
  const shell = document.querySelector('.docs-shell, body.docs-shell');
  if (shellSnap.toc) {
    if (toc) toc.setAttribute('data-collapsed', 'true');
    document.body.setAttribute('data-toc-collapsed', 'true');
  }
  if (shellSnap.sidebar && shell) shell.classList.add('is-sidebar-collapsed');
}

function setMode(on) {
  const html = document.documentElement;
  if (on) {
    forceExpandShell();
    html.classList.add('annot-mode');
    btn.setAttribute('aria-pressed', 'true');
    requestAnimationFrame(() => setTimeout(layout, 80));
  } else {
    html.classList.remove('annot-mode');
    btn.setAttribute('aria-pressed', 'false');
    cleanup();
    restoreShell();
  }
}

/* ── Boot ─────────────────────────────────────────────────────────────── */
function boot() {
  btn = injectToggle();
  svg = injectSVG();

  btn.addEventListener('click', () => {
    setMode(!document.documentElement.classList.contains('annot-mode'));
  });

  const delayed = () => {
    if (!document.documentElement.classList.contains('annot-mode')) return;
    clearTimeout(rTimer);
    rTimer = setTimeout(layout, 180);
  };

  window.addEventListener('resize', delayed);

  new MutationObserver(() => {
    if (!document.documentElement.classList.contains('annot-mode')) return;
    clearTimeout(rTimer);
    rTimer = setTimeout(layout, 80);
  }).observe(document.documentElement, { attributeFilter: ['data-theme'] });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
