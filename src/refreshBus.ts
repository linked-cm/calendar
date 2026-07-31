import React from 'react';

// Refresh bus — the missing LINKED reactivity layer (WP25 §4). LINKED's linkedComponent/linkedSetComponent
// are fetch-on-mount snapshots; a graph mutation needs a committed-change adapter. Domain packages bridge
// their authoritative graph feed into this compatibility bus; callers must not ping optimistically from
// write callbacks. A query keyed to `useRefreshVersion(bus)` then re-fetches. Reusable beyond the calendar.
export interface RefreshBus {
  ping(): void;
  subscribe(fn: () => void): () => void;
  version(): number;
}

export function createRefreshBus(): RefreshBus {
  let v = 0;
  const subs = new Set<() => void>();
  return {
    ping() {
      v++;
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    version() {
      return v;
    },
  };
}

/** Subscribe a component to a bus; returns the current version (changes on every ping → re-render/refetch). */
export function useRefreshVersion(bus: RefreshBus): number {
  return React.useSyncExternalStore(
    (cb) => bus.subscribe(cb),
    () => bus.version(),
    () => bus.version(),
  );
}

/** App-wide compatibility bus — a domain's committed-change adapter pings this. */
export const calendarBus: RefreshBus = createRefreshBus();
