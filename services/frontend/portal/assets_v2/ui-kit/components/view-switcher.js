/* ui-kit/components/view-switcher.js
   Segmented control — mounts from [data-component="view-switcher"].
   data-target  : CSS selector of the container whose data-view is toggled.
   data-default : initial view name (fallback: first button's data-view).
   data-storage-key : localStorage key for persisting view (default: "docs-view").
   Emits a custom event "viewchange" on the target element. */

export function mountViewSwitcher() {
  document.querySelectorAll('[data-component="view-switcher"]').forEach(el => {
    const targetSel  = el.getAttribute("data-target");
    const storageKey = el.getAttribute("data-storage-key") || "docs-view";
    const container  = targetSel ? document.querySelector(targetSel) : null;

    const btns = Array.from(el.querySelectorAll(".docs-view-switcher__btn"));
    if (!btns.length) return;

    const saved    = localStorage.getItem(storageKey);
    const fallback = btns[0].getAttribute("data-view") || "board";
    let   current  = saved && btns.some(b => b.getAttribute("data-view") === saved)
                     ? saved
                     : (el.getAttribute("data-default") || fallback);

    function activate(view) {
      current = view;
      btns.forEach(btn => {
        const on = btn.getAttribute("data-view") === view;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (container) {
        container.setAttribute("data-view", view);
        container.dispatchEvent(new CustomEvent("viewchange", { bubbles: true, detail: { view } }));
      }
      localStorage.setItem(storageKey, view);
    }

    activate(current);

    btns.forEach(btn => {
      btn.addEventListener("click", () => activate(btn.getAttribute("data-view") || fallback));
      btn.addEventListener("keydown", e => {
        const idx = btns.indexOf(btn);
        if (e.key === "ArrowRight") { e.preventDefault(); activate(btns[(idx + 1) % btns.length].getAttribute("data-view") || fallback); }
        if (e.key === "ArrowLeft")  { e.preventDefault(); activate(btns[(idx - 1 + btns.length) % btns.length].getAttribute("data-view") || fallback); }
      });
    });

    el.removeAttribute("data-component");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", el.getAttribute("aria-label") || "View");
  });
}
