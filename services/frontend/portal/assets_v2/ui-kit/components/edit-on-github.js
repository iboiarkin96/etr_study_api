/* ui-kit/components/edit-on-github.js — auto-inject "Edit this page on GitHub".

   Mount API
   ─────────
     mountEditOnGithub(root = document)
       • If <html data-edit-link="off">: returns silently.
       • If a slot exists ([data-component="edit-on-github"]): renders into it.
       • Otherwise: creates a fresh <a> inside <main>, immediately BEFORE
         <footer class="docs-history"> if present, else at the end of <main>.
       • Skips when the current pathname does not resolve to a repo-relative
         path (e.g. localhost root, file:// without docs prefix) — without a
         deterministic repo path we'd render a broken link.

   Configuration
   ─────────────
     window.__PORTAL_REPO  = "iboiarkin96/study_bot"    (override the repo)
     window.__PORTAL_BRANCH = "main"                    (override the branch)
   The defaults come from the same canonical repo used by other components.
*/

const DEFAULT_REPO = "iboiarkin96/study_bot";
const DEFAULT_BRANCH = "main";

const PENCIL_SVG = `
<svg class="docs-edit-link__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M12 20h9"/>
  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
</svg>`;

function repoConfig() {
  const win = typeof window !== "undefined" ? window : {};
  return {
    repo: win.__PORTAL_REPO || DEFAULT_REPO,
    branch: win.__PORTAL_BRANCH || DEFAULT_BRANCH,
  };
}

function repoRelativePath() {
  const pathname = (typeof window !== "undefined" && window.location.pathname) || "";
  // Strip leading slash and any deploy-prefix segments before "services/".
  const idx = pathname.indexOf("/services/");
  if (idx === -1) return null;
  const tail = pathname.slice(idx + 1); // drop the leading slash
  if (!tail || !tail.endsWith(".html")) return null;
  return tail;
}

function buildLink(slot) {
  const path = repoRelativePath();
  if (!path) return false;

  const { repo, branch } = repoConfig();
  const href = `https://github.com/${repo}/edit/${branch}/${path}`;

  slot.classList.add("docs-edit-link");
  slot.setAttribute("href", href);
  slot.setAttribute("rel", "external noopener");
  slot.setAttribute("target", "_blank");
  slot.setAttribute("aria-label", "Edit this page on GitHub");
  slot.innerHTML = `${PENCIL_SVG}<span>Edit this page on GitHub</span>`;
  return true;
}

function findOrCreateSlot(root) {
  const scope = root && root.querySelector ? root : document;
  const existing = scope.querySelector(
    '[data-component="edit-on-github"]:not([data-edit-link-mounted])'
  );
  if (existing) return existing;

  const main = document.querySelector("main");
  if (!main) return null;

  const slot = document.createElement("a");
  slot.setAttribute("data-component", "edit-on-github");

  const history = main.querySelector("footer.docs-history");
  if (history && history.parentNode) {
    history.parentNode.insertBefore(slot, history);
  } else {
    main.appendChild(slot);
  }
  return slot;
}

export function mountEditOnGithub(arg = document) {
  const html = document.documentElement;
  if (html && html.dataset.editLink === "off") return;

  const slot = findOrCreateSlot(arg);
  if (!slot || slot.dataset.editLinkMounted === "true") return;
  slot.dataset.editLinkMounted = "true";

  const ok = buildLink(slot);
  if (!ok && slot.parentNode && !slot.hasAttribute("data-keep-empty")) {
    // No repo-relative path resolvable; remove the empty <a> we created.
    slot.parentNode.removeChild(slot);
  }
}
