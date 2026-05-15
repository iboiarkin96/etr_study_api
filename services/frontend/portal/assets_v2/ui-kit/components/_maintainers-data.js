/* ui-kit/components/_maintainers-data.js — shared, cached fetch of the
   maintainers JSON. Imported by author-chip.js so we never hit the network
   more than once per page. */

const DEFAULT_SRC = "/services/frontend/portal/assets_v2/ui-kit/mocks/maintainers.json";

let cache = new Map(); // src -> Promise<{ peopleById, peopleBySlug }>

function indexPeople(people) {
  const byId = new Map();
  const bySlug = new Map();
  (people || []).forEach((p) => {
    if (p && p.id) byId.set(p.id, p);
    if (p && p.slug) bySlug.set(p.slug, p);
  });
  return { byId, bySlug };
}

export function loadMaintainers(src) {
  const url = src || DEFAULT_SRC;
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(url, { credentials: "same-origin" })
    .then((r) => {
      if (!r.ok) throw new Error(`maintainers fetch failed: ${r.status}`);
      return r.json();
    })
    .then((data) => indexPeople(data.people || []))
    .catch((err) => {
      console.warn("docs-maintainers:", err);
      return indexPeople([]);
    });
  cache.set(url, promise);
  return promise;
}

export function lookupPerson(directory, key) {
  if (!directory || !key) return null;
  // key may be an id, a slug, or a "@handle"
  if (directory.byId.has(key)) return directory.byId.get(key);
  if (directory.bySlug.has(key)) return directory.bySlug.get(key);
  const handle = key.startsWith("@") ? key.slice(1) : key;
  for (const p of directory.byId.values()) {
    if (p.handle && p.handle === handle) return p;
  }
  return null;
}
