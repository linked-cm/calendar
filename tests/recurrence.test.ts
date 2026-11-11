import { describe, expect, it } from 'vitest';

import {
  dayKeyTz,
  expandEvents,
  expandRule,
  formatTime,
  instantFromZonedWallTime,
  type CalEventData,
} from '../src/index.js';

const base: CalEventData = {
  id: 'event:weekly-cleanup',
  title: 'Weekly cleanup',
  start: new Date('2026-08-03T09:00:00.000Z'),
  end: new Date('2026-08-03T11:00:00.000Z'),
};

describe('visible-window recurrence expansion', () => {
  it('preserves a non-recurring event when it overlaps the window', () => {
    const result = expandRule(base, undefined, {
      start: new Date('2026-08-03T00:00:00.000Z'),
      end: new Date('2026-08-04T00:00:00.000Z'),
    });

    expect(result).toEqual([base]);
  });

  it('expands and sorts recurring events without materializing canonical instances', () => {
    const result = expandEvents(
      [{ event: base, rule: 'FREQ=WEEKLY;COUNT=3;BYDAY=MO' }],
      {
        start: new Date('2026-08-01T00:00:00.000Z'),
        end: new Date('2026-08-31T00:00:00.000Z'),
      },
    );

    expect(result.map((event) => event.start.toISOString())).toEqual([
      '2026-08-03T09:00:00.000Z',
      '2026-08-10T09:00:00.000Z',
      '2026-08-17T09:00:00.000Z',
    ]);
    expect(result.every((event) => event.recurringInstance)).toBe(true);
    expect(result.every((event) => event.id.startsWith(`${base.id}@`))).toBe(true);
  });

  it('supports RFC 5545 monthly selectors beyond the former hand-written subset', () => {
    const result = expandRule(base, 'FREQ=MONTHLY;COUNT=3;BYDAY=-1FR', {
      start: new Date('2026-08-01T00:00:00.000Z'),
      end: new Date('2026-11-01T00:00:00.000Z'),
    });

    expect(result.map((event) => event.start.toISOString())).toEqual([
      '2026-08-28T09:00:00.000Z',
      '2026-09-25T09:00:00.000Z',
      '2026-10-30T09:00:00.000Z',
    ]);
  });

  it('honors exclusion dates in an iCalendar recurrence fragment', () => {
    const result = expandRule(
      base,
      [
        'DTSTART:20260803T090000Z',
        'RRULE:FREQ=WEEKLY;COUNT=3;BYDAY=MO',
        'EXDATE:20260810T090000Z',
      ].join('\n'),
      {
        start: new Date('2026-08-01T00:00:00.000Z'),
        end: new Date('2026-08-31T00:00:00.000Z'),
      },
    );

    expect(result.map((event) => event.start.toISOString())).toEqual([
      '2026-08-03T09:00:00.000Z',
      '2026-08-17T09:00:00.000Z',
    ]);
  });

  it('includes a long occurrence that begins before the visible window', () => {
    const longBase = {
      ...base,
      end: new Date('2026-08-03T12:00:00.000Z'),
    };
    const result = expandRule(longBase, 'FREQ=DAILY;COUNT=1', {
      start: new Date('2026-08-03T11:00:00.000Z'),
      end: new Date('2026-08-03T11:30:00.000Z'),
    });

    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe('2026-08-03T09:00:00.000Z');
  });

  it('rejects malformed rules and invalid expansion windows instead of guessing', () => {
    expect(() =>
      expandRule(base, 'FREQ=NOT_A_FREQUENCY', {
        start: new Date('2026-08-01T00:00:00.000Z'),
        end: new Date('2026-08-31T00:00:00.000Z'),
      }),
    ).toThrow();
    expect(() =>
      expandRule(base, 'FREQ=DAILY', {
        start: new Date('2026-08-31T00:00:00.000Z'),
        end: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).toThrow(/window/i);
  });

  it('keeps wall-clock time across DST fall-back in the series timezone', () => {
    const laEvent: CalEventData = {
      id: 'event:la-weekly',
      title: 'LA Saturday morning',
      start: new Date('2026-10-24T16:00:00.000Z'), // Sat 09:00 PDT
      end: new Date('2026-10-24T17:00:00.000Z'),
      tz: 'America/Los_Angeles',
    };

    const result = expandRule(laEvent, 'FREQ=WEEKLY;BYDAY=SA', {
      start: new Date('2026-10-20T00:00:00.000Z'),
      end: new Date('2026-11-20T00:00:00.000Z'),
    });

    expect(result.map((e) => e.start.toISOString())).toEqual([
      '2026-10-24T16:00:00.000Z',
      '2026-10-31T16:00:00.000Z',
      '2026-11-07T17:00:00.000Z',
      '2026-11-14T17:00:00.000Z',
    ]);
    expect(result.every((e) => formatTime(e.start, 'America/Los_Angeles') === '9:00 AM')).toBe(true);
    expect(result.map((e) => e.id)).toEqual([
      'event:la-weekly@2026-10-24T16:00:00.000Z',
      'event:la-weekly@2026-10-31T16:00:00.000Z',
      'event:la-weekly@2026-11-07T17:00:00.000Z',
      'event:la-weekly@2026-11-14T17:00:00.000Z',
    ]);
  });

  it('evaluates BYDAY on the series timezone weekday rather than the UTC weekday', () => {
    const friEveningLa: CalEventData = {
      id: 'event:la-friday',
      title: 'Friday evening in LA',
      start: new Date('2026-11-07T02:00:00.000Z'), // Fri Nov 6 18:00 PST
      end: new Date('2026-11-07T03:00:00.000Z'),
      tz: 'America/Los_Angeles',
    };

    const result = expandRule(friEveningLa, 'FREQ=WEEKLY;BYDAY=FR', {
      start: new Date('2026-11-01T00:00:00.000Z'),
      end: new Date('2026-11-25T00:00:00.000Z'),
    });

    expect(result.map((e) => e.start.toISOString())).toEqual([
      '2026-11-07T02:00:00.000Z',
      '2026-11-14T02:00:00.000Z',
      '2026-11-21T02:00:00.000Z',
    ]);
    expect(result.map((e) => dayKeyTz(e.start, 'America/Los_Angeles'))).toEqual([
      '2026-11-06',
      '2026-11-13',
      '2026-11-20',
    ]);
  });

  it('resolves spring-forward DST gap occurrences forward to the post-transition wall time', () => {
    const nyGapSeries: CalEventData = {
      id: 'event:ny-gap',
      title: 'NY 02:30 daily',
      start: new Date('2026-03-07T07:30:00.000Z'), // Sat Mar 7 02:30 EST
      end: new Date('2026-03-07T08:00:00.000Z'),
      tz: 'America/New_York',
    };

    const result = expandRule(nyGapSeries, 'FREQ=DAILY;COUNT=3', {
      start: new Date('2026-03-07T00:00:00.000Z'),
      end: new Date('2026-03-10T00:00:00.000Z'),
    });

    // 2026-03-08 02:30 does not exist in America/New_York; resolves forward to 03:30 EDT (07:30Z).
    expect(result.map((e) => e.start.toISOString())).toEqual([
      '2026-03-07T07:30:00.000Z',
      '2026-03-08T07:30:00.000Z',
      '2026-03-09T06:30:00.000Z',
    ]);
    expect(formatTime(result[1].start, 'America/New_York')).toBe('3:30 AM');
  });

  it('honours UNTIL, EXDATE, and RDATE ending in Z in the series timezone', () => {
    const laEvent: CalEventData = {
      id: 'event:la-until',
      title: 'LA Saturday with UNTIL',
      start: new Date('2026-10-24T16:00:00.000Z'), // Sat 09:00 PDT
      end: new Date('2026-10-24T17:00:00.000Z'),
      tz: 'America/Los_Angeles',
    };

    const withUntil = expandRule(laEvent, 'FREQ=WEEKLY;BYDAY=SA;UNTIL=20261107T170000Z', {
      start: new Date('2026-10-20T00:00:00.000Z'),
      end: new Date('2026-11-20T00:00:00.000Z'),
    });
    expect(withUntil.map((e) => e.start.toISOString())).toEqual([
      '2026-10-24T16:00:00.000Z',
      '2026-10-31T16:00:00.000Z',
      '2026-11-07T17:00:00.000Z',
    ]);

    const withExdateAndRdate = expandRule(
      laEvent,
      [
        'RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20261107T170000Z',
        'EXDATE:20261031T160000Z',
        'RDATE:20261108T170000Z',
      ].join('\n'),
      {
        start: new Date('2026-10-20T00:00:00.000Z'),
        end: new Date('2026-11-20T00:00:00.000Z'),
      },
    );
    expect(withExdateAndRdate.map((e) => e.start.toISOString())).toEqual([
      '2026-10-24T16:00:00.000Z',
      '2026-11-07T17:00:00.000Z',
      '2026-11-08T17:00:00.000Z',
    ]);
  });

  it('preserves UTC expansion when base.tz is absent, UTC, or the rule has its own DTSTART', () => {
    const utcBase: CalEventData = {
      id: 'event:utc-weekly',
      title: 'UTC Saturday',
      start: new Date('2026-10-24T16:00:00.000Z'),
      end: new Date('2026-10-24T17:00:00.000Z'),
    };
    const win = {
      start: new Date('2026-10-20T00:00:00.000Z'),
      end: new Date('2026-11-20T00:00:00.000Z'),
    };

    expect(expandRule(utcBase, 'FREQ=WEEKLY;BYDAY=SA', win).map((e) => e.start.toISOString())).toEqual([
      '2026-10-24T16:00:00.000Z',
      '2026-10-31T16:00:00.000Z',
      '2026-11-07T16:00:00.000Z',
      '2026-11-14T16:00:00.000Z',
    ]);

    expect(
      expandRule({ ...utcBase, tz: 'UTC' }, 'FREQ=WEEKLY;BYDAY=SA', win).map((e) => e.start.toISOString()),
    ).toEqual([
      '2026-10-24T16:00:00.000Z',
      '2026-10-31T16:00:00.000Z',
      '2026-11-07T16:00:00.000Z',
      '2026-11-14T16:00:00.000Z',
    ]);

    expect(
      expandRule(
        { ...utcBase, tz: 'America/Los_Angeles' },
        'DTSTART:20261024T160000Z\nRRULE:FREQ=WEEKLY;BYDAY=SA',
        win,
      ).map((e) => e.start.toISOString()),
    ).toEqual([
      '2026-10-24T16:00:00.000Z',
      '2026-10-31T16:00:00.000Z',
      '2026-11-07T16:00:00.000Z',
      '2026-11-14T16:00:00.000Z',
    ]);
  });

  it('converts ordinary, DST-gap, and ambiguous fall-back wall times via instantFromZonedWallTime', () => {
    // Ordinary time with non-zero seconds (PDT, UTC-7)
    expect(
      instantFromZonedWallTime(
        { y: 2026, mo: 10, d: 24, hour: 9, minute: 15, second: 45 },
        'America/Los_Angeles',
      ).toISOString(),
    ).toBe('2026-10-24T16:15:45.000Z');

    // Spring-forward gap: 2026-03-08 02:30 in America/New_York resolves forward to 03:30 EDT (07:30Z)
    expect(
      instantFromZonedWallTime(
        { y: 2026, mo: 3, d: 8, hour: 2, minute: 30, second: 12 },
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-03-08T07:30:12.000Z');

    // Ambiguous fall-back time: 2026-11-01 01:30 in America/New_York chooses the earlier EDT instant (05:30Z, not 06:30Z)
    expect(
      instantFromZonedWallTime(
        { y: 2026, mo: 11, d: 1, hour: 1, minute: 30, second: 0 },
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');

    // Ambiguous fall-back time in a positive-offset zone: 2026-10-25 02:30 in Europe/Berlin chooses CEST (00:30Z, not 01:30Z)
    expect(
      instantFromZonedWallTime(
        { y: 2026, mo: 10, d: 25, hour: 2, minute: 30, second: 0 },
        'Europe/Berlin',
      ).toISOString(),
    ).toBe('2026-10-25T00:30:00.000Z');
  });
});

describe('an unknown series zone', () => {
  it('keeps the UTC expansion instead of throwing', () => {
    const base = { id: 'x', title: 'x', start: new Date('2026-10-24T16:00:00Z'), end: new Date('2026-10-24T17:00:00Z'), tz: 'Mars/Olympus' };
    const win = { start: new Date('2026-10-20T00:00:00Z'), end: new Date('2026-11-10T00:00:00Z') };
    expect(expandRule(base, 'FREQ=WEEKLY;BYDAY=SA', win).map((e) => e.start.toISOString())).toEqual([
      '2026-10-24T16:00:00.000Z', '2026-10-31T16:00:00.000Z', '2026-11-07T16:00:00.000Z',
    ]);
  });
});
