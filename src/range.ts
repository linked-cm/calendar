import type { CalRange, CalView } from './types.js';

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** The bounded recurrence/query window rendered by a calendar view. */
export function rangeForCalendarView(view: CalView, cursor: Date): CalRange {
  if (view === 'day' || view === 'resource') {
    const start = startOfDay(cursor);
    return { start, end: addDays(start, 1) };
  }
  if (view === 'week') {
    const day = startOfDay(cursor);
    const start = addDays(day, -day.getDay());
    return { start, end: addDays(start, 7) };
  }
  if (view === 'agenda') {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return { start, end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) };
  }

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return { start, end: addDays(start, 42) };
}
