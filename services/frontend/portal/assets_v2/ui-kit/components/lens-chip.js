/* ui-kit/components/lens-chip.js — wires every `.lens-chip[data-lens]`
   to the shared tooltip runtime so the lens vocabulary is self-explanatory
   on hover/focus. Replaces the old `reading-guide` legend that had to be
   pasted under the hero on every handbook page. */

const LENS_TOOLTIPS = {
  stance:
    "Stance — our normative position. One or two lines in present tense: what we do.",
  rules:
    "Rules — Reference lens. Canonical definitions, allowed values, lookup tables. No narrative.",
  rationale:
    "Rationale — Explanation lens, bounded. Deep philosophy lives in /explanation/ and we link out.",
  apply:
    "Apply — How-to lens. What an author or reviewer actually does on a real PR.",
  sources:
    "Sources — provenance: canonical home, owner, last-reviewed date, deep links, related ADRs.",
};

export function mountLensChip(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  const chips = scope.querySelectorAll(".lens-chip[data-lens]");
  chips.forEach((chip) => {
    if (chip.hasAttribute("data-tooltip")) return;
    const lens = chip.getAttribute("data-lens");
    const text = LENS_TOOLTIPS[lens];
    if (!text) return;
    chip.setAttribute("data-tooltip", text);
  });
}
