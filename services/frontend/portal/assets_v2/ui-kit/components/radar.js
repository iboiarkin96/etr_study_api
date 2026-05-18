/* ui-kit/components/radar.js
   Mounts every [data-component="radar"] element. Renders an SVG radar of N
   axes with two polygons (now / target) plus a legend that hover-syncs with
   the SVG vertices.

   Data attributes:
     data-axes      : JSON array of {label, now, target, group?, sub?}
                      • now / target are 0..scale (integers or decimals).
                      • group is an optional "A".."E" key for badge color.
                      • sub is an optional secondary label shown under the
                        axis title (e.g. cluster name).
     data-scale     : Max value on each axis (default 5)
     data-size      : SVG viewBox edge in px (default 360)
     data-title     : Optional title shown above the legend
     data-subtitle  : Optional helper line below the title
     data-caption   : Optional caption below the SVG
     data-now-label : Legend chip text (default "Now")
     data-target-label : Legend chip text (default "Target")

   The component is forgiving — bad JSON or fewer than 3 axes renders nothing
   and removes its data-component so future mounts skip it.
*/

const NS = "http://www.w3.org/2000/svg";

function el(name, attrs, children) {
  const node = document.createElementNS(NS, name);
  if (attrs) {
    for (const k in attrs) {
      if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    }
  }
  if (children) {
    for (const c of children) if (c) node.appendChild(c);
  }
  return node;
}

function htmlEl(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function parseAxes(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((a) => a && typeof a === "object" && typeof a.label === "string")
      .map((a) => ({
        label: a.label,
        sub: typeof a.sub === "string" ? a.sub : "",
        now: clamp01(Number(a.now)),
        target: clamp01(Number(a.target)),
        group: typeof a.group === "string" ? a.group.toUpperCase() : "",
      }));
  } catch (e) {
    return [];
  }
}

function clamp01(v) {
  return isFinite(v) ? Math.max(0, v) : 0;
}

function polarToXY(cx, cy, r, angleRad) {
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)];
}

function fmt(n) {
  return Math.round(n * 10) / 10;
}

