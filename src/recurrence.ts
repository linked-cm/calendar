import type { CalEventData, CalRange } from './types.js';

// Minimal RRULE (RFC 5545) expander — DEPENDENCY-FREE on purpose, supporting the common subset:
// FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY (weekly), COUNT, UNTIL. Expands a base event into the
// instances that fall within a window, client-side, so the canonical pattern stays on the shape.
//
// EVENTUAL SWAP: rrule.js (BSD-3) per WP25 / plan 003 — replace `expandRule` with rrule and keep the
// `expandEvents` window contract. Until then this covers the seeded patterns (e.g. FREQ=WEEKLY;BYDAY=WE).

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']; // index = JS getDay()
const DAY = 24 * 60 * 60 * 1000;

function parseRule(rule: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of rule.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) out[k.trim().toUpperCase()] = v.trim();
  }
  return out;
}

function overlaps(start: Date, end: Date, win: CalRange): boolean {
  return start < win.end && end > win.start;
}

/** Expand one base event by its RRULE into instances overlapping `win`. No rule ⇒ the base itself. */
export function expandRule(base: CalEventData, rule: string | undefined, win: CalRange): CalEventData[] {
  if (!rule) return overlaps(base.start, base.end, win) ? [base] : [];

  const r = parseRule(rule);
  const freq = (r.FREQ ?? 'WEEKLY').toUpperCase();
  const interval = Math.max(1, parseInt(r.INTERVAL ?? '1', 10) || 1);
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  const until = r.UNTIL ? new Date(r.UNTIL) : null;
  const byDays = (r.BYDAY ? r.BYDAY.split(',') : []).map((d) => DAY_CODES.indexOf(d.trim().toUpperCase())).filter((i) => i >= 0);

  const duration = base.end.getTime() - base.start.getTime();
  const out: CalEventData[] = [];
  let emitted = 0;
  // walk from the base start; cap iterations so a malformed rule can't loop forever
  const MAX_ITERS = 2000;
  let cursor = new Date(base.start);

  const emit = (d: Date) => {
    const start = new Date(d);
    const end = new Date(d.getTime() + duration);
    if (overlaps(start, end, win)) {
      out.push({ ...base, id: `${base.id}@${start.toISOString()}`, start, end, recurringInstance: true });
    }
  };

  for (let i = 0; i < MAX_ITERS && emitted < count; i++) {
    if (until && cursor > until) break;
    if (cursor.getTime() > win.end.getTime() + DAY) break; // past the window — stop

    if (freq === 'WEEKLY' && byDays.length) {
      // for a weekly rule with BYDAY, emit each matching weekday in this week-step
      const weekStart = new Date(cursor);
      weekStart.setHours(base.start.getHours(), base.start.getMinutes(), 0, 0);
      for (const wd of byDays) {
        const delta = (wd - weekStart.getDay() + 7) % 7;
        const day = new Date(weekStart.getTime() + delta * DAY);
        if (day >= base.start && (!until || day <= until) && emitted < count) {
          emit(day);
          emitted++;
        }
      }
      cursor = new Date(cursor.getTime() + interval * 7 * DAY);
    } else {
      emit(cursor);
      emitted++;
      if (freq === 'DAILY') cursor = new Date(cursor.getTime() + interval * DAY);
      else if (freq === 'MONTHLY') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + interval, cursor.getDate(), cursor.getHours(), cursor.getMinutes());
      else cursor = new Date(cursor.getTime() + interval * 7 * DAY); // weekly, no BYDAY
    }
  }
  return out;
}

/** Expand a list of (base, rule) pairs into all instances within the window, sorted by start. */
export function expandEvents(items: { event: CalEventData; rule?: string }[], win: CalRange): CalEventData[] {
  const all = items.flatMap(({ event, rule }) => expandRule(event, rule, win));
  return all.sort((a, b) => a.start.getTime() - b.start.getTime());
}
