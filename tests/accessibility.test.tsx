import React from 'react';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Calendar, type CalLabels } from '../src/index.js';
import { EventPopover } from '../src/EventPopover.js';

const labels: CalLabels = {
  today: 'Today',
  previous: 'Previous',
  next: 'Next',
  viewName: (view) => view,
  viewSwitcher: 'Calendar view',
  loading: 'Loading calendar',
  allDay: 'All day',
  more: (count) => `${count} more`,
  empty: 'No events',
  resourceView: 'Schedule by resource',
  resourceEmpty: 'No resources',
  resourceColumnEmpty: 'No events assigned',
  unassigned: 'Unassigned',
  start: 'Start',
  end: 'End',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  eventLocalTime: (time) => `Event local time ${time}`,
  directions: 'Directions',
  join: 'Join',
  share: 'Share',
  checkIn: 'Check in',
  expand: 'Open details',
  close: 'Close',
  continued: 'Continued',
  confirm: 'Confirm',
  interactionHint: 'Open or move event',
};

const event = {
  id: 'event:river',
  title: 'River restoration',
  start: new Date('2026-08-03T10:00:00.000Z'),
  end: new Date('2026-08-03T12:00:00.000Z'),
  location: 'Riverside park',
};

describe('@_linked/calendar accessibility contract', () => {
  it('renders one labelled region with roving tabs and a linked tabpanel', () => {
    const html = renderToStaticMarkup(
      <Calendar
        events={[event]}
        view="month"
        cursor={new Date('2026-08-03T00:00:00.000Z')}
        timeZone="UTC"
        locale="en-US"
        labels={labels}
        onView={() => undefined}
        onCursor={() => undefined}
      />,
    );

    expect(html).toMatch(/role="region" aria-labelledby="[^"]+-heading"/);
    expect(html).toContain('role="tablist" aria-label="Calendar view"');
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html).toMatch(/role="tab" aria-selected="true" aria-controls="[^"]+-panel" tabindex="0"/);
    expect(html.match(/role="tab" aria-selected="false" aria-controls="[^"]+-panel" tabindex="-1"/g)).toHaveLength(3);
    expect(html).toMatch(/role="tabpanel" aria-labelledby="[^"]+-month-tab"/);
    expect(html).toContain('aria-label="Monday, August 3, 2026"');
  });

  it('marks loading and empty views as polite status updates', () => {
    const loading = renderToStaticMarkup(
      <Calendar events={[]} view="week" cursor={new Date('2026-08-03T00:00:00.000Z')} labels={labels} loading onView={() => undefined} onCursor={() => undefined} />,
    );
    const empty = renderToStaticMarkup(
      <Calendar events={[]} view="agenda" cursor={new Date('2026-08-03T00:00:00.000Z')} labels={labels} onView={() => undefined} onCursor={() => undefined} />,
    );

    expect(loading).toContain('role="status" aria-live="polite"');
    expect(empty).toMatch(/role="status"[^>]*>No events/);
  });

  it('renders the quick card as a labelled modal with an explicit close control', () => {
    const html = renderToStaticMarkup(
      <EventPopover
        event={event}
        x={100}
        y={100}
        tz="UTC"
        labels={labels}
        onClose={() => undefined}
        onExpand={() => undefined}
        onReschedule={() => undefined}
      />,
    );

    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="[^"]+" tabindex="-1"/);
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('tabindex="-1" aria-hidden="true"');
    expect(html).toContain('River restoration');
  });

  it('keeps keyboard activation, focus trapping, Escape close, and focus restoration wired', async () => {
    const [calendar, popover, timeGrid] = await Promise.all([
      readFile(new URL('../src/Calendar.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/EventPopover.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/TimeGrid.tsx', import.meta.url), 'utf8'),
    ]);

    expect(calendar).toContain("event.key === 'ArrowRight'");
    expect(calendar).toContain('requestAnimationFrame(() => trigger.focus())');
    expect(popover).toContain("event.key === 'Escape'");
    expect(popover).toContain("event.key !== 'Tab'");
    expect(popover).toContain('closeRef.current?.focus()');
    expect(timeGrid).toContain('if (ev.detail !== 0) return');
  });
});
