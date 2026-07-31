import React from 'react';
import type { CalEventData } from './types.js';
import type { CalLabels } from './Calendar.js';
import { formatTime, formatTimeZone, isCrossTz, inputValue, instantFromInput, dayKeyTz } from './tz.js';
import { Button } from '@_linked/primitives/components/Button';
import { Heading } from '@_linked/primitives/components/Heading';
import { Input } from '@_linked/primitives/components/Input';
import { Label } from '@_linked/primitives/components/Label';
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
  labels: CalLabels;
  onClose: () => void;
  onExpand: (e: CalEventData) => void;
  onCheckIn?: (e: CalEventData) => void;
  /** Save a manual time edit (start/end). When omitted, the time is read-only. */
  onReschedule?: (e: CalEventData, start: Date, end: Date) => void;
  /** host-supplied extra content (Serve: a compact coverage summary for this item) */
  extra?: React.ReactNode;
}> = ({ event: e, x, y, tz, labels, onClose, onExpand, onCheckIn, onReschedule, extra }) => {
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
      <Button type="button" variant="ghost" className={style.popBackdrop} onClick={onClose} aria-label={labels.close} />
      <div className={style.pop} style={{ left, top, width: W }} role="dialog" aria-label={String(e.title)}>
        <div className={style.popHead}>
          <span className={style.popDot} style={{ background: e.color ?? 'var(--control-accent)' }} />
          <Heading as="h3" className={style.popTitle}>{e.title}</Heading>
        </div>
        <div className={style.popMeta}>
          {editing ? (
            <div className={style.popEdit}>
              <Label className={style.popField}>
                <span>{labels.start}</span>
                <Input type="datetime-local" size="small" className={style.popInput} value={sVal} onChange={(ev) => setSVal(ev.target.value)} />
              </Label>
              <Label className={style.popField}>
                <span>{labels.end}</span>
                <Input type="datetime-local" size="small" className={style.popInput} value={eVal} onChange={(ev) => setEVal(ev.target.value)} />
              </Label>
              <div className={style.popEditRow}>
                <Button type="button" size="small" className={style.popSave} onClick={saveTime}>{labels.save}</Button>
                <Button type="button" variant="outline" size="small" className={style.popEditCancel} onClick={() => { setSVal(inputValue(e.start, tz)); setEVal(inputValue(e.end, tz)); setEditing(false); }}>{labels.cancel}</Button>
              </div>
            </div>
          ) : (
            <div className={style.popTimeRow}>
              <span>{e.allDay ? labels.allDay : `${formatTime(e.start, tz)} – ${formatTime(e.end, tz)}`}</span>
              {onReschedule && !e.allDay && (
                <Button type="button" variant="ghost" size="small" className={style.popEditBtn} onClick={() => setEditing(true)}>{labels.edit}</Button>
              )}
            </div>
          )}
          {cross && !e.allDay && <div className={style.popCross}>{labels.eventLocalTime(formatTimeZone(e.start, e.tz))}</div>}
          {e.location && <div className={style.popLoc}>{e.location}</div>}
        </div>
        {extra && <div className={style.popExtra}>{extra}</div>}
        <div className={style.popActions}>
          {directions && (
            <Button asChild variant="outline" size="small" className={style.popAction}>
              <a href={directions} target="_blank" rel="noreferrer" onClick={onClose}>{labels.directions}</a>
            </Button>
          )}
          {e.virtualUrl && (
            <Button asChild variant="outline" size="small" className={style.popAction}>
              <a href={e.virtualUrl} target="_blank" rel="noreferrer" onClick={onClose}>{labels.join}</a>
            </Button>
          )}
          <Button type="button" variant="outline" size="small" className={style.popAction} onClick={share}>
            {labels.share}
          </Button>
          {showCheckIn && (
            <Button type="button" variant="outline" size="small" className={style.popAction} onClick={() => { onCheckIn!(e); onClose(); }}>
              {labels.checkIn}
            </Button>
          )}
        </div>
        {e.meta?.expandable !== false && (
          <Button type="button" size="small" className={style.popExpand} onClick={() => { onExpand(e); onClose(); }}>
            {labels.expand}
          </Button>
        )}
      </div>
    </>
  );
};