function buildSvg(axes, scale, size) {
  const padding = Math.round(size * 0.18); // room for outer labels
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - padding * 2) / 2;
  const N = axes.length;

  // Each axis at angle = -π/2 + 2π * i / N (north-up).
  const angles = axes.map((_, i) => -Math.PI / 2 + (2 * Math.PI * i) / N);

  const svg = el("svg", {
    class: "docs-radar__svg",
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-hidden": "false",
    "aria-label": "Skills radar chart",
  });

  // Concentric scale polygons (1..scale).
  for (let s = 1; s <= scale; s++) {
    const rs = (r * s) / scale;
    const pts = angles
      .map((a) => {
        const [x, y] = polarToXY(cx, cy, rs, a);
        return `${fmt(x)},${fmt(y)}`;
      })
      .join(" ");
    svg.appendChild(
      el("polygon", {
        class: "docs-radar__ring" + (s === scale ? " docs-radar__ring--outer" : ""),
        points: pts,
      })
    );
  }

  // Spokes + outer labels.
  axes.forEach((axis, i) => {
    const a = angles[i];
    const [x2, y2] = polarToXY(cx, cy, r, a);
    svg.appendChild(
      el("line", {
        class: "docs-radar__axis-line",
        x1: cx,
        y1: cy,
        x2: fmt(x2),
        y2: fmt(y2),
      })
    );

    // Outer label position — pushed slightly past the ring.
    const labelR = r + Math.max(14, padding * 0.45);
    const [lx, ly] = polarToXY(cx, cy, labelR, a);

    const cos = Math.cos(a);
    let anchor = "middle";
    if (cos > 0.2) anchor = "start";
    else if (cos < -0.2) anchor = "end";

    const labelGroup = el("g", {
      class: "docs-radar__axis",
      "data-axis": String(i),
    });
    const labelText = el("text", {
      class: "docs-radar__axis-label",
      x: fmt(lx),
      y: fmt(ly),
      "text-anchor": anchor,
      "dominant-baseline": "middle",
    });
    labelText.textContent = axis.label;
    labelGroup.appendChild(labelText);

    if (axis.sub) {
      const subY = ly + 13;
      const sub = el("text", {
        class: "docs-radar__axis-label-sub",
        x: fmt(lx),
        y: fmt(subY),
        "text-anchor": anchor,
        "dominant-baseline": "middle",
      });
      sub.textContent = axis.sub;
      labelGroup.appendChild(sub);
    }
    svg.appendChild(labelGroup);
  });

  // Scale numbers on the first axis (top).
  const axis0 = angles[0];
  for (let s = 1; s <= scale; s++) {
    const rs = (r * s) / scale;
    const [tx, ty] = polarToXY(cx, cy, rs, axis0);
    const text = el("text", {
      class: "docs-radar__scale-label",
      x: fmt(tx + 4),
      y: fmt(ty),
      "text-anchor": "start",
      "dominant-baseline": "middle",
    });
    text.textContent = String(s);
    svg.appendChild(text);
  }

  // Polygons: target first (so now sits on top).
  const targetPts = axes
    .map((axis, i) => {
      const rs = (r * Math.min(axis.target, scale)) / scale;
      const [x, y] = polarToXY(cx, cy, rs, angles[i]);
      return `${fmt(x)},${fmt(y)}`;
    })
    .join(" ");
  const nowPts = axes
    .map((axis, i) => {
      const rs = (r * Math.min(axis.now, scale)) / scale;
      const [x, y] = polarToXY(cx, cy, rs, angles[i]);
      return `${fmt(x)},${fmt(y)}`;
    })
    .join(" ");

  svg.appendChild(
    el("polygon", { class: "docs-radar__poly--target", points: targetPts })
  );
  svg.appendChild(
    el("polygon", { class: "docs-radar__poly--now", points: nowPts })
  );

  // Vertex dots per axis, grouped so they react to legend hover.
  axes.forEach((axis, i) => {
    const a = angles[i];
    const rnow = (r * Math.min(axis.now, scale)) / scale;
    const rtarget = (r * Math.min(axis.target, scale)) / scale;
    const [nx, ny] = polarToXY(cx, cy, rnow, a);
    const [tx, ty] = polarToXY(cx, cy, rtarget, a);

    const group = el("g", {
      class: "docs-radar__axis",
      "data-axis": String(i),
    });

    group.appendChild(
      el("circle", {
        class: "docs-radar__dot docs-radar__dot--target",
        cx: fmt(tx),
        cy: fmt(ty),
        r: 4,
      })
    );
    group.appendChild(
      el("circle", {
        class: "docs-radar__dot docs-radar__dot--now",
        cx: fmt(nx),
        cy: fmt(ny),
        r: 4,
      })
    );

    // Invisible hot-spot strip spanning center → outer edge to make hovering
    // the axis easy.
    const [hx, hy] = polarToXY(cx, cy, r + 4, a);
    const perp = a + Math.PI / 2;
    const hw = Math.max(14, r / N);
    const [ax1, ay1] = polarToXY(cx, cy, hw / 2, perp);
    const [ax2, ay2] = polarToXY(cx, cy, hw / 2, perp + Math.PI);
    const p1 = `${fmt(cx + (ax1 - cx))},${fmt(cy + (ay1 - cy))}`;
    const p2 = `${fmt(cx + (ax2 - cx))},${fmt(cy + (ay2 - cy))}`;
    const p3 = `${fmt(hx + (ax2 - cx))},${fmt(hy + (ay2 - cy))}`;
    const p4 = `${fmt(hx + (ax1 - cx))},${fmt(hy + (ay1 - cy))}`;
    group.appendChild(
      el("polygon", {
        class: "docs-radar__axis-hot",
        points: `${p1} ${p2} ${p3} ${p4}`,
      })
    );
    svg.appendChild(group);
  });

  return svg;
}

