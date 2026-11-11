import type { CalEventData, CalRange } from './types.js';
import { instantFromZonedWallTime, zonedParts } from './tz.js';
import * as rruleModule from 'rrule';

const DAY_MS = 86_400_000;

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

/** A zone this runtime can resolve. An unknown one keeps the UTC expansion rather than throwing. */
function isKnownZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function hasDtstart(rule: string): boolean {
  return /^DTSTART(?:;|:)/im.test(rule);
}

function withDtstart(rule: string, start: Date): string {
  return hasDtstart(rule)
    ? rule
    : `DTSTART:${formatUtcRecurrenceDate(start)}\n${rule}`;
}

/** Express an instant's wall-clock components in `tz` as a floating UTC Date for rrule evaluation. */
function toFloatingDate(instant: Date, tz: string): Date {
  const p = zonedParts(instant, tz);
  return new Date(Date.UTC(p.y, p.mo - 1, p.d, p.hour, p.minute, p.second));
}

/** Convert a floating UTC Date returned by rrule back to the real instant in `tz`. */
function fromFloatingDate(floating: Date, tz: string): Date {
  return instantFromZonedWallTime(
    {
      y: floating.getUTCFullYear(),
      mo: floating.getUTCMonth() + 1,
      d: floating.getUTCDate(),
      hour: floating.getUTCHours(),
      minute: floating.getUTCMinutes(),
      second: floating.getUTCSeconds(),
    },
    tz,
  );
}

function rewriteUtcTokenToFloating(token: string, tz: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i.exec(token.trim());
  if (!m) return token;
  const instant = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return formatUtcRecurrenceDate(toFloatingDate(instant, tz));
}

/** Rewrite UTC instants (`...Z`) in UNTIL, EXDATE, and RDATE into floating wall-time tokens in `tz`
 *  so rrule compares them in the same floating space as DTSTART. Leaves non-Z or TZID values untouched. */
function rewriteRuleToFloating(rule: string, tz: string): string {
  const unfolded = rule.replace(/\r?\n[ \t]/g, '');
  return unfolded
    .split(/\r?\n/)
    .map((line) => {
      const exOrRdate = /^(EXDATE|RDATE)((?:;[^:]+)?)?:(.*)$/i.exec(line);
      if (exOrRdate) {
        const [, prop, params = '', values] = exOrRdate;
        if (/(?:^|;)TZID=/i.test(params)) return line;
        const rewritten = values
          .split(',')
          .map((v) => rewriteUtcTokenToFloating(v, tz))
          .join(',');
        return `${prop}${params}:${rewritten}`;
      }
      return line.replace(
        /(\bUNTIL=)(\d{8}T\d{6}Z)\b/gi,
        (_, prefix: string, token: string) => `${prefix}${rewriteUtcTokenToFloating(token, tz)}`,
      );
    })
    .join('\n');
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

  const tz = base.tz?.trim();
  if (tz && tz !== 'UTC' && isKnownZone(tz) && !hasDtstart(rule)) {
    const floatingStart = toFloatingDate(base.start, tz);
    const recurrence = rrulestr(
      `DTSTART:${formatUtcRecurrenceDate(floatingStart)}\n${rewriteRuleToFloating(rule, tz)}`,
      {
        forceset: true,
        unfold: true,
      },
    );
    // Pad the floating query window by 1 day on each side to cover timezone and DST offsets,
    // then filter converted instants against the real half-open window.
    const queryStart = new Date(toFloatingDate(win.start, tz).getTime() - duration - DAY_MS);
    const queryEnd = new Date(toFloatingDate(win.end, tz).getTime() + DAY_MS);
    return recurrence
      .between(queryStart, queryEnd, true)
      .map((occurrenceStart) => {
        const start = fromFloatingDate(occurrenceStart, tz);
        const end = new Date(start.getTime() + duration);
        return { ...base, id: `${base.id}@${start.toISOString()}`, start, end, recurringInstance: true };
      })
      .filter(({ start, end }) => overlaps(start, end, win));
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
