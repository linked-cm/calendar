import { describe, expect, it } from 'vitest';

import { dayKeyTz, inputValue, instantFromInput, isCrossTz } from '../src/index.js';

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
});
