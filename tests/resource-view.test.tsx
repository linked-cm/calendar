import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Calendar, type CalEventData, type CalResource } from '../src/index.js';

const cursor = new Date('2026-08-03T12:00:00.000Z');
const resources: CalResource[] = [
  { id: 'resource:welcome', name: 'Welcome team' },
  { id: 'resource:checkin', name: 'Check-in team' },
];
const events: CalEventData[] = [
  {
    id: 'event:briefing',
    title: 'Welcome briefing',
    start: new Date('2026-08-03T09:00:00.000Z'),
    end: new Date('2026-08-03T09:30:00.000Z'),
    resourceIds: ['resource:welcome'],
  },
  {
    id: 'event:coverage',
    title: 'Shared coverage',
    start: new Date('2026-08-03T10:00:00.000Z'),
    end: new Date('2026-08-03T11:00:00.000Z'),
    resourceIds: ['resource:welcome', 'resource:checkin'],
  },
  {
    id: 'event:unassigned',
    title: 'Needs an owner',
    start: new Date('2026-08-03T12:00:00.000Z'),
    end: new Date('2026-08-03T13:00:00.000Z'),
  },
  {
    id: 'event:tomorrow',
    title: 'Tomorrow only',
    start: new Date('2026-08-04T12:00:00.000Z'),
    end: new Date('2026-08-04T13:00:00.000Z'),
    resourceIds: ['resource:welcome'],
  },
];

function render(view: 'month' | 'resource', resourceInput?: readonly CalResource[]): string {
  return renderToStaticMarkup(
    <Calendar
      events={events}
      resources={resourceInput}
      view={view}
      cursor={cursor}
      timeZone="UTC"
      onView={() => undefined}
      onCursor={() => undefined}
    />,
  );
}

describe('resource calendar view', () => {
  it('projects one event across its resource columns without copying event data', () => {
    const html = render('resource', resources);

    expect(html).toContain('Welcome team');
    expect(html).toContain('Check-in team');
    expect(html).toContain('Unassigned');
    expect(html.match(/>Shared coverage</g)).toHaveLength(2);
    expect(html.match(/>Welcome briefing</g)).toHaveLength(1);
    expect(html.match(/>Needs an owner</g)).toHaveLength(1);
    expect(html).not.toContain('Tomorrow only');
    expect(html).toContain('aria-label="Schedule by resource"');
  });

  it('offers the resource tab only when the host supplies the resource contract', () => {
    expect(render('month')).not.toContain('>Resources<');
    expect(render('month', resources)).toContain('>Resources<');
  });

  it('has an explicit empty state when no resource projection exists', () => {
    const html = renderToStaticMarkup(
      <Calendar
        events={[]}
        resources={[]}
        view="resource"
        cursor={cursor}
        timeZone="UTC"
        onView={() => undefined}
        onCursor={() => undefined}
      />,
    );

    expect(html).toContain('No resources or unassigned events for this day.');
  });
});
