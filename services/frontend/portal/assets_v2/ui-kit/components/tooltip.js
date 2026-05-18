/* ui-kit/components/tooltip.js — premium inline tooltip runtime.

   Any element with [data-tooltip="text"] gets a hover/focus tooltip:
     • A single shared bubble is portalled to <body>, so the tooltip never
       gets clipped by overflow:hidden ancestors (tables, scrollers, sticky).
     • Placement is "top" by default; the bubble auto-flips to bottom/left/
       right if it would overflow the viewport. Override per-trigger with
       data-tooltip-placement="top|bottom|left|right".
     • Triggers without intrinsic focus (e.g. <span>, <svg-wrapping-div>)
       receive tabindex="0" so keyboard users can also reach the hint.
     • Wired ARIA: trigger gets aria-describedby pointing at the bubble's
       generated id; bubble has role="tooltip".
     • Esc dismisses while the trigger holds focus.

   The runtime uses one MutationObserver to discover triggers added later
   (e.g. components that mount asynchronously). No per-element listeners
   pile up — we use document-level capture-phase pointer/focus listeners. */

const TRIGGER_SELECTOR = "[data-tooltip]";
const SHOW_DELAY_MS = 160;
const HIDE_DELAY_MS = 80;
const VIEWPORT_PAD = 8;
const ARROW_INSET = 14;

const state = {
  bubble: null,
  bubbleId: "docs-tooltip-bubble",
  contentEl: null,
  arrowEl: null,
  activeTrigger: null,
  showTimer: null,
  hideTimer: null,
  observer: null,
  bound: false,
};

function ensureBubble() {
  if (state.bubble && document.body.contains(state.bubble)) return state.bubble;
  const bubble = document.createElement("div");
  bubble.id = state.bubbleId;
  bubble.className = "docs-tooltip-bubble";
  bubble.setAttribute("role", "tooltip");
  bubble.setAttribute("data-placement", "top");

  const content = document.createElement("span");
  content.className = "docs-tooltip-bubble__content";
  bubble.appendChild(content);

  const arrow = document.createElement("span");
  arrow.className = "docs-tooltip-bubble__arrow";
  arrow.setAttribute("aria-hidden", "true");
  bubble.appendChild(arrow);

  document.body.appendChild(bubble);
  state.bubble = bubble;
  state.contentEl = content;
  state.arrowEl = arrow;
  return bubble;
}

function normaliseTrigger(el) {
  if (!el || el.dataset.tooltipPrepared === "true") return;
  el.dataset.tooltipPrepared = "true";
  // Make non-focusable hosts reachable by keyboard. Skip for native
  // interactive elements (they already participate in tab order).
  const tag = el.tagName;
  const isFocusable =
    tag === "BUTTON" ||
    tag === "A" ||
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA" ||
    tag === "SUMMARY" ||
    el.hasAttribute("tabindex") ||
    el.isContentEditable;
  if (!isFocusable) {
    el.setAttribute("tabindex", "0");
  }
}

function prepareAll(root = document) {
  const scope = root.nodeType === 1 || root.nodeType === 9 ? root : document;
  scope.querySelectorAll(TRIGGER_SELECTOR).forEach(normaliseTrigger);
}

function clearTimers() {
  if (state.showTimer) {
    window.clearTimeout(state.showTimer);
    state.showTimer = null;
  }
  if (state.hideTimer) {
    window.clearTimeout(state.hideTimer);
    state.hideTimer = null;
  }
}

function place(trigger, placementHint) {
  const bubble = state.bubble;
  if (!bubble || !trigger.isConnected) return;
  const triggerRect = trigger.getBoundingClientRect();
  const bubbleRect = bubble.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const order = ["top", "bottom", "right", "left"];
  if (placementHint && order.includes(placementHint)) {
    order.splice(order.indexOf(placementHint), 1);
    order.unshift(placementHint);
  }

  const fits = (placement) => {
    const c = computeCoords(triggerRect, bubbleRect, placement);
    return (
      c.left >= VIEWPORT_PAD &&
      c.top >= VIEWPORT_PAD &&
      c.left + bubbleRect.width <= vw - VIEWPORT_PAD &&
      c.top + bubbleRect.height <= vh - VIEWPORT_PAD
    );
  };

  let chosen = order.find(fits) || placementHint || "top";
  const coords = computeCoords(triggerRect, bubbleRect, chosen);

  // Final viewport clamping so it never escapes the visible area even
  // when no placement fits perfectly (very small viewport).
  const left = Math.max(
    VIEWPORT_PAD,
    Math.min(coords.left, vw - bubbleRect.width - VIEWPORT_PAD)
  );
  const top = Math.max(
    VIEWPORT_PAD,
    Math.min(coords.top, vh - bubbleRect.height - VIEWPORT_PAD)
  );

  bubble.style.left = `${Math.round(left)}px`;
  bubble.style.top = `${Math.round(top)}px`;
  bubble.setAttribute("data-placement", chosen);

  placeArrow(triggerRect, { left, top, width: bubbleRect.width, height: bubbleRect.height }, chosen);
}

