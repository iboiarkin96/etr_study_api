/* ui-kit/components/endpoint-card.js
   Expand / collapse for .docs-endpoint-card elements.
   No data-component mount — attaches directly to .docs-endpoint-card
   found in the document at boot time. */

export function mountEndpointCards() {
  document.querySelectorAll(".docs-endpoint-card").forEach(card => {
    const header = card.querySelector(".docs-endpoint-card__header");
    if (!header) return;

    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");

    const isOpen = card.getAttribute("data-open") === "true";
    header.setAttribute("aria-expanded", isOpen ? "true" : "false");

    const body = card.querySelector(".docs-endpoint-card__body");
    if (body) {
      body.setAttribute("role", "region");
    }

    function toggle() {
      const open = card.getAttribute("data-open") === "true";
      card.setAttribute("data-open", open ? "false" : "true");
      header.setAttribute("aria-expanded", open ? "false" : "true");
    }

    header.addEventListener("click", toggle);
    header.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });
}
