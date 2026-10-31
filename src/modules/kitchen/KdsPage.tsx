import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { limit, orderBy, query, where } from 'firebase/firestore';
import { Check, LogOut } from 'lucide-react';
import { COL } from '@/config/collections';
import { colRef } from '@/services/db';
import { NEXT_TICKET_STATUS, setTicketStatus } from '@/services/kitchen';
import { signOut } from '@/services/auth';
import { useLiveQuery } from '@/hooks/useLive';
import { useNow } from '@/hooks/useNow';
import { useOnline } from '@/hooks/useDeviceStatus';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { hhmm, timer } from '@/lib/time';
import type { Ticket, TicketStatus } from '@/types/models';

const ACTIVE: TicketStatus[] = ['new', 'accepted', 'preparing'];
const BUTTON: Record<TicketStatus, { text: string; cls: string }> = {
  new: { text: 'Accept', cls: 'bg-ink' },
  accepted: { text: 'Start cooking', cls: 'bg-accent' },
  preparing: { text: 'Ready · bump', cls: 'bg-ok' },
  ready: { text: 'Done', cls: 'bg-ok' },
};

/**
 * Kitchen display for one station. Tickets are in cook order (oldest first) and change colour with age:
 * grey → amber after warnAfterMin → red after lateAfterMin (set per station in Settings).
 * Tap an item to strike it (only on this screen). Tap the button to move the ticket on.
 */
