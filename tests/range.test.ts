import { describe, expect, it } from 'vitest';
import { rangeForCalendarView } from '../src/index.js';

describe('calendar view ranges', () => {
  const cursor = new Date(2026, 7, 12, 14, 30);

  it('bounds day and resource views to the selected local day', () => {
    for (const view of ['day', 'resource'] as const) {
      const range = rangeForCalendarView(view, cursor);
      expect(range.start).toEqual(new Date(2026, 7, 12));
      expect(range.end).toEqual(new Date(2026, 7, 13));
    }
  });

  it('bounds a Sunday-first week', () => {
    const range = rangeForCalendarView('week', cursor);
    expect(range.start).toEqual(new Date(2026, 7, 9));
    expect(range.end).toEqual(new Date(2026, 7, 16));
  });

  it('distinguishes the six-week month grid from the exact agenda month', () => {
    expect(rangeForCalendarView('month', cursor)).toEqual({
      start: new Date(2026, 6, 26),
      end: new Date(2026, 8, 6),
    });
    expect(rangeForCalendarView('agenda', cursor)).toEqual({
      start: new Date(2026, 7, 1),
      end: new Date(2026, 8, 1),
    });
  });
});
