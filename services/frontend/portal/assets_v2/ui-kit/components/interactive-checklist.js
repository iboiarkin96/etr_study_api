/* ui-kit/components/interactive-checklist.js
   Persistent checklist controller. State per checklist is stored in
   localStorage under `interactive-checklist:<storage-key>`.

   Mount:
     <div data-component="interactive-checklist" data-storage-key="sa-principles-v1">
       <div class="checklist-meta">
         <span class="checklist-meta__progress">
           <span class="checklist-meta__num">0</span>
           <span>/ N gates passed</span>
         </span>
         <span class="checklist-meta__bar"><span class="checklist-meta__bar-fill"></span></span>
         <button type="button" class="checklist-meta__reset">Reset</button>
       </div>
       <ol class="checklist-list">
         <li class="checklist-item" data-tone="accent">
           <label class="checklist-item__label">
             <input type="checkbox" class="checklist-item__input" data-check-id="diataxis">
             <span class="checklist-item__box" aria-hidden="true"></span>
             <div class="checklist-item__body">…</div>
           </label>
         </li>
         …
       </ol>
     </div>

   Required attributes:
     [data-storage-key]   on the wrapper — unique per checklist on the site.
     [data-check-id]      on each input  — unique within the checklist.

   The controller:
     - Restores ticked items from localStorage on mount.
     - Updates the count, the bar width, and the wrapper's
       `data-complete` flag on every change.
     - Wires the reset button to clear and re-render.
     - Fails silent on storage errors (private mode, quota). */

const STORAGE_PREFIX = "interactive-checklist:";

function readState(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeState(key, state) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  } catch (e) {
    /* private mode or quota — fail silent */
  }
}

function mountOne(root) {
  const storageKey = root.getAttribute("data-storage-key");
  if (!storageKey) return;

  const list = root.querySelector(".checklist-list");
  if (!list) return;

  const inputs = Array.from(list.querySelectorAll(".checklist-item__input"));
  const num    = root.querySelector(".checklist-meta__num");
  const fill   = root.querySelector(".checklist-meta__bar-fill");
  const meta   = root.querySelector(".checklist-meta");
  const reset  = root.querySelector(".checklist-meta__reset");
  const total  = inputs.length;

  function refresh() {
    let n = 0;
    const state = {};
    inputs.forEach((el) => {
      if (el.checked) {
        n++;
        state[el.dataset.checkId] = true;
      }
    });
    if (num)  num.textContent = String(n);
    if (fill) fill.style.width = (total ? (n * 100 / total) : 0) + "%";
    if (meta) meta.setAttribute("data-complete", n === total ? "true" : "false");
    writeState(storageKey, state);
  }

  const saved = readState(storageKey);
  inputs.forEach((el) => {
    if (saved[el.dataset.checkId]) el.checked = true;
  });
  refresh();

  inputs.forEach((el) => {
    el.addEventListener("change", refresh);
  });

  if (reset) {
    reset.addEventListener("click", () => {
      inputs.forEach((el) => { el.checked = false; });
      refresh();
    });
  }
}

export function mountInteractiveChecklist() {
  document
    .querySelectorAll('[data-component="interactive-checklist"]')
    .forEach(mountOne);
}