function buildLegend(axes, scale, labels) {
  const list = htmlEl("ol", "docs-radar__legend");
  list.setAttribute("aria-label", "Per-axis breakdown");

  axes.forEach((axis, i) => {
    const row = htmlEl("button", "docs-radar__row");
    row.type = "button";
    row.setAttribute("data-axis", String(i));
    row.setAttribute(
      "aria-label",
      `${axis.label}: ${labels.now} ${fmt(axis.now)} of ${scale}, ${labels.target} ${fmt(axis.target)} of ${scale}`
    );

    const badge = htmlEl("span", "docs-radar__badge", String(i + 1));
    if (axis.group) badge.setAttribute("data-group", axis.group);
    row.appendChild(badge);

    const label = htmlEl("span", "docs-radar__label", axis.label);
    row.appendChild(label);

    const scores = htmlEl("span", "docs-radar__scores");
    const sNow = htmlEl("span", "docs-radar__score");
    sNow.appendChild(htmlEl("span", "docs-radar__score-dot docs-radar__score-dot--now"));
    sNow.appendChild(document.createTextNode(`${fmt(axis.now)}`));
    const sTarget = htmlEl("span", "docs-radar__score");
    sTarget.appendChild(htmlEl("span", "docs-radar__score-dot docs-radar__score-dot--target"));
    sTarget.appendChild(document.createTextNode(`${fmt(axis.target)}`));
    scores.appendChild(sNow);
    scores.appendChild(sTarget);
    row.appendChild(scores);

    const diff = fmt(axis.target - axis.now);
    const tone = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const delta = htmlEl(
      "span",
      "docs-radar__delta",
      (diff > 0 ? "+" : "") + diff
    );
    delta.setAttribute("data-tone", tone);
    row.appendChild(delta);

    const li = document.createElement("li");
    li.appendChild(row);
    list.appendChild(li);
  });

  return list;
}

function wireSync(figure) {
  const groups = figure.querySelectorAll("svg .docs-radar__axis");
  const rows = figure.querySelectorAll(".docs-radar__row");

  function setActive(idx, on) {
    groups.forEach((g) => {
      if (g.getAttribute("data-axis") === String(idx)) {
        if (on) g.setAttribute("data-active", "true");
        else g.removeAttribute("data-active");
      }
    });
    rows.forEach((r) => {
      if (r.getAttribute("data-axis") === String(idx)) {
        if (on) r.setAttribute("data-active", "true");
        else r.removeAttribute("data-active");
      }
    });
  }

  function bind(node, idx) {
    node.addEventListener("mouseenter", () => setActive(idx, true));
    node.addEventListener("mouseleave", () => setActive(idx, false));
    node.addEventListener("focus", () => setActive(idx, true));
    node.addEventListener("blur", () => setActive(idx, false));
  }

  groups.forEach((g) => bind(g, Number(g.getAttribute("data-axis"))));
  rows.forEach((r) => bind(r, Number(r.getAttribute("data-axis"))));
}

function mountOne(figure) {
  const axes = parseAxes(figure.getAttribute("data-axes"));
  const scale = Math.max(2, parseInt(figure.getAttribute("data-scale"), 10) || 5);
  const size = Math.max(180, parseInt(figure.getAttribute("data-size"), 10) || 360);
  const title = figure.getAttribute("data-title") || "";
  const subtitle = figure.getAttribute("data-subtitle") || "";
  const caption = figure.getAttribute("data-caption") || "";
  const labels = {
    now: figure.getAttribute("data-now-label") || "Now",
    target: figure.getAttribute("data-target-label") || "Target",
  };

  if (axes.length < 3) {
    figure.removeAttribute("data-component");
    return;
  }

  figure.classList.add("docs-radar");
  figure.innerHTML = "";

  // Left: chart.
  const chart = htmlEl("div", "docs-radar__chart");
  chart.appendChild(buildSvg(axes, scale, size));
  if (caption) {
    const cap = document.createElement("figcaption");
    cap.className = "docs-radar__caption";
    cap.textContent = caption;
    chart.appendChild(cap);
  }
  figure.appendChild(chart);

  // Right: title + legend.
  const side = htmlEl("div", "docs-radar__side");
  if (title) side.appendChild(htmlEl("h3", "docs-radar__title", title));
  if (subtitle) side.appendChild(htmlEl("p", "docs-radar__subtitle", subtitle));

  const keys = htmlEl("div", "docs-radar__keys");
  keys.setAttribute("aria-hidden", "true");
  const nowKey = htmlEl("span", "docs-radar__key");
  nowKey.appendChild(htmlEl("span", "docs-radar__swatch docs-radar__swatch--now"));
  nowKey.appendChild(document.createTextNode(labels.now));
  const targetKey = htmlEl("span", "docs-radar__key");
  targetKey.appendChild(htmlEl("span", "docs-radar__swatch docs-radar__swatch--target"));
  targetKey.appendChild(document.createTextNode(labels.target));
  keys.appendChild(nowKey);
  keys.appendChild(targetKey);
  side.appendChild(keys);

  side.appendChild(buildLegend(axes, scale, labels));
  figure.appendChild(side);

  wireSync(figure);
  figure.removeAttribute("data-component");
}

export function mountRadars(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-component="radar"]').forEach(mountOne);
}
