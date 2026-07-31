// @_linked/calendar — shape-agnostic contracts. This package knows nothing of Serve Shapes, Causes, or
// sponsors. A host adapter maps its domain into CalEventData and passes change events back to Shape verbs.

export type CalView = 'month' | 'week' | 'day' | 'agenda' | 'resource';

/** A flat, render-ready calendar item. The host app maps its domain (Serve: Event/Mission) into these. */
export interface CalEventData {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  /** the event LOCATION's own IANA timezone (where it physically happens). The calendar displays in the
   *  VIEWER's tz; when this differs, the UI surfaces both times. Absent ⇒ no cross-tz heads-up. */
  tz?: string;
  /** opaque category key (Serve passes the cause code) — for grouping/legends */
  colorKey?: string;
  /** display color, already resolved by the host — the FILL of the event. Serve passes the SEMANTIC color
   *  (cause-print for missions, type for events) so the color says WHAT the event is. */
  color?: string;
  /** a secondary accent color for the event's edge/marker — a different grouping than the fill. Serve
   *  passes the calendar LANE color here, so the fill = topic and the thin edge/dot = which calendar. */
  accent?: string;
  location?: string;
  /** join URL for virtual/hybrid items — powers the popover's "Join" quick action */
  virtualUrl?: string;
  /** host-specific tag, e.g. 'mission' | 'event' — the engine treats it as opaque */
  kind?: string;
  /** Opaque resource projection keys used by the optional resource view. The host maps canonical people,
   * rooms, equipment, roles, or other schedulable resources to these ids; the engine never owns them. */
  resourceIds?: readonly string[];
  /** true for a generated recurrence instance (vs the stored base) */
  recurringInstance?: boolean;
  /** host-computed attention marker — the engine renders a small dot on the card with `label` as its
   *  tooltip (Serve sets this for organizers when a shift has coverage gaps or dropouts). Engine-agnostic. */
  alert?: { tone: 'warn' | 'danger'; label: string };
  /** arbitrary host payload (Serve attaches the source id / status) carried through untouched */
  meta?: Record<string, unknown>;
}

/** Inclusive-start / exclusive-end window the calendar is showing. */
export interface CalRange {
  start: Date;
  end: Date;
}

/** Selection includes the semantic trigger so overlays can restore keyboard focus after closing. */
export type CalEventSelect = (
  event: CalEventData,
  x: number,
  y: number,
  trigger?: HTMLElement,
) => void;

// ── Multi-calendar + external-connection model (generic; part of @_linked/calendar core). The engine
//    owns these CONTRACTS; the host app (Serve) maps its own domain — RSVPs, roles, ExternalCalendar
//    shapes — into them. Lanes are toggleable; connections are links to outside calendars. See
//    docs/plans/005-external-calendar-integration.md. ──

/** A toggleable lane in a viewer's calendar (My commitments / Saved / Hosting / a team / an external link). */
export interface CalLane {
  id: string;
  name: string;
  color: string;
  /** how its events are sourced — commitments | saved | hosting | team | external | custom */
  kind: string;
  /** the on/off toggle */
  visible: boolean;
  /** opaque host key for team lanes (Serve: the Team id) */
  sourceId?: string;
}

/** A render-ready schedulable resource column. This is a controlled projection, not a generic RDF Shape. */
export interface CalResource {
  id: string;
  name: string;
  color?: string;
  /** Opaque host category such as person, room, equipment, or role. */
  kind?: string;
  /** Arbitrary host payload carried through untouched. */
  meta?: Record<string, unknown>;
}

/** A pending calendar invite the viewer can accept / reject. */
export interface CalInvite {
  /** opaque id the host uses to accept/reject (Serve: the RSVP id) */
  inviteId: string;
  subjectId: string;
  title: string;
  when: Date | null;
  kind?: string;
  color: string;
}

/** A direction an external calendar can sync. */
export type CalSyncDirection = 'import' | 'export' | 'both';

/** A linked external calendar connection (Google / Outlook / Apple / Calendly / ICS), as the engine sees it.
 *  The host stores the real connection (+ secret tokens, server-side) and maps it to this. */
export interface CalConnection {
  id: string;
  provider: string;
  label: string;
  direction: CalSyncDirection | string;
  lastSyncedAt?: string;
  status?: string; // connected | syncing | error | reauth_needed
}

/** A provider the user can link, with the sync directions it actually supports (per provider capability). */
export interface CalProviderOption {
  provider: string;
  label: string;
  directions: string[];
}
/** The default provider matrix (capabilities from the integration discovery). Hosts may override. */
export const CAL_PROVIDERS: CalProviderOption[] = [
  { provider: 'google', label: 'Google Calendar', directions: ['both', 'import', 'export'] },
  { provider: 'outlook', label: 'Outlook / Microsoft', directions: ['both', 'import', 'export'] },
  { provider: 'apple', label: 'Apple / iCloud', directions: ['both', 'import', 'export'] },
  { provider: 'calendly', label: 'Calendly', directions: ['import'] }, // scheduling tool → bookings flow IN only
  { provider: 'ics', label: 'ICS / subscription link', directions: ['import'] },
];
