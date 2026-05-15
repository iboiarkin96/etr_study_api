/* ui-kit/components/sparkline.js
   Mounts from [data-component="sparkline"].
   data-values      : comma-separated numbers (e.g. "3,7,5,9,12,10,14")
   data-color       : CSS color or var() (default: var(--accent))
   data-width       : SVG width in px (default: 80)
   data-height      : SVG height in px (default: 32) */

export function mountSparklines() {
  document.querySelectorAll('[data-component="sparkline"]').forEach((el, idx) => {
    const raw    = el.getAttribute("data-values") || "";
    const values = raw.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (values.length < 2) return;

    const w     = parseInt(el.getAttribute("data-width"), 10)  || 80;
    const h     = parseInt(el.getAttribute("data-height"), 10) || 32;
    const pad   = 2;
    const color = el.getAttribute("data-color") || "var(--accent)";
    const gid   = `sp-g-${idx}`;

    const min   = Math.min(...values);
    const max   = Math.max(...values);
    const range = max - min || 1;

    const pts = values.map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const ptsStr  = pts.join(" ");
    const lastPt  = pts[pts.length - 1].split(",");
    const fillPts = `${ptsStr} ${lastPt[0]},${h} ${pad},${h}`;

    el.innerHTML = `<svg class="docs-sparkline__svg"
      viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${color}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${fillPts}" fill="url(#${gid})"/>
      <polyline points="${ptsStr}" fill="none" stroke="${color}"
                stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    el.removeAttribute("data-component");
    el.classList.add("docs-sparkline");
  });
}
