/* ui-kit/components/portal-href.js — shared href resolver.

   Nav data and built-in defaults across the kit store paths as absolute
   `/services/portal/...` so the local dev server (which serves the repo root)
   resolves them directly. The GitHub Pages workflow mirrors `services/` as
   the artifact root, dropping the `services/` segment and prefixing the
   project base (e.g. `/etr_study_api/portal/...`).

   This helper rewrites a `/services/X` href to `<base>/X` based on the
   current pathname. Pass-through for everything else (relative, external,
   non-matching). */

export function resolvePortalHref(href) {
  if (!href || !href.startsWith("/services/")) return href;
  const m = window.location.pathname.match(/^(.*?)\/portal\//);
  if (!m) return href;
  return m[1] + href.slice("/services".length);
}
