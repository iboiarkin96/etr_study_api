/* ui-kit/components/feedback-widget.js — per-page "was this useful?" widget.

   Mount API
   ─────────
     mountFeedbackWidget(root = document)
       • If <html data-feedback="off"> or [data-page-type] is missing/empty:
         returns silently (skip landing tiles, error pages, showcase frames).
       • If a slot exists ([data-component="feedback-widget"]): renders into it.
       • Otherwise: creates a fresh <aside data-component="feedback-widget">
         inside <main>, immediately BEFORE <footer class="docs-history"> if it
         exists, else at the end of the article/main element.
     Idempotent: never re-renders a slot that already booted.

   Storage
   ───────
     Votes and comments persist in window.localStorage under the key
     "docs-feedback-v1". Each entry: { url, vote, comment, ts }. No identifiers,
     no PII — comments are user-typed free text only. The list is cap-bounded
     (FIFO at 200 entries) so the key never grows unbounded.

   Privacy posture
   ───────────────
     • No network calls; nothing leaves the browser.
     • Future: an opt-in endpoint can read the same store and POST entries
       in batch. The component remains the single source.
     • The widget renders an explicit privacy line under the action row.
*/

const STORAGE_KEY = "docs-feedback-v1";
const MAX_ENTRIES = 200;
const COMMENT_MAX = 240;

const SKIP_PAGE_TYPES = new Set([
  "",
  "landing",
  "landing-directory",
  "landing-section",
  "cockpit",
  "profile",
  "profile-notes",
  "tombstone",
]);

function readEntries() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function writeEntries(entries) {
  try {
    const trimmed = entries.slice(-MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_e) {
    /* quota or disabled — silently no-op; widget UX continues. */
  }
}

function pageKey() {
  const path = window.location.pathname || "(home)";
  return path.replace(/\/+$/, "") || "/";
}

function appendEntry(vote, comment) {
  const entries = readEntries();
  entries.push({
    url: pageKey(),
    vote,
    comment: comment ? String(comment).slice(0, COMMENT_MAX) : "",
    ts: new Date().toISOString(),
  });
  writeEntries(entries);
}

function hasVotedForThisPage() {
  const key = pageKey();
  return readEntries().some((entry) => entry.url === key);
}

function buildWidget(slot) {
  slot.className = "docs-feedback";
  slot.setAttribute("aria-label", "Page feedback");
  slot.dataset.state = "initial";
  slot.dataset.expanded = "false";

  slot.innerHTML = `
    <div class="docs-feedback__row">
      <p class="docs-feedback__prompt">Was this page useful?</p>
      <div class="docs-feedback__actions" role="group" aria-label="Vote">
        <button type="button" class="docs-feedback__btn" data-vote="yes" aria-pressed="false">👍 Yes</button>
        <button type="button" class="docs-feedback__btn" data-vote="no" aria-pressed="false">👎 Could be better</button>
      </div>
    </div>
    <div class="docs-feedback__expand" aria-hidden="true">
      <label class="docs-feedback__label" for="docs-feedback-comment">What's missing or confusing? (optional)</label>
      <textarea
        id="docs-feedback-comment"
        class="docs-feedback__textarea"
        maxlength="${COMMENT_MAX}"
        placeholder="One short sentence is enough."
      ></textarea>
      <p class="docs-feedback__counter"><span data-feedback-count>0</span>/${COMMENT_MAX}</p>
      <button type="button" class="docs-feedback__btn docs-feedback__submit" data-feedback-submit disabled>Send</button>
    </div>
    <p class="docs-feedback__thanks" hidden>Thanks — your feedback is stored locally on this device. No identifiers, no network.</p>
    <p class="docs-feedback__privacy">Stored locally on your device only. No identifiers, no network requests.</p>
  `;

  const yesBtn = slot.querySelector('[data-vote="yes"]');
  const noBtn = slot.querySelector('[data-vote="no"]');
  const textarea = slot.querySelector(".docs-feedback__textarea");
  const counter = slot.querySelector("[data-feedback-count]");
  const submit = slot.querySelector("[data-feedback-submit]");
  const thanks = slot.querySelector(".docs-feedback__thanks");

  function thank() {
    slot.dataset.state = "thanked";
    if (thanks) thanks.hidden = false;
  }

  yesBtn.addEventListener("click", () => {
    yesBtn.setAttribute("aria-pressed", "true");
    noBtn.setAttribute("aria-pressed", "false");
    appendEntry("yes", "");
    thank();
  });

  noBtn.addEventListener("click", () => {
    noBtn.setAttribute("aria-pressed", "true");
    yesBtn.setAttribute("aria-pressed", "false");
    slot.dataset.expanded = "true";
    if (textarea) {
      textarea.focus();
    }
  });

  textarea.addEventListener("input", () => {
    const len = textarea.value.length;
    if (counter) counter.textContent = String(len);
    submit.disabled = len === 0;
  });

  submit.addEventListener("click", () => {
    appendEntry("no", textarea.value);
    thank();
  });

  if (hasVotedForThisPage()) thank();
}

function shouldSkip() {
  const html = document.documentElement;
  if (html && html.dataset.feedback === "off") return true;

  const body = document.body;
  const pageType = body ? body.dataset.pageType : "";
  if (SKIP_PAGE_TYPES.has(pageType || "")) return true;

  return false;
}

function findOrCreateSlot(root) {
  const scope =
    root && root.querySelector ? root : document;
  const existing = scope.querySelector(
    '[data-component="feedback-widget"]:not([data-feedback-mounted])'
  );
  if (existing) return existing;

  const main = document.querySelector("main");
  if (!main) return null;

  const slot = document.createElement("aside");
  slot.setAttribute("data-component", "feedback-widget");

  // Place before docs-history if present so feedback sits between the
  // article body and the history footer; else append to the article.
  const history = main.querySelector("footer.docs-history");
  if (history && history.parentNode) {
    history.parentNode.insertBefore(slot, history);
  } else {
    const article = main.querySelector(".docs-prose, article");
    if (article && article.parentNode) {
      article.parentNode.insertBefore(slot, article.nextSibling);
    } else {
      main.appendChild(slot);
    }
  }
  return slot;
}

/* Debug helper exposed on window so a reviewer can pull stored feedback
   straight from DevTools without a backend. Returns the entries; also
   triggers a JSON download when called with { download: true }. */
function dumpFeedback({ download = false } = {}) {
  const entries = readEntries();
  if (download && typeof document !== "undefined") {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `docs-feedback-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
  return entries;
}

if (typeof window !== "undefined") {
  window.__docsFeedbackDump = dumpFeedback;
}

export function mountFeedbackWidget(arg = document) {
  if (shouldSkip()) return;

  const slot = findOrCreateSlot(arg);
  if (!slot || slot.dataset.feedbackMounted === "true") return;
  slot.dataset.feedbackMounted = "true";
  buildWidget(slot);
}
