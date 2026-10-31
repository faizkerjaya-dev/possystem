import { useRef, useState, type PointerEvent } from 'react';
import type { Order, Table } from '@/types/models';
import { fmtRM } from '@/lib/money';
import { duration } from '@/lib/time';
import { TABLE_STYLE } from '../tableStyle';

/** Room coordinates. Table x/y/w/h are stored in this space and scaled to the screen. */
export const ROOM_W = 1000;
export const ROOM_H = 640;

interface Props {
  tables: Table[];
  ordersById: Map<string, Order>;
  totalsById: Map<string, number>;
  selectedId: string | null;
  onSelect: (t: Table) => void;
  now: number;
  /** Admin "arrange" mode: drag tables, then onMove is called on release. */
  editable?: boolean;
  onMove?: (t: Table, x: number, y: number) => void;
}

export function FloorPlan({ tables, ordersById, totalsById, selectedId, onSelect, now, editable, onMove }: Props) {
  const roomRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; x: number; y: number } | null>(null);

  const toRoom = (e: PointerEvent) => {
    const r = roomRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ROOM_W, y: ((e.clientY - r.top) / r.height) * ROOM_H };
  };

  return (
    <div
      ref={roomRef}
      className="relative mx-auto aspect-[1000/640] max-h-full w-full max-w-full rounded-3xl border border-[#E2DDD4] bg-[#FBFAF7]"
      style={{ backgroundImage: 'radial-gradient(#E5E1DA 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      onPointerMove={(e) => {
        if (!drag) return;
        const p = toRoom(e);
        setDrag({ ...drag, x: p.x - drag.dx, y: p.y - drag.dy });
      }}
      onPointerUp={() => {
        if (!drag) return;
        const t = tables.find((x) => x.id === drag.id);
        if (t && onMove) onMove(t, Math.max(0, Math.min(ROOM_W - t.w, drag.x)), Math.max(0, Math.min(ROOM_H - t.h, drag.y)));
        setDrag(null);
      }}
    >
      {tables.map((t) => {
        const s = TABLE_STYLE[t.status];
        const order = t.orderId ? ordersById.get(t.orderId) : undefined;
        const pos = drag?.id === t.id ? { x: drag.x, y: drag.y } : { x: t.x, y: t.y };
        const selected = t.id === selectedId;
        let line1 = `${t.seats} seats`;
        let line2 = '';
        if (order) {
          line1 = `${t.guests || order.guests} guests · ${duration(order.createdAt, now)}`;
          line2 = fmtRM(totalsById.get(order.id) ?? 0);
        } else if (t.status === 'reserved') {
          line1 = t.note || 'Reserved';
        } else if (t.status === 'cleaning') line1 = 'Cleaning';
        const badge = order?.status === 'ready' ? { text: 'FOOD READY', bg: '#2F855A' } : null;

        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={selected}
            aria-label={`${t.label}, ${s.label}, ${line1}`}
            onClick={() => !editable && onSelect(t)}
            onPointerDown={(e) => {
              if (!editable) return;
              const p = toRoom(e);
              setDrag({ id: t.id, dx: p.x - t.x, dy: p.y - t.y, x: t.x, y: t.y });
            }}
            className={`absolute flex flex-col items-center justify-center gap-0.5 p-2 shadow-sm ${editable ? 'cursor-move touch-none' : ''}`}
            style={{
              left: `${(pos.x / ROOM_W) * 100}%`,
              top: `${(pos.y / ROOM_H) * 100}%`,
              width: `${(t.w / ROOM_W) * 100}%`,
              height: `${(t.h / ROOM_H) * 100}%`,
              background: s.bg,
              color: s.fg,
              border: s.border,
              borderRadius: t.shape === 'round' ? '50%' : 18,
              outline: selected ? '4px solid #202124' : 'none',
              outlineOffset: 3,
            }}
          >
            <span className="text-[length:clamp(14px,2.2vw,24px)] font-extrabold leading-none">{t.label}</span>
            <span className="text-center text-[length:clamp(10px,1.2vw,13px)] font-semibold tabular-nums">{line1}</span>
            {line2 && <span className="text-[length:clamp(10px,1.1vw,12px)] tabular-nums opacity-90">{line2}</span>}
            {badge && (
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-[#FBFAF7] px-2 py-0.5 text-[10px] font-extrabold text-white"
                style={{ background: badge.bg }}
              >
                {badge.text}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
