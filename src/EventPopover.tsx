import React from 'react';
import type { CalEventData } from './types.js';
import { formatTime, formatTimeZone, isCrossTz, inputValue, instantFromInput, dayKeyTz } from './tz.js';
import style from './Calendar.module.css';

// EventPopover — the single-click quick card (generic; → @_linked/calendar). Quick actions adapt to the
// item: Directions (physical location), Join (virtual link), Share, Check in (volunteer shifts that
// haven't ended), and Expand → the full detail. The host can inject an `extra` slot (Serve drops a
// coverage peek there). Anchored near the click; a backdrop closes it.
const W = 288;
const H = 300;

export const EventPopover: React.FC<{
  event: CalEventData;
  x: number;
  y: number;
  tz?: string;
  onClose: () => void;
  onExpand: (e: CalEventData) => void;
  onCheckIn?: (e: CalEventData) => void;
  /** Save a manual time edit (start/end). When omitted, the time is read-only. */
  onReschedule?: (e: CalEventData, start: Date, end: Date) => void;
  /** host-supplied extra content (Serve: a compact coverage summary for this item) */
  extra?: React.ReactNode;
}> = ({ event: e, x, y, tz, onClose, onExpand, onCheckIn, onReschedule, extra }) => {
  const cross = isCrossTz(e.start, e.tz, tz);
  // check-in relevance is host-computed per the viewer's privileges (a check-in POSITION, or an attendee
  // day-of) — see serve-calendar-visibility. The engine honours `meta.canCheckIn` when the host sets it,
  // and falls back to a sensible default (volunteer shift, day-of) for standalone use.
  const isVolunteerShift = e.kind === 'mission' || e.meta?.eventType === 'volunteer';
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const live = nowMs >= e.start.getTime() && nowMs <= e.end.getTime();
  const dayOf = (dayKeyTz(now, tz) >= dayKeyTz(e.start, tz) && nowMs <= e.end.getTime()) || live;
  const hostCanCheckIn = e.meta?.canCheckIn as boolean | undefined;
  const showCheckIn = !!onCheckIn && (hostCanCheckIn !== undefined ? hostCanCheckIn : isVolunteerShift && dayOf);
  const [editing, setEditing] = React.useState(false);
  const [sVal, setSVal] = React.useState(() => inputValue(e.start, tz));
  const [eVal, setEVal] = React.useState(() => inputValue(e.end, tz));
  const saveTime = () => {
    const s = instantFromInput(sVal, tz);
    const en = instantFromInput(eVal, tz);
    if (s && en && en.getTime() > s.getTime()) {
      onReschedule?.(e, s, en);
      onClose();
    }
  };
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.min(Math.max(8, x), vw - W - 8);
  const top = Math.min(Math.max(8, y), vh - H - 8);
  const directions = e.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}` : null;
  const share = () => {
    const text = `${e.title} — ${e.start.toLocaleString()}`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) (navigator as any).share({ title: String(e.title), text }).catch(() => {});
    else navigator?.clipboard?.writeText?.(text).catch(() => {});
    onClose();
  };
  return (
    <>
      <div className={style.popBackdrop} onClick={onClose} aria-hidden />
      <div className={style.pop} style={{ left, top, width: W }} role="dialog" aria-label={String(e.title)}>
        <div className={style.popHead}>
          <span className={style.popDot} style={{ background: e.color ?? 'var(--control-accent)' }} />
          <div className={style.popTitle}>{e.title}</div>
        </div>
        <div className={style.popMeta}>
          {editing ? (
            <div className={style.popEdit}>
              <label className={style.popField}>
                <span>Start</span>
                <input type="datetime-local" className={style.popInput} value={sVal} onChange={(ev) => setSVal(ev.target.value)} />
              </label>
              <label className={style.popField}>
                <span>End</span>
                <input type="datetime-local" className={style.popInput} value={eVal} onChange={(ev) => setEVal(ev.target.value)} />
              </label>
              <div className={style.popEditRow}>
                <button type="button" className={style.popSave} onClick={saveTime}>Save</button>
                <button type="button" className={style.popEditCancel} onClick={() => { setSVal(inputValue(e.start, tz)); setEVal(inputValue(e.end, tz)); setEditing(false); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className={style.popTimeRow}>
              <span>{e.allDay ? 'All day' : `${formatTime(e.start, tz)} – ${formatTime(e.end, tz)}`}</span>
              {onReschedule && !e.allDay && (
                <button type="button" className={style.popEditBtn} onClick={() => setEditing(true)}>Edit</button>
              )}
            </div>
          )}
          {cross && !e.allDay && <div className={style.popCross}>{formatTimeZone(e.start, e.tz)} · event’s local time</div>}
          {e.location && <div className={style.popLoc}>{e.location}</div>}
        </div>
        {extra && <div className={style.popExtra}>{extra}</div>}
        <div className={style.popActions}>
          {directions && (
            <a className={style.popAction} href={directions} target="_blank" rel="noreferrer" onClick={onClose}>
              Directions
            </a>
          )}
          {e.virtualUrl && (
            <a className={style.popAction} href={e.virtualUrl} target="_blank" rel="noreferrer" onClick={onClose}>
              Join
            </a>
          )}
          <button type="button" className={style.popAction} onClick={share}>
            Share
          </button>
          {showCheckIn && (
            <button type="button" className={style.popAction} onClick={() => { onCheckIn!(e); onClose(); }}>
              Check in
            </button>
          )}
        </div>
        {e.meta?.expandable !== false && (
          <button type="button" className={style.popExpand} onClick={() => { onExpand(e); onClose(); }}>
            Expand ↗
          </button>
        )}
      </div>
    </>
  );
};
