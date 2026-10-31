import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Move, Plus, ReceiptText } from 'lucide-react';
import { COL } from '@/config/collections';
import { can } from '@/config/permissions';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Badge, ScreenMessage, Segmented } from '@/components/ui/controls';
import { useStaff } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useLiveDoc } from '@/hooks/useLive';
import { useNow } from '@/hooks/useNow';
import { useOpenOrders, useTables } from '@/hooks/useOrders';
import { useToast } from '@/hooks/useToast';
import { docRef } from '@/services/db';
import { markTableAvailable, moveTable, releaseTable, reserveTable } from '@/services/tables';
import { markServed, requestBill } from '@/services/orders';
import { computeTotals, lineTotalCents } from '@/lib/pricing';
import { fmtRM } from '@/lib/money';
import { duration } from '@/lib/time';
import type { Order, Table } from '@/types/models';
import { FloorPlan } from './components/FloorPlan';
import { ORDER_STATUS_LABEL, TABLE_STYLE } from './tableStyle';

/** Cashier / admin tablet home: live floor plan + the selected table's check. */
export function FloorPage() {
  const staff = useStaff();
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow(30_000);
  const { tables, loading, error } = useTables();
  const open = useOpenOrders();
  const [area, setArea] = useState(settings.areas[0] ?? 'Indoor');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [arrange, setArrange] = useState(false);

  const inArea = tables.filter((t) => t.area === area);
  const selected = tables.find((t) => t.id === selectedId) ?? null;
  const order = useLiveDoc<Order>(() => (selected?.orderId ? docRef(COL.orders, selected.orderId) : null), [selected?.orderId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    tables.forEach((t) => (c[t.status] = (c[t.status] ?? 0) + 1));
    return c;
  }, [tables]);

  const run = async (fn: () => Promise<unknown>, okText?: string) => {
    try {
      await fn();
      if (okText) toast.ok(okText);
    } catch (err) {
      toast.error(err, 'floor');
    }
  };

  return (
    <Shell area="pos">
      <TopBar>
        <span className="text-lg font-extrabold">Floor</span>
        <Segmented
          label="Area"
          value={area}
          onChange={(a) => {
            setArea(a);
            setSelectedId(null);
          }}
          options={settings.areas.map((a) => ({ value: a, label: `${a} · ${tables.filter((t) => t.area === a).length}` }))}
        />
        <Button size="sm" variant="dark" icon={<Plus size={16} />} onClick={() => navigate('/pos/new?type=takeaway')}>
          Takeaway
        </Button>
        {can(staff.role, 'settings') && (
          <Button size="sm" variant={arrange ? 'primary' : 'outline'} icon={<Move size={16} />} onClick={() => setArrange((a) => !a)}>
            {arrange ? 'Done arranging' : 'Arrange'}
          </Button>
        )}
      </TopBar>

      <div className="flex min-h-0 flex-1">
        <section aria-label="Floor plan" className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          {error ? (
            <ScreenMessage tone="error" title={error} />
          ) : loading ? (
            <ScreenMessage title="Loading tables…" />
          ) : inArea.length === 0 ? (
            <ScreenMessage title={`No tables in ${area}`} detail="Add tables in Admin › Settings › Tables & areas." />
          ) : (
            <div className="flex min-h-0 flex-1 items-center">
              <FloorPlan
                tables={inArea}
                ordersById={open.byId}
                totalsById={open.totals}
                selectedId={selectedId}
                onSelect={(t) => setSelectedId(t.id)}
                now={now}
                editable={arrange}
                onMove={(t, x, y) => run(() => moveTable(t.id, x, y))}
              />
            </div>
          )}
          <ul aria-label="Legend" className="flex flex-wrap gap-4 text-[13px] text-soft">
            {Object.entries(TABLE_STYLE).map(([k, s]) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded" style={{ background: s.bg, border: s.border.replace('2px', '1px') }} />
                {s.label} <strong className="text-ink">{counts[k] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </section>

        <aside aria-label="Selected table" className="flex w-[344px] shrink-0 flex-col border-l border-line bg-white">
          {!selected ? (
            <ScreenMessage title="Tap a table" detail="Its check and actions show here." />
          ) : (
            <TablePanel
              table={selected}
              order={order.data}
              now={now}
              guests={guests}
              setGuests={setGuests}
              onStart={() => navigate(`/pos/new?table=${selected.id}&guests=${guests}`)}
              onAdd={() => order.data && navigate(`/pos/order/${order.data.id}`)}
              onPay={() => order.data && navigate(`/pos/pay/${order.data.id}`)}
              onBill={() => order.data && run(() => requestBill(order.data!), `Bill requested for ${selected.label}`)}
              onServed={() => order.data && run(() => markServed(order.data!.id), 'Marked as served')}
              onRelease={() => run(() => releaseTable(staff, selected), `${selected.label} released · cleaning`)}
              onAvailable={() => run(() => markTableAvailable(selected.id), `${selected.label} is available`)}
              onReserve={() => {
                const note = window.prompt('Reservation (time · name · guests)', '20:00 · ');
                if (note) run(() => reserveTable(selected.id, note));
              }}
              canPay={can(staff.role, 'takePayment')}
              taxSettings={settings.tax}
            />
          )}
        </aside>
      </div>
    </Shell>
  );
}

interface PanelProps {
  table: Table;
  order: Order | null;
  now: number;
  guests: number;
  setGuests: (n: number) => void;
  onStart: () => void;
  onAdd: () => void;
  onPay: () => void;
  onBill: () => void;
  onServed: () => void;
  onRelease: () => void;
  onAvailable: () => void;
  onReserve: () => void;
  canPay: boolean;
  taxSettings: ReturnType<typeof useSettings>['settings']['tax'];
}

function TablePanel(p: PanelProps) {
  const { table, order } = p;
  const s = TABLE_STYLE[table.status];
  const totals = order
    ? computeTotals({ lines: order.lines, tax: p.taxSettings, orderType: order.type, discountPercent: order.discountPercent })
    : null;

  return (
    <>
      <div className="flex flex-col gap-1.5 border-b border-[#F1EEE8] p-4">
        <div className="flex items-center justify-between">
          <span className="text-3xl font-extrabold">{table.label}</span>
          <span className="rounded-full px-3 py-1.5 text-xs font-extrabold" style={{ background: s.bg, color: s.fg, border: s.border }}>
            {s.label.toUpperCase()}
          </span>
        </div>
        <span className="text-[13px] text-muted">
          {order
            ? `${order.number} · ${order.guests} guests · ${order.waiterName} · ${duration(order.createdAt, p.now)}`
            : `${table.area} · ${table.seats} seats`}
        </span>
        {order && <Badge tone={order.status === 'ready' ? 'ok' : order.status === 'paid' ? 'ok' : 'grey'}>{ORDER_STATUS_LABEL[order.status]}</Badge>}
      </div>

      {order && totals ? (
        <>
          <ul className="min-h-0 flex-1 overflow-y-auto px-4 py-1">
            {order.lines.map((l) => (
              <li key={l.lineId} className={`flex gap-2.5 border-b border-[#F4F2EE] py-2 text-sm ${l.voided ? 'line-through opacity-50' : ''}`}>
                <span className="w-6 font-bold">{l.qty}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{l.name}</span>
                  {l.modifiers.length > 0 && <span className="text-xs text-muted">{l.modifiers.map((m) => m.option).join(' · ')}</span>}
                </span>
                <span className="tabular-nums">{fmtRM(lineTotalCents(l))}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1 border-t border-line px-4 py-3 text-[13px] text-soft">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{fmtRM(totals.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt>Service · SST</dt><dd className="tabular-nums">{fmtRM(totals.serviceCents + totals.sstCents)}</dd></div>
            <div className="mt-1 flex items-baseline justify-between text-ink">
              <dt className="font-bold">Total</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{fmtRM(totals.totalCents)}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 px-4 pb-4">
            {order.status === 'paid' ? (
              <Button variant="dark" size="lg" full onClick={p.onRelease}>
                Paid · release table
              </Button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {order.status === 'ready' ? (
                    <Button onClick={p.onServed}>Mark served</Button>
                  ) : (
                    <Button icon={<ReceiptText size={18} />} disabled={order.status === 'awaiting_payment'} onClick={p.onBill}>
                      Request bill
                    </Button>
                  )}
                  <Button variant="dark" onClick={p.onAdd}>Add items</Button>
                </div>
                {p.canPay && (
                  <Button variant="primary" size="lg" full onClick={p.onPay}>
                    Pay {fmtRM(totals.totalCents - order.paidCents)}
                  </Button>
                )}
                <p className="text-center text-xs text-muted">Table is released only after payment.</p>
              </>
            )}
          </div>
        </>
      ) : table.status === 'available' ? (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <span className="text-xs font-bold tracking-wide text-soft">GUESTS</span>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === p.guests}
                onClick={() => p.setGuests(n)}
                className={`h-14 rounded-xl text-xl font-bold ${n === p.guests ? 'bg-ink text-white' : 'border border-line bg-white'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={p.onReserve}>Reserve</Button>
          <Button variant="primary" size="xl" full className="mt-auto" onClick={p.onStart}>
            Start order · {p.guests} guests
          </Button>
        </div>
      ) : table.status === 'reserved' ? (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="text-[15px] text-soft">Reserved: {table.note || '—'}</p>
          <Button variant="primary" size="lg" className="mt-auto" onClick={p.onStart}>Seat guests &amp; start order</Button>
          <Button onClick={p.onAvailable}>Cancel reservation</Button>
        </div>
      ) : table.status === 'cleaning' ? (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="text-[15px] text-soft">Paid and released. Mark available once the table is reset.</p>
          <Button variant="success" size="xl" className="mt-auto" onClick={p.onAvailable}>Mark available</Button>
        </div>
      ) : (
        <ScreenMessage title="Loading check…" />
      )}
      <Link to="/pos/checks" className="border-t border-line p-3 text-center text-sm font-bold">
        All open checks
      </Link>
    </>
  );
}
