# Portal UI-kit v2 — Constructor Rules

Single source of truth for both portals (public + internal).
See `docs/rfc/ui-kit-v2-inventory.md` for the component matrix.

## Layering (load order matters — last wins)

```
ui-kit/tokens/_base.css           ← shared primitives (radius, spacing, ease)
ui-kit/tokens/_typography.css     ← font ladder, OpenType features
ui-kit/tokens/_theme-light.css    ← shared light palette
ui-kit/tokens/_theme-dark.css     ← shared dark palette (data-theme="dark")
ui-kit/tokens/_portal-<id>.css    ← per-portal accent overrides (public OR internal)
ui-kit/components/*.css           ← component definitions (one file per component)
runtime/<portal>/overrides.css    ← portal-specific tweaks via [data-portal="<id>"]
```

A page loads exactly one `runtime/<portal>/entry.css` which `@import`s the chain above.

## Change-in-one-place rules

| What you want to change | Edit only |
|---|---|
| Accent color across both portals | `tokens/_theme-light.css` + `tokens/_theme-dark.css` |
| Accent color for one portal only | `tokens/_portal-<id>.css` |
| Component visual everywhere | `components/<name>.css` |
| Component visual in one portal | `runtime/<portal>/overrides.css` with `[data-portal="<id>"]` selector |
| Sidebar contents (links) | `ui-kit/mocks/nav-tree-<portal>.json` |
| Component behavior | `components/<name>.js` |

NEVER duplicate a component file across portals — override via tokens or `[data-portal]`.

## Portal data attribute

Every page's `<html>` tag carries `data-portal="public"` or `data-portal="internal"`.
Overrides scope to that attribute.

## Showcase

Live preview of every token, component, and template:
`services/portal/ui-kit/` (third "portal" that's accessible from both).
