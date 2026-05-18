/* ui-kit/components/syntax-highlight.js — bootstrap legacy docs-syntax.js
   from the v3 runtime.

   The lightweight token highlighter lives at assets/docs-syntax.js and is an
   IIFE auto-binding on DOMContentLoaded. v3 entry.js used to pull it in by
   accident via legacy docs-nav.js; once we dropped that script the v3 stack
   lost syntax colours. This module injects the file once as a <script defer>
   so the same highlighter runs without re-implementing it inside the v3 tree.

   Theme (st-* class colours) ships from assets/docs-syntax-theme.css, which
   entry.css imports directly. */

const ATTR = "data-docs-syntax-bootstrap";

export function mountSyntaxHighlight() {
  if (document.querySelector(`script[${ATTR}]`)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.setAttribute(ATTR, "1");
  // Resolve relative to this module so the URL works at any portal mount root.
  script.src = new URL("../../../assets/docs-syntax.js", import.meta.url).toString();
  document.head.appendChild(script);
}
