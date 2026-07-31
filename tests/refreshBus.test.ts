import { describe, expect, it, vi } from 'vitest';

import { createRefreshBus } from '../src/index.js';

describe('calendar refresh contract', () => {
  it('notifies active consumers once per committed change and supports unsubscribe', () => {
    const bus = createRefreshBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);

    expect(bus.version()).toBe(0);
    bus.ping();
    expect(bus.version()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.ping();
    expect(bus.version()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
