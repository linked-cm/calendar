// Timezone helpers (Intl-based, no deps) — render the calendar in a CHOSEN tz regardless of the
// browser's, so an LA event shows at 9am for everyone. Generic; → @_linked/calendar.

export interface ZonedParts {
  y: number;
  mo: number; // 1-12
  d: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0=Sun
}

export interface ZonedWallTime {
  y: number;
  mo: number; // 1-12
  d: number;
  hour: number; // 0-23
  minute: number;
  second?: number;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of an instant in the given tz (or the browser's if omitted). */
export function zonedParts(date: Date, tz?: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short' });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  return { y: +p.year, mo: +p.month, d: +p.day, hour: p.hour === '24' ? 0 : +p.hour, minute: +p.minute, second: +p.second, weekday: WD[p.weekday] ?? 0 };
}

export const dayKey = (y: number, mo: number, d: number) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Calendar day (Y-M-D) of an instant, in the given tz. Use to bucket events into day cells. */
export function dayKeyTz(date: Date, tz?: string): string {
  const z = zonedParts(date, tz);
  return dayKey(z.y, z.mo, z.d);
}

/** Minutes since local midnight (in tz) — for vertical positioning in a time grid. */
export function minutesIntoDay(date: Date, tz?: string): number {
  const z = zonedParts(date, tz);
  return z.hour * 60 + z.minute;
}

/** "9:00 AM" in the given tz. */
export function formatTime(date: Date, tz?: string): string {
  return date.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
}

/** "9:00 AM PDT" — time + short zone name, for the cross-timezone heads-up. */
export function formatTimeZone(date: Date, tz?: string): string {
  return date.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

/** The viewer's current IANA tz (browser default). */
export function viewerTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** True when the event's location tz resolves to a different wall-clock than the viewer's tz for `date`. */
export function isCrossTz(date: Date, eventTz: string | undefined, viewer: string | undefined): boolean {
  if (!eventTz || !viewer || eventTz === viewer) return false;
  return formatTime(date, eventTz) !== formatTime(date, viewer) || dayKeyTz(date, eventTz) !== dayKeyTz(date, viewer);
}

/** "YYYY-MM-DDTHH:MM" wall-clock in tz — value for an <input type="datetime-local">. */
export function inputValue(date: Date, tz?: string): string {
  const z = zonedParts(date, tz);
  return `${dayKey(z.y, z.mo, z.d)}T${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
}

/** Parse an <input type="datetime-local"> value ("YYYY-MM-DDTHH:MM") as wall-clock in tz → instant. */
export function instantFromInput(value: string, tz?: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return instantFromZoned(+m[1], +m[2], +m[3], +m[4] * 60 + +m[5], tz);
}

/** Build an absolute instant from a tz day + minutes-into-day. Used when a drag/select produces a new
 *  wall-clock time in the display tz and we need the UTC instant to persist. Finds the offset by probing. */
export function instantFromZoned(y: number, mo: number, d: number, minutes: number, tz?: string): Date {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  // start from a UTC guess, then correct by the tz offset at that moment (two passes handles DST edges)
  let guess = new Date(Date.UTC(y, mo - 1, d, hour, minute));
  for (let i = 0; i < 2; i++) {
    const z = zonedParts(guess, tz);
    const wantUTCminutes = hour * 60 + minute;
    const gotUTCminutes = z.hour * 60 + z.minute;
    const driftDays = (z.y - y) * 366 + (z.mo - mo) * 31 + (z.d - d); // rough sign of day drift
    const deltaMin = (gotUTCminutes - wantUTCminutes) + driftDays * 24 * 60;
    if (deltaMin === 0) break;
    guess = new Date(guess.getTime() - deltaMin * 60000);
  }
  return guess;
}

function wallMs(ms: number, tz?: string): number {
  const z = zonedParts(new Date(ms), tz);
  return Date.UTC(z.y, z.mo - 1, z.d, z.hour, z.minute, z.second);
}

/** Convert wall-clock parts (including seconds) in `tz` to a real UTC instant via Intl offset probing.
 *  Spring-forward DST gaps resolve to the first instant whose wall time is not before the target;
 *  ambiguous fall-back times resolve to the earlier instant. */
export function instantFromZonedWallTime(parts: ZonedWallTime, tz?: string): Date {
  const target = Date.UTC(parts.y, parts.mo - 1, parts.d, parts.hour, parts.minute, parts.second ?? 0);
  if (tz === 'UTC') return new Date(target);

  let guess = target;
  let firstNotBefore = Infinity;

  for (let i = 0; i < 8; i++) {
    const wall = wallMs(guess, tz);
    const delta = wall - target;
    if (delta === 0) {
      // Check two hours back to detect whether a fall-back transition produced an earlier matching instant.
      const prev = guess - 2 * 3600_000;
      const earlier = target - (wallMs(prev, tz) - prev);
      if (earlier < guess && wallMs(earlier, tz) === target) {
        return new Date(earlier);
      }
      return new Date(guess);
    }
    if (wall >= target && guess < firstNotBefore) {
      firstNotBefore = guess;
    }
    guess -= delta;
  }

  if (wallMs(guess, tz) >= target && guess < firstNotBefore) {
    firstNotBefore = guess;
  }
  return new Date(Number.isFinite(firstNotBefore) ? firstNotBefore : guess);
}
