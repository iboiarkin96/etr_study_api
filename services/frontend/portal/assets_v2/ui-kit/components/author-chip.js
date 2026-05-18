/* ui-kit/components/author-chip.js — renders an author chip into any
   [data-component="author-chip"] element.

   Attributes consumed:
     data-person-id    : 32-char hex (preferred)
     data-person-slug  : slug fallback (e.g. ivan-boyarkin)
     data-handle       : "@iboiarkin96" fallback
     data-variant      : "sm" | "" | "xl"  — controls layout
     data-src          : optional override for the maintainers JSON URL
     data-show-meta    : "false" hides handle/role even on default variant

   On hover the chip shows a native title with name + role. The whole chip is
   a link to the person's profile (no JS needed to navigate). */

import { loadMaintainers, lookupPerson } from "./_maintainers-data.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function render(el, person, variant, showMeta) {
  const cls = ["docs-author-chip"];
  if (variant === "sm") cls.push("docs-author-chip--sm");
  if (variant === "xl") cls.push("docs-author-chip--xl");

  if (!person) {
    el.setAttribute("data-state", "missing");
    el.className = cls.join(" ");
    el.innerHTML =
      `<span class="docs-author-chip__avatar docs-author-chip__avatar--fallback" aria-hidden="true">?</span>` +
      `<span class="docs-author-chip__body"><span class="docs-author-chip__name">Unknown contributor</span></span>`;
    return;
  }

  const isAnchor = el.tagName.toLowerCase() === "a";
  if (!isAnchor && person.profile) {
    // Wrap the chip in a link by setting role-by-tag via outer anchor? Too invasive.
    // Instead: if rendering into a non-anchor, leave content; consumer chose tag.
  }
  if (isAnchor && person.profile) {
    el.setAttribute("href", person.profile);
  }

  const title = [person.name, person.role].filter(Boolean).join(" — ");
  if (title) el.setAttribute("title", title);
  el.setAttribute("data-state", "ready");
  el.className = cls.join(" ");

  const handlePart = person.handle
    ? `<span class="docs-author-chip__meta-handle">@${escapeHtml(person.handle)}</span>`
    : "";
  const roleSep = person.handle && person.role ? `<span class="docs-author-chip__meta-sep">·</span>` : "";
  const rolePart = person.role ? escapeHtml(person.role) : "";
  const metaInner = [handlePart, roleSep, rolePart].filter(Boolean).join("");
  const metaHtml =
    showMeta && (handlePart || rolePart)
      ? `<span class="docs-author-chip__meta">${metaInner}</span>`
      : "";

  el.innerHTML =
    `<img class="docs-author-chip__avatar" src="${escapeHtml(person.avatar)}" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'docs-author-chip__avatar docs-author-chip__avatar--fallback',textContent:'${escapeHtml(initials(person.name))}'}))" />` +
    `<span class="docs-author-chip__body">` +
    `<span class="docs-author-chip__name">${escapeHtml(person.name)}</span>` +
    metaHtml +
    `</span>`;
}

export function mountAuthorChip(root = document) {
  const els = Array.from(
    root.querySelectorAll('[data-component="author-chip"]')
  ).filter((el) => el.dataset.authorChipBound !== "true");
  if (!els.length) return Promise.resolve();

  // Group by src so each unique JSON loads once.
  const groups = new Map();
  els.forEach((el) => {
    el.dataset.authorChipBound = "true";
    el.setAttribute("data-state", "loading");
    const src = el.dataset.src || "";
    if (!groups.has(src)) groups.set(src, []);
    groups.get(src).push(el);
  });

  return Promise.all(
    Array.from(groups.entries()).map(([src, list]) =>
      loadMaintainers(src).then((dir) => {
        list.forEach((el) => {
          const key =
            el.dataset.personId ||
            el.dataset.personSlug ||
            el.dataset.handle ||
            "";
          const person = lookupPerson(dir, key);
          const variant = (el.dataset.variant || "").toLowerCase();
          const showMeta = el.dataset.showMeta !== "false";
          render(el, person, variant, showMeta);
        });
      })
    )
  );
}
