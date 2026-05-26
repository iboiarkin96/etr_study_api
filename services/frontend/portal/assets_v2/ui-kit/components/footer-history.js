/* ui-kit/components/footer-history.js — make .docs-history collapsible.

   Transforms:
     <footer class="docs-history">
       <h2 class="docs-history__title">History</h2>
       <ul class="docs-history__list">…</ul>
     </footer>

   into:
     <footer class="docs-history" data-history-fold-mounted>
       <details class="docs-history__fold" open>
         <summary class="docs-history__summary">History</summary>
         <ul class="docs-history__list">…</ul>
       </details>
     </footer>

   Idempotent. Preserves the title's `id` (anchor targets keep working).
   Works on both <h2> and <p> title variants.
*/

export function mountFooterHistory(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  const footers = scope.querySelectorAll(
    "footer.docs-history:not([data-history-fold-mounted])"
  );
  footers.forEach((footer) => {
    const title = footer.querySelector(":scope > .docs-history__title");
    const list = footer.querySelector(":scope > .docs-history__list");
    if (!title || !list) return;

    const details = document.createElement("details");
    details.className = "docs-history__fold";
    details.open = false;

    const summary = document.createElement("summary");
    summary.className = "docs-history__summary";
    if (title.id) summary.id = title.id;
    summary.textContent = title.textContent || "History";

    // Insert details where the title sat, then move list into it.
    title.replaceWith(details);
    details.appendChild(summary);
    details.appendChild(list);

    footer.setAttribute("data-history-fold-mounted", "");
  });
}
