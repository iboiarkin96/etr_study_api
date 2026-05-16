/* ui-kit/components/v3/margin-rail.js — positions .studio-margin-note
   absolutely inside .studio-rail so each note sits opposite its anchor
   paragraph. No-op on viewports ≤ 1024px. Idempotent.

   Markup contract:
     <div class="studio-spread">
       <article class="studio-prose">
         <p id="p-1">…</p>
       </article>
       <aside class="studio-rail">
         <aside class="studio-margin-note" data-anchor="p-1">…</aside>
       </aside>
     </div>

   Behaviour:
   - matches viewport ≥ 1025: position: absolute; top = anchor.offsetTop relative
     to spread, recomputed on resize via ResizeObserver.
   - viewport ≤ 1024: clears positioning so CSS-driven inline flow takes over.
   - reduced-motion: skips fade-in transition (CSS already gates that). */

const BOUND = "data-margin-rail-bound";
const DESKTOP_QUERY = "(min-width: 1025px)";

function getSpread(rail) {
  return rail.closest(".studio-spread");
}

function getReadingColumn(spread) {
  return spread.querySelector(".studio-prose, article");
}

function positionNotes(rail) {
  const spread = getSpread(rail);
  if (!spread) return;
  const article = getReadingColumn(spread);
  if (!article) return;

  const spreadRect = spread.getBoundingClientRect();
  const articleRect = article.getBoundingClientRect();
  const baseTop = articleRect.top - spreadRect.top;

  const notes = rail.querySelectorAll(".studio-margin-note[data-anchor]");
  let lastBottom = -Infinity;
  const minGap = 16;

  notes.forEach((note) => {
    const id = note.getAttribute("data-anchor");
    if (!id) return;
    const target = article.querySelector("#" + CSS.escape(id));
    if (!target) {
      note.removeAttribute("data-positioned");
      return;
    }
    const targetTop = target.offsetTop + baseTop - article.offsetTop;
    const top = Math.max(targetTop, lastBottom + minGap);
    note.style.top = top + "px";
    note.style.left = "0";
    note.style.right = "0";
    note.setAttribute("data-positioned", "true");
    lastBottom = top + note.offsetHeight;
  });
}

function clearNotes(rail) {
  rail.querySelectorAll(".studio-margin-note").forEach((note) => {
    note.style.top = "";
    note.style.left = "";
    note.style.right = "";
    note.removeAttribute("data-positioned");
  });
}

export function mountStudioMarginRail(root = document) {
  const rails = root.querySelectorAll(
    '.studio-rail:not([' + BOUND + '])'
  );
  if (!rails.length) return;

  const mq = window.matchMedia(DESKTOP_QUERY);

  rails.forEach((rail) => {
    rail.setAttribute(BOUND, "true");

    const apply = () => {
      if (mq.matches) {
        positionNotes(rail);
      } else {
        clearNotes(rail);
      }
    };

    apply();

    const spread = getSpread(rail);
    if (spread && "ResizeObserver" in window) {
      const ro = new ResizeObserver(() => apply());
      ro.observe(spread);
      const article = getReadingColumn(spread);
      if (article) ro.observe(article);
    }

    if ("addEventListener" in mq) {
      mq.addEventListener("change", apply);
    } else if ("addListener" in mq) {
      mq.addListener(apply);
    }

    if ("MutationObserver" in window) {
      const mo = new MutationObserver(() => apply());
      mo.observe(rail, { childList: true, subtree: false });
    }

    window.addEventListener("load", apply, { once: true });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => mountStudioMarginRail(),
      { once: true }
    );
  } else {
    mountStudioMarginRail();
  }
}
