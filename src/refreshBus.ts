import React from 'react';

// Refresh bus — the missing LINKED reactivity layer (WP25 §4). LINKED's linkedComponent/linkedSetComponent
// are fetch-on-mount snapshots; a graph mutation (UI drag/drop OR GIA verb) emits no notification. Every
// write path pings the bus; a calendar query keyed to `useRefreshVersion(bus)` re-fetches. Reusable beyond
// the calendar. Generic — destined for @_linked/calendar.
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

/** App-wide default bus — Serve write verbs ping this; the calendar query keys to it. */
export const calendarBus: RefreshBus = createRefreshBus();
