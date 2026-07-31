import React from 'react';
import { createPortal } from 'react-dom';
import type { CalEventData, CalEventSelect } from './types.js';
import type { CalLabels } from './Calendar.js';
import { dayKey, dayKeyTz, minutesIntoDay, formatTime, instantFromZoned } from './tz.js';
import { Button } from '@_linked/primitives/components/Button';
import style from './Calendar.module.css';

// TimeGrid — week/day time-grid engine (generic; → @_linked/calendar). Gesture state lives at the GRID
// level (not per column) so an event can be dragged ACROSS day columns with live preview. Everything is
// driven by a live "draft" (the working geometry while editing); Confirm commits it (move + resize) via
// onMove; Cancel reverts. Interactions: tap = select (host shows a popover), hold/click-drag = move
// (cross-day), drag either edge = resize, drag empty = create.

const HOUR_H = 48; // px per hour
const SNAP = 15; // minutes
const LONG_PRESS = 320; // ms to hold before move (tap = open)
const MOVE_TOL = 8; // px before a press becomes a drag
const DAY_MS = 86400000;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
const clampMin = (m: number) => Math.max(0, Math.min(24 * 60, m));
const dayKeyLocal = (d: Date) => dayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// greedy overlap-lane assignment within one day's items (segments) — generic so it preserves extra fields
function layout<T extends { e: CalEventData; start: Date; end: Date }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const out: (T & { lane: number; lanes: number })[] = [];
  let cluster: T[] = [];
  let clusterEnd = 0;
  const flush = () => {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    const assign = new Map<string, number>();
    for (const it of cluster) {
      let placed = laneEnds.findIndex((end) => it.start.getTime() >= end);
      if (placed === -1) {
        placed = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[placed] = it.end.getTime();
      assign.set(it.e.id, placed);
    }
    const lanes = laneEnds.length;
    for (const it of cluster) out.push({ ...it, lane: assign.get(it.e.id)!, lanes });
    cluster = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.start.getTime() >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end.getTime());
  }
  flush();
  return out;
}

