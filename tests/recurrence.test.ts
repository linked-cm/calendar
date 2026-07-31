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
});
