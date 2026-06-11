/* ui-kit/components/syntax-highlight.js — bootstrap the legacy docs-syntax.js
   IIFE from the v3 runtime.

   The lightweight token highlighter lives at
   assets_v2/ui-kit/components/syntax/docs-syntax.js and is an IIFE
   auto-binding on DOMContentLoaded. v3 entry.js used to pull it in by
   accident via legacy docs-nav.js; once we dropped that script the v3 stack
   lost syntax colours. This module injects the file once as a <script defer>
   so the same highlighter runs without re-implementing it inside the v3 tree.

   Theme (st-* class colours) ships from
   assets_v2/ui-kit/components/syntax/docs-syntax-theme.css, which
   entry.css imports directly. */

const ATTR = "data-docs-syntax-bootstrap";

export function mountSyntaxHighlight() {
  if (document.querySelector(`script[${ATTR}]`)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.setAttribute(ATTR, "1");
  // Resolve relative to this module so the URL works at any portal mount root.
  // syntax-highlight.js sits in assets_v2/ui-kit/components/ ;
  // docs-syntax.js sits in assets_v2/ui-kit/components/syntax/ — one level down.
  script.src = new URL("./syntax/docs-syntax.js", import.meta.url).toString();
  document.head.appendChild(script);
}
