import { describe, expect, it } from 'vitest';

import { expandEvents, expandRule, type CalEventData } from '../src/index.js';

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
});