export const TimeGrid: React.FC<{
  days: Date[];
  events: CalEventData[];
  tz?: string;
  onSelect?: CalEventSelect;
  onMove?: (e: CalEventData, start: Date, end: Date) => void;
  onCreate?: (start: Date, end: Date) => void;
  /** localized short weekday names (Sun-first); BCP-47 locale for time/weekday formatting. */
  weekdays?: string[];
  locale?: string;
  labels: CalLabels;
}> = ({ days, events, tz, onSelect, onMove, onCreate, weekdays = WEEKDAYS, locale = 'en-US', labels }) => {
  const colsRef = React.useRef<HTMLDivElement>(null);
  const N = days.length;
  const dayKeys = React.useMemo(() => days.map(dayKeyLocal), [days]);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const now = new Date();
  const todayKey = dayKeyTz(now, tz);
  const nowMin = minutesIntoDay(now, tz);

  // working DRAFT (live while editing) → Confirm writes, Cancel reverts; opt holds through the refetch
  const [draft, setDraft] = React.useState<{ id: string; e: CalEventData; start: Date; end: Date } | null>(null);
  const [opt, setOpt] = React.useState<{ id: string; start: Date; end: Date } | null>(null);
  React.useEffect(() => {
    setOpt(null);
    setDraft(null);
  }, [events]);
  const [sel, setSel] = React.useState<{ dayIndex: number; fromMin: number; toMin: number } | null>(null);
  const [drag, setDrag] = React.useState<{ e: CalEventData; grabMin: number; grabDay: number; baseStart: Date; baseEnd: Date } | null>(null);
  const [rez, setRez] = React.useState<{ e: CalEventData; grabMin: number; edge: 'start' | 'end'; baseStart: Date; baseEnd: Date } | null>(null);
  const press = React.useRef<{ e: CalEventData; trigger: HTMLElement; grabMin: number; grabDay: number; baseStart: Date; baseEnd: Date; downY: number; timer: number } | null>(null);

  const shift = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
  const geomOf = (e: CalEventData): { start: Date; end: Date } => (draft?.id === e.id ? { start: draft.start, end: draft.end } : opt?.id === e.id ? { start: opt.start, end: opt.end } : { start: e.start, end: e.end });

  const r = () => colsRef.current!.getBoundingClientRect();
  const minuteRaw = (clientY: number) => clampMin(((clientY - r().top) / r().height) * 24 * 60);
  const minuteSnap = (clientY: number) => snap(minuteRaw(clientY));
  const dayAt = (clientX: number) => Math.max(0, Math.min(N - 1, Math.floor(((clientX - r().left) / r().width) * N)));
  // absolute "grid minutes" (day-column × 1440 + minute) and the absolute instant under the cursor —
  // these let a move/resize cross midnight into another day column instead of clamping at the boundary
  const gridMin = (clientX: number, clientY: number) => dayAt(clientX) * 1440 + minuteRaw(clientY);
  const instantAt = (clientX: number, clientY: number) => {
    const d = days[dayAt(clientX)];
    return instantFromZoned(d.getFullYear(), d.getMonth() + 1, d.getDate(), snap(minuteRaw(clientY)), tz);
  };

  // timed events → per-day SEGMENTS (a cross-midnight event is split at each day boundary, so it renders
  // in every column it covers). Draft-aware, so dragging/resizing reshapes the segments live.
  const buckets = React.useMemo(() => {
    const dayStarts = days.map((d) => instantFromZoned(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, tz));
    const b: { e: CalEventData; start: Date; end: Date; isFirst: boolean; isLast: boolean }[][] = days.map(() => []);
    for (const e of events) {
      if (e.allDay) continue; // all-day → the spanning band above
      const g = geomOf(e);
      const startKey = dayKeyTz(g.start, tz);
      const endKey = dayKeyTz(new Date(g.end.getTime() - 1), tz); // inclusive last day
      for (let i = 0; i < days.length; i++) {
        const dayStart = dayStarts[i].getTime();
        const dayEnd = dayStart + DAY_MS;
        const segStart = Math.max(g.start.getTime(), dayStart);
        const segEnd = Math.min(g.end.getTime(), dayEnd);
        if (segStart < segEnd) b[i].push({ e, start: new Date(segStart), end: new Date(segEnd), isFirst: dayKeys[i] === startKey, isLast: dayKeys[i] === endKey });
      }
    }
    return b.map((list) => layout(list));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, dayKeys, draft, opt, tz, days]);

  // all-day (and multi-day) events → spanning bars in a band above the grid, stacked into lanes
  const allDay = React.useMemo(() => {
    const items = events
      .filter((e) => e.allDay)
      .map((e) => {
        let s = dayKeys.indexOf(dayKeyTz(e.start, tz));
        if (s < 0) s = 0;
        let en = dayKeys.indexOf(dayKeyTz(new Date(e.end.getTime() - 1), tz)); // end is exclusive-midnight → last covered day
        if (en < 0) en = N - 1;
        if (en < s) en = s;
        return { e, startIdx: s, endIdx: en };
      })
      .sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx);
    const laneEnds: number[] = [];
    const placed = items.map((p) => {
      let lane = laneEnds.findIndex((end) => p.startIdx > end);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(p.endIdx);
      } else laneEnds[lane] = p.endIdx;
      return { ...p, lane };
    });
    return { placed, lanes: Math.max(1, laneEnds.length) };
  }, [events, dayKeys, tz, N]);

  const beginDrag = () => {
    const p = press.current;
    if (!p) return;
    clearTimeout(p.timer);
    setDrag({ e: p.e, grabMin: p.grabMin, grabDay: p.grabDay, baseStart: p.baseStart, baseEnd: p.baseEnd });
  };
  const cancelPress = () => {
    if (press.current) {
      clearTimeout(press.current.timer);
      press.current = null;
    }
  };

  const onEventDown = (ev: React.PointerEvent<HTMLButtonElement>, e: CalEventData) => {
    ev.stopPropagation();
    colsRef.current?.setPointerCapture?.(ev.pointerId);
    const g = geomOf(e);
    const nextPress = { e, trigger: ev.currentTarget, grabMin: minuteRaw(ev.clientY), grabDay: dayAt(ev.clientX), baseStart: g.start, baseEnd: g.end, downY: ev.clientY, timer: 0 };
    press.current = nextPress;
    if (onMove) nextPress.timer = window.setTimeout(beginDrag, LONG_PRESS);
  };
  const onResizeDown = (ev: React.PointerEvent, e: CalEventData, edge: 'start' | 'end') => {
    ev.stopPropagation();
    if (!onMove) return;
    colsRef.current?.setPointerCapture?.(ev.pointerId);
    const g = geomOf(e);
    setRez({ e, grabMin: minuteRaw(ev.clientY), edge, baseStart: g.start, baseEnd: g.end });
  };

  const onColsPointerDown = (ev: React.PointerEvent) => {
    if ((ev.target as HTMLElement).closest(`.${style.tgEvent}`)) return; // event handles itself
    if ((ev.target as HTMLElement).closest(`.${style.tgConfirm}`)) return; // confirm bar handles itself
    if (!onCreate) return;
    colsRef.current?.setPointerCapture?.(ev.pointerId);
    setSel({ dayIndex: dayAt(ev.clientX), fromMin: minuteSnap(ev.clientY), toMin: minuteSnap(ev.clientY) + SNAP });
  };
  const onColsPointerMove = (ev: React.PointerEvent) => {
    if (sel) {
      setSel((s) => (s ? { ...s, toMin: minuteSnap(ev.clientY) } : s));
      return;
    }
    if (rez) {
      const cand = instantAt(ev.clientX, ev.clientY).getTime(); // absolute target instant under the cursor
      if (rez.edge === 'end') {
        const newEnd = new Date(Math.max(cand, rez.baseStart.getTime() + SNAP * 60000)); // may land on a later day → spans midnight
        setDraft({ id: rez.e.id, e: rez.e, start: rez.baseStart, end: newEnd });
      } else {
        const newStart = new Date(Math.min(cand, rez.baseEnd.getTime() - SNAP * 60000));
        setDraft({ id: rez.e.id, e: rez.e, start: newStart, end: rez.baseEnd });
      }
      return;
    }
    if (drag) {
      // keep the grabbed point under the cursor; delta in absolute grid-minutes shifts BOTH ends (cross-day safe)
      const delta = snap(gridMin(ev.clientX, ev.clientY) - (drag.grabDay * 1440 + drag.grabMin));
      setDraft({ id: drag.e.id, e: drag.e, start: shift(drag.baseStart, delta), end: shift(drag.baseEnd, delta) });
      return;
    }
    if (press.current && Math.abs(ev.clientY - press.current.downY) > MOVE_TOL) beginDrag();
  };
  const onColsPointerUp = (ev: React.PointerEvent) => {
    const gesture = !!drag || !!rez;
    if (sel && onCreate) {
      const a = Math.min(sel.fromMin, sel.toMin);
      const b = Math.max(sel.fromMin, sel.toMin);
      const d = days[sel.dayIndex];
      if (b - a >= SNAP) onCreate(instantFromZoned(d.getFullYear(), d.getMonth() + 1, d.getDate(), a, tz), instantFromZoned(d.getFullYear(), d.getMonth() + 1, d.getDate(), b, tz));
      setSel(null);
    }
    setDrag(null);
    setRez(null);
    const p = press.current;
    if (p) {
      clearTimeout(p.timer);
      if (!gesture) onSelect?.(p.e, ev.clientX, ev.clientY, p.trigger); // a quick tap → host popover
      press.current = null;
    }
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch {
      /* no capture */
    }
  };

  const confirmDraft = () => {
    if (!draft) return;
    setOpt({ id: draft.e.id, start: draft.start, end: draft.end });
    onMove?.(draft.e, draft.start, draft.end);
    setDraft(null);
  };

  return (
    <div className={style.tg}>
      <div className={style.tgHead}>
        <div className={style.tgGutter} />
        {days.map((d, i) => (
          <div key={d.toISOString()} className={style.tgDayHead} data-today={dayKeys[i] === todayKey || undefined}>
            <span className={style.tgDow}>{weekdays[d.getDay()]}</span>
            <span className={style.tgNum}>{d.getDate()}</span>
          </div>
        ))}
      </div>
      {allDay.placed.length > 0 && (
        <div className={style.tgAllDay} style={{ gridTemplateColumns: `56px repeat(${N}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${allDay.lanes}, 22px)` }}>
          <span className={style.tgAllDayLabel}>{labels.allDay}</span>
          {allDay.placed.map(({ e, startIdx, endIdx, lane }) => (
            <Button key={e.id} type="button" variant="solid" size="small" className={style.tgAllDayEvent} style={{ gridColumn: `${startIdx + 2} / ${endIdx + 3}`, gridRow: lane + 1, ['--c' as string]: e.color ?? 'var(--control-accent)', ['--a' as string]: e.accent ?? e.color ?? 'var(--control-accent)' }} onClick={(ev) => onSelect?.(e, ev.clientX, ev.clientY, ev.currentTarget)} title={e.title}>
              {e.title}
            </Button>
          ))}
        </div>
      )}
      <div className={style.tgBody} style={{ ['--hour-h' as string]: `${HOUR_H}px` }}>
        <div className={style.tgGutter}>
          {hours.map((h) => (
            <div key={h} className={style.tgHour}>
              <span className={style.tgHourLabel}>{h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString(locale, { hour: 'numeric' })}</span>
            </div>
          ))}
        </div>
        <div ref={colsRef} className={style.tgCols} onPointerDown={onColsPointerDown} onPointerMove={onColsPointerMove} onPointerUp={onColsPointerUp} onPointerCancel={() => { cancelPress(); setSel(null); setDrag(null); setRez(null); }}>
          {days.map((d, i) => {
            const isToday = dayKeys[i] === todayKey;
            const ghostHere = draft && dayKeyTz(draft.e.start, tz) === dayKeys[i]; // ghost lives in the ORIGINAL day column
            return (
              <div key={d.toISOString()} className={style.tgCol} data-today={isToday || undefined}>
                {hours.map((h) => (
                  <div key={h} className={style.tgSlot} />
                ))}
                {isToday && <div className={style.tgNow} style={{ top: `calc(var(--hour-h) * ${nowMin / 60})` }} />}
                {sel && sel.dayIndex === i && <div className={style.tgSel} style={{ top: `calc(var(--hour-h) * ${Math.min(sel.fromMin, sel.toMin) / 60})`, height: `calc(var(--hour-h) * ${Math.abs(sel.toMin - sel.fromMin) / 60})` }} />}
                {ghostHere &&
                  (() => {
                    const oTop = minutesIntoDay(draft!.e.start, tz);
                    const oDur = Math.min(1440 - oTop, Math.max(SNAP, (draft!.e.end.getTime() - draft!.e.start.getTime()) / 60000)); // clip to the day
                    return <div className={style.tgGhost} style={{ top: `calc(var(--hour-h) * ${oTop / 60})`, height: `calc(var(--hour-h) * ${oDur / 60})`, left: '2px', right: '2px', ['--c' as string]: draft!.e.color ?? 'var(--control-accent)' }} aria-hidden />;
                  })()}
                {buckets[i].map(({ e, start, end, lane, lanes, isFirst, isLast }) => {
                  const topMin = minutesIntoDay(start, tz);
                  const durMin = Math.max(SNAP, (end.getTime() - start.getTime()) / 60000);
                  const active = drag?.e.id === e.id || rez?.e.id === e.id;
                  return (
                    <Button
                      key={e.id}
                      type="button"
                      variant="solid"
                      size="small"
                      className={style.tgEvent}
                      data-dragging={active || undefined}
                      data-continues={!isLast || undefined}
                      style={{ top: `calc(var(--hour-h) * ${topMin / 60})`, height: `calc(var(--hour-h) * ${durMin / 60})`, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`, ['--c' as string]: e.color ?? 'var(--control-accent)', ['--a' as string]: e.accent ?? e.color ?? 'var(--control-accent)' }}
                      onPointerDown={(ev) => onEventDown(ev, e)}
                      onClick={(ev) => {
                        if (ev.detail !== 0) return;
                        const bounds = ev.currentTarget.getBoundingClientRect();
                        onSelect?.(e, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, ev.currentTarget);
                      }}
                      title={labels.interactionHint}
                    >
                      {onMove && isFirst && <span className={style.tgResizeTop} onPointerDown={(ev) => onResizeDown(ev, e, 'start')} aria-hidden />}
                      {e.alert && isFirst && <span className={style.tgAlert} data-tone={e.alert.tone} title={e.alert.label} role="img" aria-label={e.alert.label} />}
                      <span className={style.tgEvTime}>{isFirst ? formatTime(start, tz) : `↳ ${labels.continued}`}</span>
                      <span className={style.tgEvTitle}>{e.title}</span>
                      {onMove && isLast && <span className={style.tgResize} onPointerDown={(ev) => onResizeDown(ev, e, 'end')} aria-hidden />}
                    </Button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {/* PORTALED to body: a transformed/filtered ancestor (motion containers in the shell) re-anchors
          position:fixed to itself, which pushed this toast below the fold on phones — off-screen exactly
          when the user needed to confirm a reschedule. */}
      {draft &&
        typeof document !== 'undefined' &&
        createPortal(
        <div className={style.tgConfirm} onPointerDown={(ev) => ev.stopPropagation()}>
          <span className={style.tgConfirmText}>
            {(() => {
              const movedDay = dayKeyTz(draft.start, tz) !== dayKeyTz(draft.e.start, tz);
              const spans = dayKeyTz(draft.start, tz) !== dayKeyTz(new Date(draft.end.getTime() - 1), tz);
              const wd = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short', timeZone: tz });
              const startStr = `${movedDay || spans ? `${wd(draft.start)} ` : ''}${formatTime(draft.start, tz)}`;
              const endStr = `${spans ? `${wd(draft.end)} ` : ''}${formatTime(draft.end, tz)}`;
              return `${startStr} – ${endStr}`;
            })()}
          </span>
          <Button type="button" size="small" className={style.tgConfirmYes} onClick={confirmDraft}>
            {labels.confirm}
          </Button>
          <Button type="button" variant="outline" size="small" className={style.tgConfirmNo} onClick={() => setDraft(null)}>
            {labels.cancel}
          </Button>
        </div>,
        document.body,
      )}
    </div>
  );
};
