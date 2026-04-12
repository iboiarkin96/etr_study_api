---
name: ADR discussion
about: Discuss an architecture decision before merging its ADR
title: "[ADR] "
labels: []
---

## Marking this task

- **Title:** keep the **`[ADR]`** prefix (it is how we spot ADR threads in the list). Add a short subject after it.
- **Labels:** optional — we do not require a special label; the template + title are enough.

## Summary

Short description of the decision (link to a draft branch or paste the working title).

## Background

Why this is needed now; links to related issues or prior context.

## Proposal

Bullet points or a link to the proposed ADR text (or draft PR).

## Discussion checklist

- [ ] Alternatives and trade-offs are clear
- [ ] Open questions resolved or explicitly deferred

## Consensus

When ready, open a PR that:

- Adds or updates the ADR under `docs/adr/`
- Updates `docs/adr/README.html` if the ADR is new
- Adds an entry under `[Unreleased]` in `docs/CHANGELOG.md` when readers should know
- Fills **Ratification** (link to **this** Issue, merge PR, acceptance date) and sets `data-adr-weight` on `<main>`

### Example: Ratification block on the merged ADR page

After merge, the HTML under `docs/adr/` should include a **Ratification** section similar to:

- **Discussion Issue:** URL of this Issue (the thread you are reading now).
- **Merge PR:** URL of the PR that merged the ADR.
- **Accepted:** `YYYY-MM-DD` (merge or explicit acceptance date).

ADRs adopted before ADR 0018 use a shorter ratification note; see `docs/adr/0018-adr-lifecycle-ratification-and-badges.html` and older numbered ADRs.

Close this Issue after the ADR PR is merged (or when the proposal is withdrawn).