function computeCoords(triggerRect, bubbleRect, placement) {
  const gap = 10;
  const tcx = triggerRect.left + triggerRect.width / 2;
  const tcy = triggerRect.top + triggerRect.height / 2;
  switch (placement) {
    case "bottom":
      return {
        left: tcx - bubbleRect.width / 2,
        top: triggerRect.bottom + gap,
      };
    case "left":
      return {
        left: triggerRect.left - bubbleRect.width - gap,
        top: tcy - bubbleRect.height / 2,
      };
    case "right":
      return {
        left: triggerRect.right + gap,
        top: tcy - bubbleRect.height / 2,
      };
    case "top":
    default:
      return {
        left: tcx - bubbleRect.width / 2,
        top: triggerRect.top - bubbleRect.height - gap,
      };
  }
}

function placeArrow(triggerRect, bubbleBox, placement) {
  const arrow = state.arrowEl;
  if (!arrow) return;
  arrow.style.left = "";
  arrow.style.top = "";
  if (placement === "top" || placement === "bottom") {
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const relativeX = triggerCenterX - bubbleBox.left;
    const clamped = Math.max(
      ARROW_INSET,
      Math.min(relativeX, bubbleBox.width - ARROW_INSET)
    );
    arrow.style.left = `${Math.round(clamped - 5)}px`;
  } else {
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const relativeY = triggerCenterY - bubbleBox.top;
    const clamped = Math.max(
      ARROW_INSET,
      Math.min(relativeY, bubbleBox.height - ARROW_INSET)
    );
    arrow.style.top = `${Math.round(clamped - 5)}px`;
  }
}

function show(trigger) {
  const text = trigger.getAttribute("data-tooltip");
  if (!text) return;
  ensureBubble();
  clearTimers();
  state.activeTrigger = trigger;

  state.contentEl.textContent = text;
  state.bubble.classList.toggle(
    "is-glossary",
    trigger.classList.contains("docs-tooltip")
  );

  // ARIA wiring — link trigger to bubble for SR announcement.
  trigger.setAttribute("aria-describedby", state.bubbleId);

  // Reset visibility so the next show triggers a fresh enter transition.
  // Do NOT set inline opacity here — inline styles would override the
  // .is-visible class rule and keep the bubble invisible forever.
  state.bubble.classList.remove("is-visible");

  state.showTimer = window.setTimeout(() => {
    const placement = trigger.getAttribute("data-tooltip-placement") || "top";
    place(trigger, placement);
    requestAnimationFrame(() => {
      state.bubble.classList.add("is-visible");
    });
  }, SHOW_DELAY_MS);
}

function hide(immediate = false) {
  clearTimers();
  const finalize = () => {
    if (state.bubble) state.bubble.classList.remove("is-visible");
    if (state.activeTrigger) {
      state.activeTrigger.removeAttribute("aria-describedby");
      state.activeTrigger = null;
    }
  };
  if (immediate) {
    finalize();
    return;
  }
  state.hideTimer = window.setTimeout(finalize, HIDE_DELAY_MS);
}

function findTrigger(target) {
  if (!(target instanceof Element)) return null;
  return target.closest(TRIGGER_SELECTOR);
}

function onPointerOver(event) {
  const trigger = findTrigger(event.target);
  if (!trigger) return;
  if (trigger === state.activeTrigger) {
    clearTimers();
    return;
  }
  show(trigger);
}

function onPointerOut(event) {
  const trigger = findTrigger(event.target);
  if (!trigger || trigger !== state.activeTrigger) return;
  // related target inside the same trigger still counts as inside
  const related = event.relatedTarget;
  if (related instanceof Element && trigger.contains(related)) return;
  hide();
}

function onFocusIn(event) {
  const trigger = findTrigger(event.target);
  if (!trigger) return;
  show(trigger);
}

function onFocusOut(event) {
  const trigger = findTrigger(event.target);
  if (!trigger || trigger !== state.activeTrigger) return;
  hide();
}

function onKeyDown(event) {
  if (event.key === "Escape" && state.activeTrigger) {
    hide(true);
  }
}

function onScrollOrResize() {
  if (!state.activeTrigger) return;
  const placement =
    state.activeTrigger.getAttribute("data-tooltip-placement") || "top";
  place(state.activeTrigger, placement);
}

function bindGlobal() {
  if (state.bound) return;
  state.bound = true;
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
}

function observeFutureTriggers() {
  if (state.observer || typeof MutationObserver === "undefined") return;
  state.observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches(TRIGGER_SELECTOR)) {
          normaliseTrigger(node);
        }
        if (node.querySelectorAll) {
          node.querySelectorAll(TRIGGER_SELECTOR).forEach(normaliseTrigger);
        }
      });
    }
  });
  state.observer.observe(document.body, { childList: true, subtree: true });
}

export function mountTooltip(root = document) {
  if (typeof window === "undefined") return;
  ensureBubble();
  prepareAll(root);
  bindGlobal();
  observeFutureTriggers();
}