export function KdsPage({ stationId }: { stationId: string }) {
  const { settings } = useSettings();
  const { staff } = useAuth();
  const toast = useToast();
  const now = useNow(1000);
  const online = useOnline();
  const station = settings.stations.find((s) => s.id === stationId) ?? { id: stationId, name: `Station ${stationId}`, warnAfterMin: 10, lateAfterMin: 20 };

  const tickets = useLiveQuery<Ticket>(
    () => query(colRef(COL.tickets), where('station', '==', stationId), where('status', 'in', ACTIVE), orderBy('createdAt')),
    [stationId],
  );
  const recent = useLiveQuery<Ticket>(
    () => query(colRef(COL.tickets), where('station', '==', stationId), where('status', '==', 'ready'), orderBy('readyAt', 'desc'), limit(5)),
    [stationId],
  );
  const [struck, setStruck] = useState<Record<string, boolean>>({});
  const [lastBumped, setLastBumped] = useState<Ticket | null>(null);
  const [showRecall, setShowRecall] = useState(false);

  const allDay = useMemo(() => {
    const m = new Map<string, number>();
    tickets.data.forEach((t) =>
      t.lines.forEach((l) => {
        if (!l.voided && !struck[`${t.id}:${l.lineId}`]) m.set(l.name, (m.get(l.name) ?? 0) + l.qty);
      }),
    );
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [tickets.data, struck]);

  const lateCount = tickets.data.filter((t) => now - t.createdAt >= station.lateAfterMin * 60000).length;

  const advance = async (t: Ticket) => {
    const next = NEXT_TICKET_STATUS[t.status];
    if (!next) return;
    try {
      await setTicketStatus(t, next);
      if (next === 'ready') setLastBumped(t);
    } catch (err) {
      toast.error(err, 'kds');
    }
  };
  const undo = async (t: Ticket) => {
    try {
      await setTicketStatus({ ...t, status: 'ready' }, 'preparing');
      setLastBumped(null);
    } catch (err) {
      toast.error(err, 'kds');
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-kds text-cream">
      {!online && <div className="bg-danger py-2 text-center text-sm font-extrabold">OFFLINE — this screen may be out of date. Check the Wi-Fi.</div>}
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-[#2E3034] bg-rail px-4">
        <div className="flex items-center gap-3">
          <span className="text-[22px] font-extrabold tracking-wide">STATION {station.id}</span>
          <span className="text-sm text-[#A8A49B]">{station.name}</span>
          {settings.stations.length > 1 && staff?.role !== 'kitchen' && (
            <span className="ml-2 flex gap-1">
              {settings.stations.map((s) => (
                <Link key={s.id} to={`/kds/${s.id}`} className={`flex h-9 items-center rounded-lg px-3 text-sm font-bold ${s.id === stationId ? 'bg-cream text-ink' : 'bg-[#2B2D31]'}`}>
                  {s.id}
                </Link>
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-10 items-center rounded-lg bg-[#2B2D31] px-3.5 text-[15px] font-bold">{tickets.data.length} open</span>
          {lateCount > 0 && <span className="flex h-10 items-center rounded-lg bg-[#C53D3D] px-3.5 text-[15px] font-extrabold">{lateCount} late</span>}
          <button type="button" onClick={() => setShowRecall((s) => !s)} className="h-10 rounded-lg border border-[#3A3C41] px-3.5 text-[15px] font-bold">
            Recall · {recent.data.length}
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[#A8A49B]">Late after {station.lateAfterMin} min</span>
          <span className="font-semibold">{staff?.name}</span>
          <span className="text-2xl font-extrabold tabular-nums">{hhmm(now)}</span>
          <button type="button" aria-label="Sign out" onClick={() => signOut()} className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2B2D31]">
            <LogOut size={18} aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside aria-label="All-day counts" className="flex w-[196px] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-[#2E3034] bg-rail p-3">
          <span className="px-1 pb-1.5 text-xs font-extrabold tracking-widest text-[#A8A49B]">ALL DAY</span>
          {allDay.map(([name, n]) => (
            <div key={name} className="flex items-center gap-2.5 rounded-xl bg-[#26282B] p-2.5">
              <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-cream text-lg font-extrabold text-kds">{n}</span>
              <span className="text-sm font-semibold leading-tight">{name}</span>
            </div>
          ))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {tickets.error && <p className="m-3 rounded-xl bg-danger p-3 text-sm font-semibold">{tickets.error}</p>}
          <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto p-3">
            {(showRecall ? recent.data : tickets.data).map((t) => {
              const age = now - t.createdAt;
              const late = t.status !== 'ready' && age >= station.lateAfterMin * 60000;
              const warn = t.status !== 'ready' && age >= station.warnAfterMin * 60000;
              const head = late ? 'bg-[#C53D3D] text-white' : warn ? 'bg-[#E0A63A] text-[#1F1600]' : t.status === 'ready' ? 'bg-ok text-white' : 'bg-[#3A3C41] text-white';
              return (
                <article
                  key={t.id}
                  aria-label={`${t.tableLabel} ${t.orderNumber} ${t.status}`}
                  className={`flex max-h-full w-[232px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white text-ink ${late ? 'ring-[3px] ring-[#C53D3D]' : ''}`}
                >
                  <button type="button" onClick={() => (showRecall ? undo(t) : advance(t))} className={`flex items-start justify-between px-3 py-2.5 text-left ${head}`}>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[28px] font-extrabold leading-none">{t.orderType === 'takeaway' ? 'TA' : t.tableLabel}</span>
                      <span className="text-xs font-bold opacity-90">{t.orderNumber}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-2xl font-extrabold leading-none tabular-nums">{t.status === 'ready' ? 'Done' : timer(t.createdAt, now)}</span>
                      <span className="text-[11px] font-extrabold tracking-wide">
                        {t.status.toUpperCase()}
                        {late ? ' · LATE' : ''}
                      </span>
                    </span>
                  </button>
                  <div className="flex justify-between bg-cream px-3 text-xs font-bold leading-[26px] text-soft">
                    <span>{t.isAddon ? `ADD-ON #${t.batch - 1}` : t.orderType === 'takeaway' ? 'Takeaway' : 'Dine-in'}</span>
                    <span>In {hhmm(t.createdAt)}</span>
                  </div>
                  <ul className="min-h-0 flex-1 overflow-y-auto">
                    {t.lines.map((l) => {
                      const k = `${t.id}:${l.lineId}`;
                      const done = !!struck[k];
                      return (
                        <li key={l.lineId} className="border-b border-[#EEEAE3]">
                          <button
                            type="button"
                            disabled={l.voided}
                            aria-pressed={done}
                            onClick={() => setStruck((s) => ({ ...s, [k]: !done }))}
                            className={`flex w-full gap-2 px-3 py-2.5 text-left ${done ? 'bg-[#F1F7F3] opacity-55' : ''} ${l.voided ? 'opacity-60' : ''}`}
                          >
                            <span className="min-w-[26px] text-[22px] font-extrabold leading-tight tabular-nums">{l.qty}</span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className={`text-lg font-extrabold leading-tight ${done || l.voided ? 'line-through' : ''}`}>{l.name}</span>
                              {l.modifiers.length > 0 && <span className="text-[15px] font-bold leading-snug text-[#8A4320]">{l.modifiers.map((m) => m.option).join(' · ')}</span>}
                              {l.note && <span className="self-start rounded-md bg-[#FFE08A] px-2 py-0.5 text-sm font-extrabold uppercase text-[#2A1E05]">{l.note}</span>}
                              {l.voided && <span className="self-start rounded-md bg-[#C53D3D] px-2 py-0.5 text-xs font-extrabold text-white">VOID · {l.voidedBy}</span>}
                            </span>
                            {done && <Check size={22} className="text-ok" strokeWidth={3} aria-hidden />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {t.otherStations.length > 0 && (
                    <div className="border-t border-[#EEEAE3] px-3 py-2 text-xs font-bold text-muted">Also at station {t.otherStations.join(', ')}</div>
                  )}
                  <div className="p-2.5">
                    {showRecall ? (
                      <button type="button" onClick={() => undo(t)} className="h-14 w-full rounded-xl border border-line text-base font-extrabold">
                        Recall to board
                      </button>
                    ) : (
                      <button type="button" onClick={() => advance(t)} className={`h-[58px] w-full rounded-xl text-[17px] font-extrabold text-white ${BUTTON[t.status].cls}`}>
                        {BUTTON[t.status].text}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {!tickets.loading && !showRecall && tickets.data.length === 0 && (
              <div className="flex-1 self-center text-center text-xl text-[#8E8A82]">All caught up</div>
            )}
          </div>
          {lastBumped && !showRecall && (
            <div role="status" className="mx-3 mb-3 flex h-14 items-center justify-between rounded-xl bg-cream pl-4 pr-2 text-ink">
              <span className="text-[15px] font-bold">
                {lastBumped.tableLabel} · {lastBumped.orderNumber} marked ready
              </span>
              <button type="button" onClick={() => undo(lastBumped)} className="h-11 rounded-lg bg-ink px-5 text-[15px] font-extrabold text-white">
                Undo
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
