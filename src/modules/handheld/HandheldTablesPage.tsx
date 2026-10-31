import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useNow } from '@/hooks/useNow';
import { useOpenOrders, useTables } from '@/hooks/useOrders';
import { Segmented, ScreenMessage, Stepper } from '@/components/ui/controls';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { signOut } from '@/services/auth';
import { fmtRM } from '@/lib/money';
import { duration, hhmm } from '@/lib/time';
import type { Table } from '@/types/models';
import { TABLE_STYLE } from '../pos/tableStyle';

/** Waiter phone home: ready alerts, table grid by area, new takeaway button. */
export function HandheldTablesPage() {
  const { staff } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const now = useNow(30_000);
  const { tables, loading, error } = useTables();
  const open = useOpenOrders();
  const [area, setArea] = useState(settings.areas[0] ?? 'Indoor');
  const [seat, setSeat] = useState<Table | null>(null);
  const [guests, setGuests] = useState(2);

  const ready = open.orders.filter((o) => o.status === 'ready');

  const tap = (t: Table) => {
    if (t.orderId && open.byId.has(t.orderId)) navigate(`/m/order/${t.orderId}`);
    else if (t.status === 'available' || t.status === 'reserved') {
      setGuests(Math.min(t.seats, 2));
      setSeat(t);
    }
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-cream">
      <header className="flex h-[60px] shrink-0 items-center justify-between bg-rail pl-4 pr-3 text-white">
        <span className="flex flex-col">
          <span className="text-lg font-extrabold">Tables</span>
          <span className="text-[11px] text-[#B5B1A8]">
            {staff?.name} · {hhmm(now)}
          </span>
        </span>
        <button type="button" aria-label="Sign out" onClick={() => signOut()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2F3135]">
          <LogOut size={20} aria-hidden />
        </button>
      </header>

      {ready.map((o) => (
        <Link key={o.id} to={`/m/order/${o.id}`} className="mx-2.5 mt-2.5 flex min-h-14 items-center justify-between rounded-2xl bg-ok px-4 text-white">
          <span className="flex flex-col">
            <span className="text-[15px] font-extrabold">{o.type === 'takeaway' ? 'Takeaway' : o.tableLabel} · food ready at pass</span>
            <span className="text-xs opacity-90">{o.number}</span>
          </span>
          <span className="rounded-lg bg-white px-3 py-2 text-sm font-extrabold text-[#1F5A3A]">Serve</span>
        </Link>
      ))}

      <div className="p-2.5">
        <Segmented label="Area" value={area} onChange={setArea} options={settings.areas.map((a) => ({ value: a, label: a }))} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
        {error ? (
          <ScreenMessage tone="error" title={error} />
        ) : loading ? (
          <ScreenMessage title="Loading…" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {tables
              .filter((t) => t.area === area)
              .map((t) => {
                const s = TABLE_STYLE[t.status];
                const o = t.orderId ? open.byId.get(t.orderId) : undefined;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => tap(t)}
                    aria-label={`${t.label}, ${s.label}`}
                    className="relative flex h-28 flex-col justify-between rounded-2xl p-2.5 text-left"
                    style={{ background: s.bg, color: s.fg, border: s.border }}
                  >
                    <span className="text-2xl font-extrabold leading-none">{t.label}</span>
                    <span className="flex flex-col text-xs font-bold tabular-nums">
                      {o ? (
                        <>
                          <span>
                            {o.guests} · {duration(o.createdAt, now)}
                          </span>
                          <span className="font-medium opacity-90">{fmtRM(open.totals.get(o.id) ?? 0)}</span>
                        </>
                      ) : (
                        <span>{t.status === 'available' ? `${t.seats} seats` : s.label}</span>
                      )}
                    </span>
                    {o?.status === 'ready' && <span className="absolute right-2 top-2 h-3 w-3 rounded-full border-2 border-white bg-ok" />}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      <nav className="flex h-[76px] shrink-0 items-center justify-center border-t border-line bg-white">
        <Button variant="primary" size="lg" icon={<Plus size={20} />} onClick={() => navigate('/m/new?type=takeaway')}>
          New takeaway
        </Button>
      </nav>

      {seat && (
        <Modal
          title={`${seat.label} · ${seat.area}`}
          subtitle={`${seat.seats} seats${seat.status === 'reserved' ? ` · reserved ${seat.note}` : ''}`}
          onClose={() => setSeat(null)}
          footer={
            <Button variant="primary" size="xl" full onClick={() => navigate(`/m/new?table=${seat.id}&guests=${guests}`)}>
              Start order · {guests} guests
            </Button>
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold">Guests</span>
            <Stepper label="guests" value={guests} min={1} max={30} onChange={setGuests} size="lg" />
          </div>
        </Modal>
      )}
    </div>
  );
}
