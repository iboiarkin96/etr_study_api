/* ui-kit/components/bug-report.js — topbar bug-report button + modal.

   Ported from the legacy report-bug FAB + docs-feedback modal in
   services/frontend/portal/assets/docs-nav.js. Two behavioural shifts vs. the
   legacy:
     - The trigger lives in the topbar (next to the theme toggle) instead of a
       fixed-position FAB anchored to the viewport corner.
     - There is a single modal instance shared by every trigger — page-level
       triggers can opt in with `data-component="bug-report"` or any
       `[data-bug-report-open]` element. */

const REPO = "iboiarkin96/study_bot";
const TEMPLATE = "docs_feedback.md";
const LABELS = ["docs-feedback"];

const FEEDBACK_TYPES = [
  "Incorrect or outdated content",
  "Missing explanation",
  "Broken link or navigation",
  "Visual / layout bug",
  "Accessibility issue",
  "Other",
];

const BUG_SVG = `
<svg class="docs-bug-report-btn__icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path class="bug-antenna bug-antenna--l" d="M9 7 Q8 4 6 3"/>
  <path class="bug-antenna bug-antenna--r" d="M15 7 Q16 4 18 3"/>
  <g class="bug-body">
    <ellipse cx="12" cy="14" rx="4.6" ry="5.6"/>
    <line x1="12" y1="9" x2="12" y2="19.5"/>
    <path d="M7.5 12 L4.5 11"/>
    <path d="M7.5 14.5 L4 14.5"/>
    <path d="M7.5 17 L4.5 18.5"/>
    <path d="M16.5 12 L19.5 11"/>
    <path d="M16.5 14.5 L20 14.5"/>
    <path d="M16.5 17 L19.5 18.5"/>
  </g>
</svg>`;

function currentPagePath() {
  // The legacy implementation built a docs-relative path; for v2 we keep the
  // full pathname so the issue body links work in any deploy environment.
  return window.location.pathname.replace(/^\/+/, "") || "(home)";
}

function buildIssueUrl(message, feedbackType) {
  const pagePath = currentPagePath();
  const pageUrl = /^https?:/i.test(window.location.href) ? window.location.href : pagePath;
  const title = `[Docs feedback] ${pagePath}`;
  const body = [
    "## Page",
    pagePath,
    "",
    "## URL",
    pageUrl,
    "",
    "## Feedback type",
    feedbackType || "Other",
    "",
    "## What should be improved",
    (message || "").trim() || "<!-- Describe the issue and expected fix -->",
    "",
    "## Additional context",
    "<!-- Optional: screenshots, references, related pages -->",
  ].join("\n");

  const query = new URLSearchParams({
    template: TEMPLATE,
    title,
    labels: LABELS.join(","),
    body,
  });
  return `https://github.com/${REPO}/issues/new?${query.toString()}`;
}

let modalEl = null;
let lastFocused = null;
let textareaEl = null;
let selectEl = null;
let statusEl = null;
let submitEl = null;
let keydownHandler = null;

function ensureModal() {
  if (modalEl) return modalEl;

  const modal = document.createElement("section");
  modal.className = "docs-bug-report-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.id = "docs-bug-report-modal";

  const backdrop = document.createElement("div");
  backdrop.className = "docs-bug-report-modal__backdrop";
  backdrop.addEventListener("click", closeModal);

  const panel = document.createElement("div");
  panel.className = "docs-bug-report-modal__panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "docs-bug-report-title");

  const head = document.createElement("header");
  head.className = "docs-bug-report-modal__head";

  const title = document.createElement("h2");
  title.id = "docs-bug-report-title";
  title.className = "docs-bug-report-modal__title";
  title.textContent = "Report a bug";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "docs-bug-report-modal__close";
  close.setAttribute("aria-label", "Close bug-report form");
  close.setAttribute("data-tooltip", "Close this form (Esc)");
  close.setAttribute("data-tooltip-placement", "left");
  close.innerHTML = "&times;";
  close.addEventListener("click", closeModal);

  head.appendChild(title);
  head.appendChild(close);

  const body = document.createElement("div");
  body.className = "docs-bug-report-modal__body";

  const intro = document.createElement("p");
  intro.className = "docs-bug-report-modal__intro";
  intro.textContent =
    "Found something unclear, outdated, or broken on this page? Send a prefilled GitHub issue — the page URL and your description are filled in for you.";

  const form = document.createElement("form");
  form.className = "docs-bug-report-form";

  const typeField = document.createElement("div");
  typeField.className = "docs-bug-report-form__field";

  const typeLabel = document.createElement("label");
  typeLabel.className = "docs-bug-report-form__label";
  typeLabel.setAttribute("for", "docs-bug-report-type");
  typeLabel.textContent = "Feedback type";

  const select = document.createElement("select");
  select.id = "docs-bug-report-type";
  select.className = "docs-bug-report-form__select";
  FEEDBACK_TYPES.forEach((label) => {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  });
  select.value = "Other";

  typeField.appendChild(typeLabel);
  typeField.appendChild(select);

  const textField = document.createElement("div");
  textField.className = "docs-bug-report-form__field";

  const textLabel = document.createElement("label");
  textLabel.className = "docs-bug-report-form__label";
  textLabel.setAttribute("for", "docs-bug-report-text");
  textLabel.textContent = "What should be improved?";

  const textarea = document.createElement("textarea");
  textarea.id = "docs-bug-report-text";
  textarea.className = "docs-bug-report-form__textarea";
  textarea.rows = 4;
  textarea.minLength = 10;
  textarea.placeholder =
    "Example: the chevron tooltip overlaps the sidebar on dark theme.";
  textarea.required = true;

  textField.appendChild(textLabel);
  textField.appendChild(textarea);

  const status = document.createElement("p");
  status.className = "docs-bug-report-form__status";
  status.setAttribute("aria-live", "polite");
  status.textContent = "Your text will be prefilled in the GitHub issue body.";

  const actions = document.createElement("div");
  actions.className = "docs-bug-report-form__actions";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "docs-bug-report-form__submit";
  submit.textContent = "Open GitHub issue";

  actions.appendChild(submit);

  form.appendChild(typeField);
  form.appendChild(textField);
  form.appendChild(status);
  form.appendChild(actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSubmit();
  });

  body.appendChild(intro);
  body.appendChild(form);

  panel.appendChild(head);
  panel.appendChild(body);

  modal.appendChild(backdrop);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  modalEl = modal;
  textareaEl = textarea;
  selectEl = select;
  statusEl = status;
  submitEl = submit;
  return modal;
}

