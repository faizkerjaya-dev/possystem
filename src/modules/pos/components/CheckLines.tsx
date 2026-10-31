import type { OrderLine } from '@/types/models';
import type { DraftLine } from '@/services/orders';
import { fmtRM } from '@/lib/money';
import { lineTotalCents } from '@/lib/pricing';
import { hhmm } from '@/lib/time';

/** Check list: sent lines (grey, with SENT time) then new draft lines (highlighted, editable). */
export function CheckLines({
  sent,
  draft,
  held,
  onQty,
  onVoid,
  compact,
}: {
  sent: OrderLine[];
  draft: DraftLine[];
  held?: boolean;
  onQty: (lineId: string, delta: number) => void;
  onVoid?: (line: OrderLine) => void;
  compact?: boolean;
}) {
  const pad = compact ? 'px-3 py-2' : 'px-4 py-2.5';
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {sent.map((l) => (
        <li key={l.lineId} className={`flex items-start gap-2.5 border-b border-[#F4F2EE] ${pad} ${l.voided ? 'opacity-50' : ''}`}>
          <span className="w-6 text-[15px] font-extrabold text-muted">{l.qty}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`text-[15px] font-semibold text-soft ${l.voided ? 'line-through' : ''}`}>{l.name}</span>
            {l.modifiers.length > 0 && <span className="text-xs text-muted">{l.modifiers.map((m) => m.option).join(' · ')}</span>}
            {l.note && <span className="text-xs font-semibold text-[#7A5310]">{l.note}</span>}
            <span className="text-[11px] font-bold text-[#8E8A82]">
              {l.voided ? `VOID · ${l.voidedBy ?? ''}` : `SENT ${hhmm(l.sentAt)} · STATION ${l.station}`}
            </span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <span className="text-[15px] font-semibold tabular-nums text-soft">{fmtRM(lineTotalCents(l))}</span>
            {onVoid && !l.voided && (
              <button type="button" onClick={() => onVoid(l)} className="h-8 rounded-lg border border-[#E2B4B4] px-2 text-xs font-bold text-danger">
                Void
              </button>
            )}
          </span>
        </li>
      ))}
      {draft.map((l) => (
        <li key={l.lineId} className={`flex items-start gap-2.5 border-b border-[#F4F2EE] bg-[#FBF4EE] ${pad}`}>
          <span className="w-6 text-[15px] font-extrabold">{l.qty}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{l.name}</span>
            {l.modifiers.length > 0 && <span className="text-xs text-muted">{l.modifiers.map((m) => m.option).join(' · ')}</span>}
            {l.note && <span className="text-xs font-semibold text-[#7A5310]">{l.note}</span>}
            <span className={`text-[11px] font-bold ${held ? 'text-[#7A5310]' : 'text-accent'}`}>{held ? 'HELD · NOT SENT' : 'NEW · NOT SENT'}</span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <span className="text-[15px] font-semibold tabular-nums">{fmtRM(lineTotalCents({ ...l }))}</span>
            <span className="flex gap-1">
              <button type="button" aria-label={`Less ${l.name}`} onClick={() => onQty(l.lineId, -1)} className="h-9 w-10 rounded-lg border border-line bg-white text-lg">
                −
              </button>
              <button type="button" aria-label={`More ${l.name}`} onClick={() => onQty(l.lineId, 1)} className="h-9 w-10 rounded-lg border border-line bg-white text-lg">
                +
              </button>
            </span>
          </span>
        </li>
      ))}
      {sent.length === 0 && draft.length === 0 && <li className="p-6 text-center text-sm text-muted">Tap items to add them.</li>}
    </ul>
  );
}
