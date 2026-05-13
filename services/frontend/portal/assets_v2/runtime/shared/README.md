# runtime/shared/

Reserved for runtime data that both portals consume but doesn't belong in the UI-kit:

- search indexes (`search-index-public.json`, `search-index-internal.json`)
- portal-data.js (sidebar trees, metadata)
- any other shared prod-code that survives the migration unchanged

Populated during Phase 7 (page migration). Empty for now.
