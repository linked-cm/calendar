import React from 'react';
import { Button } from '@_linked/primitives/components/Button';
import { Heading } from '@_linked/primitives/components/Heading';
import type { CalEventData, CalResource } from './types.js';
import type { CalLabels } from './Calendar.js';
import { formatTime, instantFromZoned, isCrossTz } from './tz.js';
import style from './Calendar.module.css';

type ResourceColumn = CalResource | { id: '__unassigned__'; name: string };

function dayRange(cursor: Date, tz?: string): { start: Date; end: Date } {
  const start = instantFromZoned(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate(), 0, tz);
  const next = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  const end = instantFromZoned(next.getFullYear(), next.getMonth() + 1, next.getDate(), 0, tz);
  return { start, end };
}

export const ResourceGrid: React.FC<{
  cursor: Date;
  events: readonly CalEventData[];
  resources: readonly CalResource[];
  labels: CalLabels;
  tz?: string;
  onSelect?: (event: CalEventData, x: number, y: number) => void;
}> = ({ cursor, events, resources, labels, tz, onSelect }) => {
  const range = dayRange(cursor, tz);
  const visible = events
    .filter((event) => event.start < range.end && event.end > range.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  const unassigned = visible.filter((event) => !event.resourceIds?.length);
  const columns: ResourceColumn[] = [
    ...resources,
    ...(unassigned.length ? [{ id: '__unassigned__' as const, name: labels.unassigned }] : []),
  ];

  if (!columns.length) return <div className={style.empty}>{labels.resourceEmpty}</div>;

  return (
    <div className={style.resourceGrid} role="region" aria-label={labels.resourceView}>
      {columns.map((resource) => {
        const items = resource.id === '__unassigned__'
          ? unassigned
          : visible.filter((event) => event.resourceIds?.includes(resource.id));
        const color = 'color' in resource ? resource.color : undefined;
        return (
          <section
            key={resource.id}
            className={style.resourceColumn}
            style={{ ['--resource-color' as string]: color ?? 'var(--control-accent)' }}
          >
            <Heading as="h3" className={style.resourceHeading}>{resource.name}</Heading>
            <div className={style.resourceEvents}>
              {items.length ? items.map((event) => {
                const eventLocal = isCrossTz(event.start, event.tz, tz);
                return (
                  <Button
                    key={`${resource.id}:${event.id}`}
                    type="button"
                    variant="ghost"
                    className={style.resourceEvent}
                    style={{ ['--c' as string]: event.color ?? 'var(--control-accent)', ['--a' as string]: event.accent ?? event.color ?? 'var(--resource-color)' }}
                    onClick={(pointer) => onSelect?.(event, pointer.clientX, pointer.clientY)}
                    title={eventLocal ? `${event.title} — ${labels.eventLocalTime(formatTime(event.start, event.tz))}` : event.title}
                  >
                    <span className={style.resourceEventAccent} />
                    <span className={style.resourceEventBody}>
                      <span className={style.resourceEventTime}>{event.allDay ? labels.allDay : `${formatTime(event.start, tz)} – ${formatTime(event.end, tz)}`}</span>
                      <span className={style.resourceEventTitle}>{event.title}</span>
                      {event.location && <span className={style.resourceEventLocation}>{event.location}</span>}
                    </span>
                    {event.alert && <span className={style.alertDot} data-tone={event.alert.tone} title={event.alert.label} role="img" aria-label={event.alert.label} />}
                  </Button>
                );
              }) : <div className={style.resourceColumnEmpty}>{labels.resourceColumnEmpty}</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
};
