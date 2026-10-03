# AGENTS.md — @linked.cm/calendar

Staged in the **linked-cm** org (npm scope `@linked.cm`) pending René's review; moves to linked-fw (`@_linked/calendar`) only after approval.

Extracted from `serve-earth/serve-community` `packages/calendar` with its history (2026-10-03). Consumers: Serve (`serve-community`), `@serve.earth/schedule`.

## Do not change without a migration

- `linkedPackage('@_linked/calendar', { baseUri: 'https://linked.cm/' })` in `src/package.ts` — it decides the package and component IRIs (`https://linked.cm/pkg/calendar`). The npm name is independent of it.

## Rules

- Shape-agnostic: hosts supply render-ready items and handle change callbacks; this package never becomes an event store.
- ESM-only; every export resolves to `lib/esm` (the linked-fw exports standard).
- `rrule` stays pinned exactly (reviewed dependency; see THIRD_PARTY_NOTICES.md).
- Releases go through changesets (`npx changeset`).
