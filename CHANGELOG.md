# @linked.cm/calendar

## 0.1.2

### Patch Changes

- [#20](https://github.com/linked-cm/calendar/pull/20) [`e0b7d8c`](https://github.com/linked-cm/calendar/commit/e0b7d8c3c2ee7a77e6b69d793c75bfa4c241bd32) Thanks [@carlenmy](https://github.com/carlenmy)! - Recurring events repeat in their own time zone.

  - **Behaviour change:** `expandRule`/`expandEvents` now expand a series in `CalEventData.tz` when it is set to a known IANA zone and the rule has no DTSTART of its own. A weekly 9:00 America/Los_Angeles series stays at 9:00 across daylight-saving changes (it was 8:00 after November), and `BYDAY` uses the local weekday (a Friday-evening series no longer lands on Thursdays). `UNTIL`, `EXDATE` and `RDATE` values ending in `Z` are honoured as instants. Items without `tz`, with `'UTC'`, with an unknown zone, or whose rule carries DTSTART expand exactly as before.
  - **New export:** `instantFromZonedWallTime(parts, tz)` converts a wall time in a zone to its instant:

    ```ts
    import { instantFromZonedWallTime } from '@linked.cm/calendar';
    instantFromZonedWallTime({ y: 2026, mo: 11, d: 14, hour: 9, minute: 0 }, 'America/Los_Angeles');
    // → 2026-11-14T17:00:00.000Z
    ```

    A nonexistent spring-forward time uses the pre-transition offset (RFC 5545); an ambiguous fall-back time resolves to the earlier instant.
  - `zonedParts` now also returns `second`.

## 0.1.1

### Patch Changes

- [`9d97001`](https://github.com/linked-cm/calendar/commit/9d97001462a4a40fe1545fdf23ff7a6f7405c95d) Thanks [@carlenmy](https://github.com/carlenmy)! - Relicensed from ISC (Linked Community) to MIT, copyright Semantu, matching the LINKED framework packages.
