/* ui-kit/components/diagram-lightbox.js — PlantUML zoomable viewer.

   Canonical API:
     import { openLightbox, closeLightbox } from "./diagram-lightbox.js";
     openLightbox(srcUrl);
     closeLightbox();

   Showcase / non-module HTML may also use the documented facade
   `window.docsDiagramLightbox = { open, close }` (deliberate exception to the
   no-globals rule; kept narrow and read-only). Click any
   [data-component="diagram"] img/svg to open. Zoom buttons + drag-pan. */

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;

let lightbox = null;
let content = null;
let zoom = 1;
let panX = 0;
let panY = 0;
let dragging = false;
let dragStart = { x: 0, y: 0 };

function ensureLightbox() {
  if (lightbox) return lightbox;
  lightbox = document.createElement("div");
  lightbox.className = "docs-diagram-lightbox";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.innerHTML =
    "<div class='docs-diagram-lightbox__head'>" +
    "  <div class='docs-diagram-lightbox__title'>Diagram</div>" +
    "  <div class='docs-diagram-lightbox__controls'>" +
    "    <button type='button' class='docs-diagram-lightbox__zoom-out' aria-label='Zoom out' data-tooltip='Zoom out' data-tooltip-placement='bottom'>−</button>" +
    "    <button type='button' class='docs-diagram-lightbox__reset' aria-label='Reset zoom' data-tooltip='Reset zoom to 1:1' data-tooltip-placement='bottom'>1:1</button>" +
    "    <button type='button' class='docs-diagram-lightbox__zoom-in' aria-label='Zoom in' data-tooltip='Zoom in' data-tooltip-placement='bottom'>+</button>" +
    "    <button type='button' class='docs-diagram-lightbox__close' aria-label='Close' data-tooltip='Close lightbox (Esc)' data-tooltip-placement='bottom'>×</button>" +
    "  </div>" +
    "</div>" +
    "<div class='docs-diagram-lightbox__stage'>" +
    "  <div class='docs-diagram-lightbox__content'></div>" +
    "</div>";
  document.body.appendChild(lightbox);
  content = lightbox.querySelector(".docs-diagram-lightbox__content");
  const stage = lightbox.querySelector(".docs-diagram-lightbox__stage");

  lightbox.querySelector(".docs-diagram-lightbox__zoom-in").addEventListener("click", () => apply(zoom + ZOOM_STEP, panX, panY));
  lightbox.querySelector(".docs-diagram-lightbox__zoom-out").addEventListener("click", () => apply(zoom - ZOOM_STEP, panX, panY));
  lightbox.querySelector(".docs-diagram-lightbox__reset").addEventListener("click", () => apply(1, 0, 0));
  lightbox.querySelector(".docs-diagram-lightbox__close").addEventListener("click", close);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (lightbox.getAttribute("aria-hidden") === "true") return;
    if (e.key === "Escape") close();
    if (e.key === "+" || e.key === "=") apply(zoom + ZOOM_STEP, panX, panY);
    if (e.key === "-") apply(zoom - ZOOM_STEP, panX, panY);
    if (e.key === "0") apply(1, 0, 0);
  });
  stage.addEventListener("mousedown", (e) => {
    dragging = true;
    dragStart = { x: e.clientX - panX, y: e.clientY - panY };
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    apply(zoom, e.clientX - dragStart.x, e.clientY - dragStart.y);
  });
  window.addEventListener("mouseup", () => (dragging = false));
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    apply(zoom + delta, panX, panY);
  }, { passive: false });
  return lightbox;
}

function apply(nextZoom, x, y) {
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
  panX = x;
  panY = y;
  if (content) content.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function open(src) {
  ensureLightbox();
  if (!content) return;
  content.innerHTML = "";
  if (src.endsWith(".svg")) {
    const obj = document.createElement("object");
    obj.type = "image/svg+xml";
    obj.data = src;
    content.appendChild(obj);
  } else {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Diagram";
    content.appendChild(img);
  }
  apply(1, 0, 0);
  lightbox.setAttribute("aria-hidden", "false");
}

function close() {
  if (!lightbox) return;
  lightbox.setAttribute("aria-hidden", "true");
}

export function openLightbox(src) {
  open(src);
}

export function closeLightbox() {
  close();
}

export function mountDiagramLightbox(root = document) {
  const diagrams = root.querySelectorAll('[data-component="diagram"] img, [data-component="diagram"] svg, .docs-diagram img');
  diagrams.forEach((node) => {
    node.style.cursor = "zoom-in";
    node.addEventListener("click", () => {
      const src = node.tagName === "IMG" ? node.src : node.dataset.src;
      if (src) open(src);
    });
  });
  // Showcase / non-module HTML facade. Documented public API.
  window.docsDiagramLightbox = { open, close };
}