async function handleSubmit() {
  const message = textareaEl.value.trim();
  if (message.length < 10) {
    statusEl.className =
      "docs-bug-report-form__status docs-bug-report-form__status--error";
    statusEl.textContent =
      "Please enter at least 10 characters so we understand the issue.";
    textareaEl.focus();
    return;
  }

  statusEl.className = "docs-bug-report-form__status";
  statusEl.textContent = "Preparing GitHub issue…";
  submitEl.disabled = true;

  const url = buildIssueUrl(message, selectEl.value);

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(message);
    }
  } catch (_) {
    /* clipboard is optional; the form text is also passed through the URL */
  }

  statusEl.className =
    "docs-bug-report-form__status docs-bug-report-form__status--success";
  statusEl.textContent = "Opening GitHub in a new tab…";

  window.open(url, "_blank", "noopener,noreferrer");

  window.setTimeout(() => {
    if (!statusEl) return;
    statusEl.textContent = "Thanks! You can file another report any time.";
    submitEl.disabled = false;
    textareaEl.value = "";
    closeModal();
  }, 600);
}

function openModal(trigger) {
  ensureModal();
  lastFocused = trigger || document.activeElement;
  modalEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  // Reset status and focus into the textarea for fast typing.
  statusEl.className = "docs-bug-report-form__status";
  statusEl.textContent = "Your text will be prefilled in the GitHub issue body.";
  requestAnimationFrame(() => { if (textareaEl) textareaEl.focus(); });

  keydownHandler = (event) => {
    if (event.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", keydownHandler);
}

function closeModal() {
  if (!modalEl || modalEl.getAttribute("aria-hidden") === "true") return;
  modalEl.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

function upgradeButton(btn) {
  if (btn.dataset.bugReportBound === "true") return;
  btn.dataset.bugReportBound = "true";
  const isEmpty = !btn.innerHTML.trim();
  // Empty triggers become the 36×36 icon button (topbar action). Triggers
  // that already have text/markup are treated as inline opt-in triggers —
  // we only wire the click handler and a11y, leaving their styling alone.
  if (isEmpty) {
    btn.classList.add("docs-bug-report-btn");
    btn.innerHTML = BUG_SVG;
    if (!btn.hasAttribute("aria-label")) {
      btn.setAttribute("aria-label", "Report a bug on this page");
    }
    if (!btn.hasAttribute("data-tooltip")) {
      btn.setAttribute(
        "data-tooltip",
        "Report a bug or unclear copy on this page — opens a prefilled GitHub issue."
      );
      btn.setAttribute("data-tooltip-placement", "bottom");
    }
  } else {
    btn.classList.add("docs-bug-report-trigger");
  }
  if (!btn.hasAttribute("type")) btn.setAttribute("type", "button");
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    openModal(btn);
  });
}

export function mountBugReport(root = document) {
  // 1) Upgrade any author-placed triggers (component pages, showcase demos).
  const declared = root.querySelectorAll(
    '[data-component="bug-report"], [data-bug-report-open]'
  );
  declared.forEach(upgradeButton);

  // 2) Auto-inject a button before the theme toggle in every topbar.
  const actionsBars = root.querySelectorAll(".topbar__actions");
  actionsBars.forEach((bar) => {
    if (bar.querySelector(".docs-bug-report-btn")) return;
    const btn = document.createElement("button");
    upgradeButton(btn);
    const themeToggle = bar.querySelector(".docs-theme-toggle, [data-component=\"theme-toggle\"]");
    if (themeToggle) {
      bar.insertBefore(btn, themeToggle);
    } else {
      bar.appendChild(btn);
    }
  });
}
