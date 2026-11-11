import { describe, expect, it } from 'vitest';

import { dayKeyTz, inputValue, instantFromInput, instantFromZonedWallTime, isCrossTz } from '../src/index.js';

describe('calendar timezone boundary', () => {
  it('buckets one instant into the correct viewer-local day', () => {
    const instant = new Date('2026-08-01T00:30:00.000Z');
    expect(dayKeyTz(instant, 'Europe/Lisbon')).toBe('2026-08-01');
    expect(dayKeyTz(instant, 'America/Los_Angeles')).toBe('2026-07-31');
  });

  it('round-trips an ordinary local datetime through a named timezone', () => {
    const original = new Date('2026-08-03T08:30:00.000Z');
    const value = inputValue(original, 'Europe/Lisbon');
    expect(instantFromInput(value, 'Europe/Lisbon')?.toISOString()).toBe(original.toISOString());
  });

  it('identifies a cross-timezone presentation', () => {
    expect(isCrossTz(new Date('2026-08-03T09:00:00.000Z'), 'Europe/Lisbon', 'America/Los_Angeles')).toBe(true);
  });

  it('resolves ordinary, gap, and ambiguous wall times with seconds', () => {
    expect(
      instantFromZonedWallTime({ y: 2026, mo: 8, d: 3, hour: 9, minute: 30, second: 15 }, 'Europe/Lisbon').toISOString(),
    ).toBe('2026-08-03T08:30:15.000Z');
    expect(
      instantFromZonedWallTime({ y: 2026, mo: 3, d: 29, hour: 1, minute: 30, second: 0 }, 'Europe/London').toISOString(),
    ).toBe('2026-03-29T01:30:00.000Z');
    expect(
      instantFromZonedWallTime({ y: 2026, mo: 10, d: 25, hour: 1, minute: 30, second: 0 }, 'Europe/London').toISOString(),
    ).toBe('2026-10-25T00:30:00.000Z');
  });
});
