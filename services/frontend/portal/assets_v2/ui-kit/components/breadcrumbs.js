/* ui-kit/components/breadcrumbs.js — auto-generate trail from window.location.pathname
   when the container is empty. Idempotent: if the list already exists, skip. */

const PORTAL_LABELS = {
  internal: "Internal",
  public: "Public",
  docs: "Docs",
};

const SEGMENT_LABELS = {
  governance: "Governance",
  backlog: "Backlog",
  analysis: "Analysis",
  api: "API",
  catalog: "Catalog",
  front: "Frontend",
  handbook: "Handbook",
  manager: "Manager",
  sre: "SRE",
  team: "Team",
  uml: "UML",
  rfc: "RFC",
  adr: "ADR",
};

function humanize(segment) {
  if (!segment) return "";
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTrail(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return [];
  const portal = document.documentElement.getAttribute("data-portal") || "internal";
  const trail = [{ label: PORTAL_LABELS[portal] || "Home", href: "/" }];
  let acc = "";
  parts.forEach((part) => {
    acc += "/" + part;
    trail.push({ label: humanize(part.replace(/\.html?$/, "")), href: acc });
  });
  return trail;
}

function render(container, trail) {
  const list = document.createElement("ol");
  list.className = "docs-breadcrumbs__list";
  trail.forEach((node, i) => {
    const item = document.createElement("li");
    item.className = "docs-breadcrumbs__item";
    const isLast = i === trail.length - 1;
    if (isLast) {
      const span = document.createElement("span");
      span.className = "docs-breadcrumbs__current";
      span.setAttribute("aria-current", "page");
      span.textContent = node.label;
      item.appendChild(span);
    } else {
      const a = document.createElement("a");
      a.className = "docs-breadcrumbs__link";
      a.href = node.href;
      a.textContent = node.label;
      item.appendChild(a);
      const sep = document.createElement("span");
      sep.className = "docs-breadcrumbs__sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "/";
      item.appendChild(sep);
    }
    list.appendChild(item);
  });
  container.classList.add("docs-breadcrumbs");
  container.innerHTML = "";
  container.appendChild(list);
}

export function mountBreadcrumbs(root = document) {
  const nodes = root.querySelectorAll('[data-component="breadcrumbs"]');
  nodes.forEach((node) => {
    if (node.querySelector(".docs-breadcrumbs__list")) return;
    const trail = buildTrail(window.location.pathname);
    if (trail.length > 1) render(node, trail);
  });
}
