import React from 'react';
import type { CalEventData, CalResource, CalView } from './types.js';
import { TimeGrid } from './TimeGrid.js';
import { ResourceGrid } from './ResourceGrid.js';
import { EventPopover } from './EventPopover.js';
import { dayKey, dayKeyTz, formatTime, formatTimeZone, isCrossTz } from './tz.js';
import { registerPackageExport } from './package.js';
import { defaultCalendarText } from './translations.js';
import { Button } from '@_linked/primitives/components/Button';
import { Heading } from '@_linked/primitives/components/Heading';
import { IconButton } from '@_linked/primitives/components/IconButton';
import style from './Calendar.module.css';

// Calendar — the headless, themeable engine (generic; → @_linked/calendar). Controlled: events in,
// interactions out. Month / Week / Day / Agenda / Resource. Displays in the VIEWER's `timeZone`; events carry their
// own location tz, so a cross-tz event shows both times. Token-themed; colours resolved by the host.

const DAY = 24 * 60 * 60 * 1000;
// Localized short weekday names (Sun-first) derived from a BCP-47 locale. Jan 1 2023 was a Sunday.
const weekdayShort = (locale: string): string[] =>
  Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }));

// i18n by INJECTION — the engine stays framework-agnostic (no Tolgee import). The host passes a `locale`
// (drives Intl date/weekday names) and `labels` (the static chrome). Defaults keep it English standalone.
export interface CalLabels {
  today: string;
  previous: string;
  next: string;
  viewName: (v: CalView) => string; // Month | Week | Day | Agenda | Resources
  viewSwitcher: string; // aria-label for the view tablist
  loading: string;
  allDay: string;
  more: (n: number) => string; // "+N more"
  empty: string;
  resourceView: string;
  resourceEmpty: string;
  resourceColumnEmpty: string;
  unassigned: string;
  start: string;
  end: string;
  save: string;
  cancel: string;
  edit: string;
  eventLocalTime: (time: string) => string;
  directions: string;
  join: string;
  share: string;
  checkIn: string;
  expand: string;
  close: string;
  continued: string;
  confirm: string;
  interactionHint: string;
}
const DEFAULT_LABELS: CalLabels = {
  today: defaultCalendarText.today,
  previous: defaultCalendarText.previous,
  next: defaultCalendarText.next,
  viewName: (v) => defaultCalendarText[v],
  viewSwitcher: defaultCalendarText.viewSwitcher,
  loading: defaultCalendarText.loading,
  allDay: defaultCalendarText.allDay,
  more: (n) => defaultCalendarText.more.replace('{count}', String(n)),
  empty: defaultCalendarText.empty,
  resourceView: defaultCalendarText.resourceView,
  resourceEmpty: defaultCalendarText.resourceEmpty,
  resourceColumnEmpty: defaultCalendarText.resourceColumnEmpty,
  unassigned: defaultCalendarText.unassigned,
  start: defaultCalendarText.start,
  end: defaultCalendarText.end,
  save: defaultCalendarText.save,
  cancel: defaultCalendarText.cancel,
  edit: defaultCalendarText.edit,
  eventLocalTime: (time) => defaultCalendarText.eventLocalTime.replace('{time}', time),
  directions: defaultCalendarText.directions,
  join: defaultCalendarText.join,
  share: defaultCalendarText.share,
  checkIn: defaultCalendarText.checkIn,
  expand: defaultCalendarText.expand,
  close: defaultCalendarText.close,
  continued: defaultCalendarText.continued,
  confirm: defaultCalendarText.confirm,
  interactionHint: defaultCalendarText.interactionHint,
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKeyLocal = (d: Date) => dayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const weekOf = (d: Date) => Array.from({ length: 7 }, (_, i) => addDays(d, i - d.getDay()));
const monthMatrix = (cursor: Date) => {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
};

export interface CalendarProps {
  events: CalEventData[];
  /** Optional host-projected resources. Supplying this contract enables the Resource view tab. */
  resources?: readonly CalResource[];
  view: CalView;
  cursor: Date;
  timeZone?: string;
  onView: (v: CalView) => void;
  onCursor: (d: Date) => void;
  /** Expand → full detail (called from the quick popover's Expand). */
  onOpen?: (e: CalEventData) => void;
  /** optional Check-in quick action in the popover. */
  onCheckIn?: (e: CalEventData) => void;
  onMove?: (e: CalEventData, start: Date, end: Date) => void;
  onCreate?: (start: Date, end: Date) => void;
  /** host-supplied extra content for the quick popover (Serve: a compact coverage peek). `close` lets the
   *  extra dismiss the popover (e.g. after firing an action). */
  renderPopoverExtra?: (e: CalEventData, close: () => void) => React.ReactNode;
  loading?: boolean;
  /** BCP-47 locale for date/weekday formatting (default 'en-US'). */
  locale?: string;
  /** localized chrome strings (default English). */
  labels?: Partial<CalLabels>;
}

export const Calendar: React.FC<CalendarProps> = ({ events, resources, view, cursor, timeZone, onView, onCursor, onOpen, onCheckIn, onMove, onCreate, renderPopoverExtra, loading, locale = 'en-US', labels }) => {
  const today = new Date();
  const lab: CalLabels = { ...DEFAULT_LABELS, ...labels };
  const weekdays = React.useMemo(() => weekdayShort(locale), [locale]);
  // single click on an event → a quick-action popover anchored at the click; Expand opens the full detail
  const [pop, setPop] = React.useState<{ e: CalEventData; x: number; y: number } | null>(null);
  const onSelect = (e: CalEventData, x: number, y: number) => setPop({ e, x, y });
  const step = (dir: number) => {
    if (view === 'week') onCursor(addDays(cursor, dir * 7));
    else if (view === 'day' || view === 'resource') onCursor(addDays(cursor, dir));
    else onCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
  };
  const heading =
    view === 'day' || view === 'resource'
      ? cursor.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
      : view === 'week'
        ? (() => {
            const w = weekOf(cursor);
            return `${w[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${w[6].toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;
          })()
        : cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const availableViews: CalView[] = resources
    ? ['month', 'week', 'day', 'agenda', 'resource']
    : ['month', 'week', 'day', 'agenda'];

  return (
    <div className={style.cal}>
      <header className={style.head}>
        <div className={style.nav}>
          <IconButton type="button" variant="outline" size="small" className={style.navBtn} aria-label={lab.previous} onClick={() => step(-1)}>‹</IconButton>
          <Button type="button" variant="outline" size="small" className={style.today} onClick={() => onCursor(new Date())}>{lab.today}</Button>
          <IconButton type="button" variant="outline" size="small" className={style.navBtn} aria-label={lab.next} onClick={() => step(1)}>›</IconButton>
          <Heading as="h2" className={style.title}>{heading}</Heading>
        </div>
        <div className={style.views} role="tablist" aria-label={lab.viewSwitcher}>
          {availableViews.map((v) => (
            <Button key={v} type="button" variant="ghost" size="small" role="tab" aria-selected={view === v} className={style.viewBtn} data-active={view === v || undefined} onClick={() => onView(v)}>
              {lab.viewName(v)}
            </Button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className={style.empty}>{lab.loading}</div>
      ) : view === 'month' ? (
        <MonthGrid cursor={cursor} events={events} today={today} tz={timeZone} weekdays={weekdays} more={lab.more} onSelect={onSelect} onDayOpen={(d) => { onCursor(startOfDay(d)); onView('day'); }} />
      ) : view === 'agenda' ? (
        <Agenda cursor={cursor} events={events} today={today} tz={timeZone} weekdays={weekdays} allDayLabel={lab.allDay} emptyLabel={lab.empty} locale={locale} onSelect={onSelect} />
      ) : view === 'resource' ? (
        <ResourceGrid cursor={cursor} events={events} resources={resources ?? []} labels={lab} tz={timeZone} onSelect={onSelect} />
      ) : (
        <TimeGrid days={view === 'day' ? [cursor] : weekOf(cursor)} events={events} tz={timeZone} weekdays={weekdays} locale={locale} labels={lab} onSelect={onSelect} onMove={onMove} onCreate={onCreate} />
      )}
      {pop && <EventPopover event={pop.e} x={pop.x} y={pop.y} tz={timeZone} labels={lab} onClose={() => setPop(null)} onExpand={(e) => onOpen?.(e)} onCheckIn={onCheckIn} onReschedule={onMove} extra={renderPopoverExtra?.(pop.e, () => setPop(null))} />}
    </div>
  );
};

registerPackageExport(Calendar);

// Month view — week-row spanning bars. A multi-day event renders as ONE continuous bar across exactly
// the days it covers (clamped per week); a single-day event is a one-column bar — so every item stays
// constrained to its day(s) and never bleeds into neighbours. Bars are lane-stacked per week; overflow
// past the lane cap becomes a per-day "+N more". Day-keys (YYYY-MM-DD, tz-resolved) drive placement.
const MONTH_LANE_CAP = 4;
const MonthGrid: React.FC<{ cursor: Date; events: CalEventData[]; today: Date; tz?: string; weekdays: string[]; more: (n: number) => string; onSelect?: (e: CalEventData, x: number, y: number) => void; onDayOpen?: (d: Date) => void }> = ({ cursor, events, today, tz, weekdays, more, onSelect, onDayOpen }) => {
  const days = monthMatrix(cursor);
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const todayKey = dayKeyTz(today, tz);
  const startKeyOf = (e: CalEventData) => dayKeyTz(e.start, tz);
  const endKeyOf = (e: CalEventData) => dayKeyTz(new Date(e.end.getTime() - 1), tz); // inclusive last day

  return (
    <div className={style.month}>
      <div className={style.dowRow}>
        {weekdays.map((w) => (
          <div key={w} className={style.dow}>{w}</div>
        ))}
      </div>
      {weeks.map((week, wi) => {
        const keys = week.map(dayKeyLocal);
        const wStart = keys[0];
        const wEnd = keys[6];
        // events intersecting this week → bar segments (clamped to the week), lane-stacked
        const segs = events
          .filter((e) => endKeyOf(e) >= wStart && startKeyOf(e) <= wEnd)
          .map((e) => {
            const sk = startKeyOf(e);
            const ek = endKeyOf(e);
            let s = sk < wStart ? 0 : keys.indexOf(sk);
            let en = ek > wEnd ? 6 : keys.indexOf(ek);
            if (s < 0) s = 0;
            if (en < 0) en = 6;
            if (en < s) en = s;
            return { e, s, en, span: en - s + 1 };
          })
          .sort((a, b) => a.s - b.s || b.span - a.span || a.e.start.getTime() - b.e.start.getTime());
        const laneEnds: number[] = [];
        const placed = segs.map((it) => {
          let lane = laneEnds.findIndex((end) => it.s > end);
          if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(it.en);
          } else laneEnds[lane] = it.en;
          return { ...it, lane };
        });
        const visible = placed.filter((p) => p.lane < MONTH_LANE_CAP);
        const hiddenPerDay = week.map((_, di) => placed.filter((p) => p.lane >= MONTH_LANE_CAP && p.s <= di && p.en >= di).length);

        return (
          <div key={wi} className={style.mWeek}>
            {week.map((d, di) => (
              <Button key={d.toISOString()} type="button" variant="solid" className={style.mCell} data-out={d.getMonth() !== cursor.getMonth() || undefined} data-today={dayKeyLocal(d) === todayKey || undefined} onClick={() => onDayOpen?.(d)}>
                <div className={style.mDate}>{d.getDate()}</div>
                {hiddenPerDay[di] > 0 && <div className={style.mMore}>{more(hiddenPerDay[di])}</div>}
              </Button>
            ))}
            {/* event bars overlay the cells; pointer-events fall through empty areas so the day still opens */}
            <div className={style.mBars}>
              {visible.map((p) => {
                const cross = isCrossTz(p.e.start, p.e.tz, tz);
                const multi = p.span > 1 || p.e.allDay;
                return (
                  <Button
                    key={p.e.id}
                    type="button"
                    variant="solid"
                    size="small"
                    className={style.mBar}
                    data-multi={multi || undefined}
                    style={{ left: `calc(${(p.s / 7) * 100}% + 3px)`, width: `calc(${(p.span / 7) * 100}% - 6px)`, top: `calc(var(--m-date-h) + ${p.lane} * (var(--m-bar-h) + 2px))`, ['--c' as string]: p.e.color ?? 'var(--control-accent)', ['--a' as string]: p.e.accent ?? p.e.color ?? 'var(--control-accent)' }}
                    onClick={(ev) => { ev.stopPropagation(); onSelect?.(p.e, ev.clientX, ev.clientY); }}
                    title={cross ? `${p.e.title} — ${formatTimeZone(p.e.start, p.e.tz)} (event)` : p.e.title}
                  >
                    <span className={style.mDot} />
                    <span className={style.mBarText}>{multi ? p.e.title : `${formatTime(p.e.start, tz)} ${p.e.title}`}</span>
                    {p.e.alert && <span className={style.alertDot} data-tone={p.e.alert.tone} title={p.e.alert.label} role="img" aria-label={p.e.alert.label} />}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Agenda: React.FC<{ cursor: Date; events: CalEventData[]; today: Date; tz?: string; weekdays: string[]; allDayLabel: string; emptyLabel: string; locale: string; onSelect?: (e: CalEventData, x: number, y: number) => void }> = ({ cursor, events, today, tz, weekdays, allDayLabel, emptyLabel, locale, onSelect }) => {
  const inMonth = events.filter((e) => {
    const k = dayKeyTz(e.start, tz);
    return k >= dayKey(cursor.getFullYear(), cursor.getMonth() + 1, 1) && k <= dayKey(cursor.getFullYear(), cursor.getMonth() + 1, 31);
  }).sort((a, b) => a.start.getTime() - b.start.getTime());
  const groups: { key: string; label: Date; items: CalEventData[] }[] = [];
  for (const e of inMonth) {
    const k = dayKeyTz(e.start, tz);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(e);
    else groups.push({ key: k, label: startOfDay(e.start), items: [e] });
  }
  if (!groups.length) return <div className={style.empty}>{emptyLabel}</div>;
  const todayKey = dayKeyTz(today, tz);
  return (
    <div className={style.agenda}>
      {groups.map((g) => (
        <div key={g.key} className={style.agDay}>
          <div className={style.agDate} data-today={g.key === todayKey || undefined}>
            <div className={style.agDow}>{weekdays[g.label.getDay()]}</div>
            <div className={style.agNum}>{g.label.getDate()}</div>
          </div>
          <div className={style.agItems}>
            {g.items.map((e) => {
              const cross = isCrossTz(e.start, e.tz, tz);
              return (
                <Button
                  key={e.id}
                  type="button"
                  variant="solid"
                  className={style.agItem}
                  style={{ ['--c' as string]: e.color ?? 'var(--control-accent)' }}
                  onClick={(ev) => onSelect?.(e, ev.clientX, ev.clientY)}
                >
                  <span className={style.agBar} style={{ background: e.accent ?? e.color ?? 'var(--control-accent)' }} />
                  <span className={style.agTime}>
                    {e.allDay ? allDayLabel : formatTime(e.start, tz)}
                    {cross && <span className={style.agCross}>{formatTimeZone(e.start, e.tz)} · event</span>}
                  </span>
                  <span className={style.agTitle}>{e.title}</span>
                  {e.alert && <span className={style.alertDot} data-tone={e.alert.tone} title={e.alert.label} role="img" aria-label={e.alert.label} />}
                  {e.location && <span className={style.agLoc}>{e.location}</span>}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
