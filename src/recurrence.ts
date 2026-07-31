import type { CalEventData, CalRange } from './types.js';
import * as rruleModule from 'rrule';

// rrule publishes ESM metadata over a CommonJS main. Vite exposes named exports
// in its browser prebundle but only `default` in Node SSR, so normalize the
// namespace without requiring either export form statically.
const rruleApi = rruleModule as typeof rruleModule & {
  default?: typeof rruleModule;
};
const rrulestr = rruleApi.rrulestr ?? rruleApi.default?.rrulestr;

if (!rrulestr) {
  throw new Error('rrule package does not expose rrulestr');
}

function overlaps(start: Date, end: Date, win: CalRange): boolean {
  return start < win.end && end > win.start;
}

function formatUtcRecurrenceDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function withDtstart(rule: string, start: Date): string {
  return /^DTSTART(?:;|:)/im.test(rule)
    ? rule
    : `DTSTART:${formatUtcRecurrenceDate(start)}\n${rule}`;
}

/**
 * Expand one graph-projected base event into instances overlapping `win`.
 *
 * `rule` accepts an RRULE value (`FREQ=...`), a prefixed `RRULE:` line, or an iCalendar recurrence
 * fragment containing DTSTART/RRULE/RDATE/EXDATE lines. Expansion remains a bounded view operation; the
 * returned instances are projections and never become an authoritative event store.
 */
export function expandRule(base: CalEventData, rule: string | undefined, win: CalRange): CalEventData[] {
  if (!rule) return overlaps(base.start, base.end, win) ? [base] : [];

  const duration = base.end.getTime() - base.start.getTime();
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(`Calendar event ${base.id} has an invalid interval`);
  }
  if (!(win.start < win.end)) {
    throw new RangeError('Calendar recurrence window must end after it starts');
  }

  const recurrence = rrulestr(withDtstart(rule, base.start), {
    forceset: true,
    unfold: true,
  });
  // An occurrence may start before the visible window and still overlap it. Query from one event duration
  // before the window, then enforce the calendar's half-open overlap contract below.
  const queryStart = new Date(win.start.getTime() - duration);
  return recurrence
    .between(queryStart, win.end, true)
    .map((occurrenceStart) => {
      const start = new Date(occurrenceStart);
      const end = new Date(start.getTime() + duration);
      return { ...base, id: `${base.id}@${start.toISOString()}`, start, end, recurringInstance: true };
    })
    .filter(({ start, end }) => overlaps(start, end, win));
}

/** Expand a list of (base, rule) pairs into all instances within the window, sorted by start. */
export function expandEvents(items: { event: CalEventData; rule?: string }[], win: CalRange): CalEventData[] {
  const all = items.flatMap(({ event, rule }) => expandRule(event, rule, win));
  return all.sort((a, b) => a.start.getTime() - b.start.getTime());
}
