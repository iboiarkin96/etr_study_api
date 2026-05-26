/* ui-kit/components/terminal-card.js
   Self-typing terminal card. Mount via:

     <div data-component="terminal-card"
          data-try-href="/reference/api/index.html"
          data-try-label="Try in OpenAPI Explorer"></div>

   Optional attributes:
     data-delay      — ms to wait after intersection before typing (default 320)
     data-script     — id of <script type="application/json"> with the segments
                       (otherwise the built-in API-call script is used)
     data-try-href   — href for the trailing CTA link (default reference/api/)
     data-try-label  — label for the trailing CTA link (default "Try in OpenAPI Explorer")
     data-no-copy    — present to suppress the Copy button

   Each segment is {cls?: string, text: string}.
   Re-typing on hover/click: not implemented (one-shot typewriter). */

const DEFAULT_SCRIPT = [
  { cls: "docs-terminal__t-mute", text: "$ " },
  { cls: "docs-terminal__t-cmd",  text: "curl" },
  { text: " " },
  { cls: "docs-terminal__t-url",  text: "https://api.etr.study/v1/conspectuses/due" },
  { text: " \\\n     " },
  { cls: "docs-terminal__t-flag", text: "-H" },
  { text: " " },
  { cls: "docs-terminal__t-str",  text: "\"Authorization: Bearer " },
  { cls: "docs-terminal__t-var",  text: "$ETR_TOKEN" },
  { cls: "docs-terminal__t-str",  text: "\"" },
  { text: "\n" },
  { cls: "docs-terminal__t-mute", text: "→ " },
  { cls: "docs-terminal__t-ok",   text: "200 OK" },
  { cls: "docs-terminal__t-mute", text: " · " },
  { cls: "docs-terminal__t-num",  text: "14" },
  { cls: "docs-terminal__t-mute", text: " items · " },
  { cls: "docs-terminal__t-lat",  text: "300ms" },
  { text: "\n" },
  { cls: "docs-terminal__t-mute", text: "  " },
  { cls: "docs-terminal__t-ok",   text: "schedule_summary" },
  { cls: "docs-terminal__t-mute", text: " · next review in " },
  { cls: "docs-terminal__t-num",  text: "12m" },
];

function buildShell(host) {
  const tryHref = host.getAttribute("data-try-href") || "/services/portal/internal/api/index.html";
  const tryLabel = host.getAttribute("data-try-label") || "Try in OpenAPI Explorer";
  const showCopy = !host.hasAttribute("data-no-copy");
  const copyBtn = showCopy
    ? `<button type="button" class="docs-terminal__copy" data-terminal-copy aria-label="Copy command">
         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
           <rect x="9" y="9" width="11" height="11" rx="2"/>
           <path d="M5 15V5a2 2 0 0 1 2-2h10"/>
         </svg>
         <span data-terminal-copy-label>Copy</span>
       </button>`
    : "";
  host.innerHTML = `
    <header class="docs-terminal__chrome">
      <span class="docs-terminal__dot docs-terminal__dot--r" aria-hidden="true"></span>
      <span class="docs-terminal__dot docs-terminal__dot--y" aria-hidden="true"></span>
      <span class="docs-terminal__dot docs-terminal__dot--g" aria-hidden="true"></span>
      <span class="docs-terminal__title">curl · bash</span>
      <span class="docs-terminal__badge">live</span>
    </header>
    <pre class="docs-terminal__body"><code data-terminal-target></code></pre>
    <footer class="docs-terminal__foot">
      ${copyBtn}
      <a class="docs-terminal__try" href="${tryHref}">
        ${tryLabel}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </a>
    </footer>`;
}

function renderStatic(target, segments) {
  target.textContent = "";
  segments.forEach((seg) => {
    const span = document.createElement("span");
    if (seg.cls) span.className = seg.cls;
    span.textContent = seg.text;
    target.appendChild(span);
  });
}

function typewrite(target, segments, baseDelay) {
  target.textContent = "";
  const caret = document.createElement("span");
  caret.className = "docs-terminal__caret";
  caret.setAttribute("aria-hidden", "true");
  target.appendChild(caret);

  let segIdx = 0;
  let charIdx = 0;
  let activeSpan = null;

  function nextSegment() {
    if (segIdx >= segments.length) return;
    const seg = segments[segIdx];
    activeSpan = document.createElement("span");
    if (seg.cls) activeSpan.className = seg.cls;
    target.insertBefore(activeSpan, caret);
    charIdx = 0;
    typeChar();
  }

  // Typewriter cadence — setTimeout is intentional here (lifecycle pacing,
  // not DOM polling). Each char waits 18–56 ms before the next is appended.
  function typeChar() {
    const seg = segments[segIdx];
    if (!seg) return;
    const ch = seg.text[charIdx];
    if (ch === undefined) {
      segIdx++;
      if (segIdx < segments.length) {
        const wasNewline = seg.text.endsWith("\n");
        window.setTimeout(nextSegment, wasNewline ? 110 : 24);
      }
      return;
    }
    activeSpan.appendChild(document.createTextNode(ch));
    charIdx++;
    const isWS = /\s/.test(ch);
    const base = isWS ? 18 : 26;
    const jitter = Math.random() * 30;
    window.setTimeout(typeChar, base + jitter);
  }

  window.setTimeout(nextSegment, baseDelay);
}

function plainText(segments) {
  return segments.map((s) => s.text).join("");
}

function wireCopy(host, segments) {
  const btn = host.querySelector("[data-terminal-copy]");
  if (!btn) return;
  const label = btn.querySelector("[data-terminal-copy-label]");
  const originalLabel = label ? label.textContent : "Copy";
  btn.addEventListener("click", async () => {
    const text = plainText(segments);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      if (label) label.textContent = "Copied";
      btn.classList.add("is-copied");
      window.setTimeout(() => {
        if (label) label.textContent = originalLabel;
        btn.classList.remove("is-copied");
      }, 1400);
    } catch (_) {
      if (label) label.textContent = "Copy failed";
      window.setTimeout(() => {
        if (label) label.textContent = originalLabel;
      }, 1400);
    }
  });
}

function loadScript(host) {
  const id = host.getAttribute("data-script");
  if (!id) return DEFAULT_SCRIPT;
  const node = document.getElementById(id);
  if (!node) return DEFAULT_SCRIPT;
  try {
    const parsed = JSON.parse(node.textContent);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SCRIPT;
  } catch {
    return DEFAULT_SCRIPT;
  }
}

export function mountTerminalCard() {
  const hosts = document.querySelectorAll('[data-component="terminal-card"]');
  if (!hosts.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  hosts.forEach((host) => {
    host.classList.add("docs-terminal");
    buildShell(host);
    const target = host.querySelector("[data-terminal-target]");
    const script = loadScript(host);
    const delay = parseInt(host.getAttribute("data-delay"), 10) || 320;
    wireCopy(host, script);

    if (reduced) {
      renderStatic(target, script);
      host.removeAttribute("data-component");
      return;
    }

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      typewrite(target, script, delay);
    };

    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            obs.disconnect();
            start();
          }
        });
      }, { threshold: 0.4 });
      obs.observe(host);
    } else {
      start();
    }

    host.removeAttribute("data-component");
  });
}
