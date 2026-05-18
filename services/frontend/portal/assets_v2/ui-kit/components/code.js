/* ui-kit/components/code.js — add copy buttons to every <pre><code>… block.
   Syntax highlighting is left to prod /assets/docs-syntax.js when present. */

function injectCopyButton(pre) {
  if (pre.querySelector(".docs-code__copy")) return;
  if (!pre.classList.contains("docs-code")) pre.classList.add("docs-code");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "docs-code__copy";
  btn.setAttribute("aria-label", "Copy code");
  btn.setAttribute("data-tooltip", "Copy this snippet to the clipboard.");
  btn.setAttribute("data-tooltip-placement", "left");
  btn.textContent = "Copy";
  btn.addEventListener("click", async () => {
    const code = pre.querySelector("code");
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent);
      btn.textContent = "Copied";
      btn.setAttribute("data-copied", "true");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.removeAttribute("data-copied");
      }, 1600);
    } catch (_) {
      btn.textContent = "Failed";
      setTimeout(() => (btn.textContent = "Copy"), 1600);
    }
  });
  pre.appendChild(btn);
}

export function mountCode(root = document) {
  const blocks = root.querySelectorAll("pre > code");
  blocks.forEach((code) => injectCopyButton(code.parentElement));
}
