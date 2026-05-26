/* ui-kit/components/multi-filter-chips.js
   Filter chip groups that cooperate over a multi-key URL hash.
   Each group declares which key it owns; many groups can share the hash:
       #sprint=2026-W20&profession=qa&status=open

   Mount on:
     <div data-component="multi-filter-chips"
          data-state-key="profession"
          data-default="all">
       <button class="docs-chip docs-chip--filter" data-value="all"        aria-pressed="true">All</button>
       <button class="docs-chip docs-chip--filter" data-value="qa"         aria-pressed="false">QA</button>
       …
     </div>

   The "default" value (typically "all") is treated as absence — it is written
   as "" to the hash so URLs without filters stay clean. Window-level
   "hashchange" keeps every group in sync with browser back/forward. The
   component dispatches a `multifilterchange` CustomEvent on window with
   detail `{ key, value }` whenever the user picks a new chip. */

function readHash() {
  const raw = (window.location.hash || "").replace(/^#/, "");
  return new URLSearchParams(raw);
}

function writeHash(params) {
  const str = params.toString();
  const hash = str ? "#" + str : "";
  if (history.replaceState) {
    history.replaceState(null, "", window.location.pathname + window.location.search + hash);
  } else {
    window.location.hash = hash;
  }
}

export function mountMultiFilterChips() {
  const groups = Array.from(document.querySelectorAll('[data-component="multi-filter-chips"]'));
  if (!groups.length) return;

  const controllers = [];

  groups.forEach(group => {
    const key = group.getAttribute("data-state-key");
    if (!key) return;
    const defaultValue = group.getAttribute("data-default") || "all";
    const chips = Array.from(group.querySelectorAll("[data-value]"));
    if (!chips.length) return;

    function activate(value, opts) {
      const opt = opts || {};
      let active = value;
      if (!chips.some(c => c.getAttribute("data-value") === active)) {
        active = defaultValue;
      }
      chips.forEach(c => {
        const on = c.getAttribute("data-value") === active;
        c.setAttribute("aria-pressed", on ? "true" : "false");
        c.classList.toggle("docs-chip--active", on);
      });
      if (opt.persist !== false) {
        const params = readHash();
        if (active === defaultValue) {
          params.delete(key);
        } else {
          params.set(key, active);
        }
        writeHash(params);
      }
      if (opt.emit !== false) {
        window.dispatchEvent(new CustomEvent("multifilterchange", {
          detail: { key, value: active },
        }));
      }
    }

    const initial = readHash().get(key) || defaultValue;
    activate(initial, { persist: false, emit: false });

    chips.forEach(chip => {
      chip.addEventListener("click", () => activate(chip.getAttribute("data-value") || defaultValue));
      chip.addEventListener("keydown", e => {
        const idx = chips.indexOf(chip);
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const next = chips[(idx + 1) % chips.length];
          next.focus();
          activate(next.getAttribute("data-value") || defaultValue);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const prev = chips[(idx - 1 + chips.length) % chips.length];
          prev.focus();
          activate(prev.getAttribute("data-value") || defaultValue);
        }
      });
    });

    group.removeAttribute("data-component");
    group.setAttribute("role", "group");
    if (!group.getAttribute("aria-label")) {
      group.setAttribute("aria-label", key);
    }

    controllers.push({ key, defaultValue, activate });
  });

  window.addEventListener("hashchange", () => {
    const params = readHash();
    controllers.forEach(({ key, defaultValue, activate }) => {
      activate(params.get(key) || defaultValue, { persist: false });
    });
  });
}
