/* ui-kit/components/search-badges.js — taxonomy for search-result kind chips.

   Pagefind exposes a `kind:<value>` meta on every page via the build-time
   pre-pass (see scripts/build_pagefind_index.py). When that meta is present
   we trust it; when it's missing (e.g. a hand-authored fallback) we fall
   back to URL pattern matching identical to the legacy ranker.
*/

const META_TO_LABEL = {
  adr: "ADR",
  rfc: "RFC",
  runbook: "Runbook",
  tutorial: "Tutorial",
  template: "Template",
  practice: "Practice",
  explanation: "Explanation",
  "how-to": "How-to",
  reference: "Reference",
  service: "Service",
  handbook: "Handbook",
  catalog: "Catalog",
  docs: "Docs",
};

function fromUrl(url) {
  const u = String(url || "").toLowerCase();
  if (!u) return "Docs";
  if (u.includes("/adr/") || /adr-\d+/.test(u)) return "ADR";
  if (u.includes("/runbooks/") || u.includes("/runbook/")) return "Runbook";
  if (u.includes("/openapi") || u.includes("/api/")) return "API";
  if (u.includes("/practices/")) return "Practice";
  if (u.includes("/templates/")) return "Template";
  if (u.includes("/components/")) return "Component";
  if (u.includes("/ui-kit/")) return "UI Kit";
  if (u.includes("/rfc/")) return "RFC";
  if (u.includes("/explanation/")) return "Explanation";
  if (u.includes("/how-to/")) return "How-to";
  if (u.includes("/tutorials/")) return "Tutorial";
  if (u.includes("/reference/")) return "Reference";
  return "Docs";
}

export function resultKind(metaKind, url) {
  if (metaKind) {
    const label = META_TO_LABEL[String(metaKind).toLowerCase()];
    if (label) return label;
  }
  return fromUrl(url);
}
