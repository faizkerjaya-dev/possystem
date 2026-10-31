import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { query, where } from 'firebase/firestore';
import { COL } from '@/config/collections';
import { colRef } from '@/services/db';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/controls';
import { useLiveQuery } from '@/hooks/useLive';
import { useOpenOrders, useTables } from '@/hooks/useOrders';
import { useSettings } from '@/hooks/useSettings';
import { fmtRM } from '@/lib/money';
import { lineTotalCents } from '@/lib/pricing';
import { hhmm, startOfDay } from '@/lib/time';
import type { Order, Payment, Ticket } from '@/types/models';
import { TABLE_STYLE } from '../pos/tableStyle';

/** Today at a glance. All numbers are calculated live from Firestore (no separate reporting database). */
export function OverviewPage() {
  const { settings } = useSettings();
  const since = useMemo(() => startOfDay(), []);
  const payments = useLiveQuery<Payment>(() => query(colRef(COL.payments), where('createdAt', '>=', since)), [since]);
  const orders = useLiveQuery<Order>(() => query(colRef(COL.orders), where('createdAt', '>=', since)), [since]);
  const tickets = useLiveQuery<Ticket>(() => query(colRef(COL.tickets), where('status', 'in', ['new', 'accepted', 'preparing'])), []);
  const open = useOpenOrders();
  const { tables } = useTables();

  const s = useMemo(() => {
    const sales = payments.data.reduce((a, p) => a + p.chargedCents, 0);
    const paidOrders = orders.data.filter((o) => o.status === 'paid');
    const covers = orders.data.filter((o) => o.type === 'dine_in' && o.status !== 'cancelled').reduce((a, o) => a + o.guests, 0);
    const discounts = payments.data.filter((p) => p.settlesOrder).reduce((a, p) => a + p.totals.discountCents, 0);
    const voids = orders.data.reduce((a, o) => a + o.lines.filter((l) => l.voided).length, 0);

    const byHour = new Map<number, number>();
    payments.data.forEach((p) => {
      const h = new Date(p.createdAt).getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + p.chargedCents);
    });
    const hours = Array.from({ length: 13 }, (_, i) => i + 10).map((h) => ({ h, v: byHour.get(h) ?? 0 }));
    const maxHour = Math.max(1, ...hours.map((x) => x.v));

    const byMethod = new Map<string, number>();
    payments.data.forEach((p) => byMethod.set(p.methodLabel, (byMethod.get(p.methodLabel) ?? 0) + p.chargedCents));
    const methods = [...byMethod.entries()].sort((a, b) => b[1] - a[1]);

    const items = new Map<string, { qty: number; cents: number }>();
    orders.data
      .filter((o) => o.status !== 'cancelled')
      .forEach((o) =>
        o.lines.filter((l) => !l.voided).forEach((l) => {
          const cur = items.get(l.name) ?? { qty: 0, cents: 0 };
          items.set(l.name, { qty: cur.qty + l.qty, cents: cur.cents + lineTotalCents(l) });
        }),
      );
    const top = [...items.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 6);

    return {
      sales,
      orders: orders.data.filter((o) => o.status !== 'cancelled').length,
      paid: paidOrders.length,
      avg: paidOrders.length ? Math.round(sales / paidOrders.length) : 0,
      covers,
      discounts,
      voids,
      hours,
      maxHour,
      methods,
      top,
      recent: [...payments.data].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
    };
  }, [payments.data, orders.data]);

  const kpis = [
    ['SALES', fmtRM(s.sales), `${payments.data.length} payments`],
    ['ORDERS', String(s.orders), `${s.paid} paid · ${open.orders.length} open`],
    ['AVG. CHECK', fmtRM(s.avg), 'Paid orders'],
    ['COVERS', String(s.covers), s.covers ? `${fmtRM(Math.round(s.sales / s.covers))} per guest` : '—'],
    ['VOIDS · DISCOUNTS', fmtRM(s.discounts), `${s.voids} voided lines`],
  ];
  const tableCounts = Object.keys(TABLE_STYLE).map((k) => ({ k, n: tables.filter((t) => t.status === k).length }));
  const error = payments.error || orders.error;

  return (
    <Shell area="admin">
      <TopBar>
        <span className="text-lg font-extrabold">Overview</span>
        <span className="text-[13px] text-muted">
          Today since {hhmm(since)} · {settings.business.name}
        </span>
      </TopBar>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
        {error && <p className="rounded-xl bg-dangerbg p-3 text-sm font-semibold text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {kpis.map(([label, value, sub]) => (
            <Card key={label} className="flex flex-col gap-1.5 !p-3.5">
              <span className="text-xs font-bold tracking-wide text-muted">{label}</span>
              <span className="text-2xl font-extrabold tabular-nums">{value}</span>
              <span className="text-xs font-semibold text-muted">{sub}</span>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <Card className="flex flex-[2] flex-col gap-3">
            <span className="text-[15px] font-extrabold">Sales by hour</span>
            <div role="img" aria-label="Sales by hour today" className="flex h-48 items-end gap-2 border-b border-[#CFCAC0]">
              {s.hours.map((x) => (
                <div key={x.h} title={`${x.h}:00 · ${fmtRM(x.v)}`} className="flex-1 rounded-t bg-[#D9A385]" style={{ height: `${(x.v / s.maxHour) * 100}%` }} />
              ))}
            </div>
            <div className="flex gap-2 text-center text-[11px] text-muted" aria-hidden>
              {s.hours.map((x) => (
                <span key={x.h} className="flex-1">
                  {x.h}
                </span>
              ))}
            </div>
          </Card>
          <div className="flex flex-1 flex-col gap-3 rounded-2xl bg-rail p-4 text-cream">
            <span className="text-[15px] font-extrabold">Live now</span>
            <Link to="/pos" className="flex flex-col gap-1.5">
              <span className="flex justify-between text-[13px]">
                <span>Tables</span>
                <strong>
                  {tables.filter((t) => t.orderId).length} / {tables.length} in use
                </strong>
              </span>
              <span className="flex h-3 gap-0.5 overflow-hidden rounded-md">
                {tableCounts.filter((c) => c.n).map((c) => (
                  <span key={c.k} style={{ flex: c.n, background: TABLE_STYLE[c.k as keyof typeof TABLE_STYLE].bg }} />
                ))}
              </span>
            </Link>
            <div className="grid grid-cols-2 gap-2">
              {settings.stations.map((st) => (
                <Link key={st.id} to={`/kds/${st.id}`} className="flex flex-col rounded-xl bg-[#2B2D31] p-2.5">
                  <span className="text-xs text-[#B5B1A8]">Kitchen {st.id}</span>
                  <span className="text-xl font-extrabold">{tickets.data.filter((t) => t.station === st.id).length} open</span>
                </Link>
              ))}
            </div>
            <Link to="/pos/checks" className="mt-auto flex items-baseline justify-between rounded-xl bg-[#2B2D31] px-3 py-2.5">
              <span className="text-xs text-[#B5B1A8]">Open bills · {open.orders.length}</span>
              <span className="text-xl font-extrabold tabular-nums">{fmtRM([...open.totals.values()].reduce((a, b) => a + b, 0))}</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card className="flex flex-col gap-3">
            <span className="text-[15px] font-extrabold">Payments</span>
            {s.methods.length === 0 && <span className="text-sm text-muted">No payments yet today.</span>}
            {s.methods.map(([name, cents]) => (
              <div key={name} className="flex flex-col gap-1">
                <span className="flex justify-between text-[13px]">
                  <span className="font-semibold">{name}</span>
                  <strong className="tabular-nums">{fmtRM(cents)}</strong>
                </span>
                <span className="h-2.5 rounded bg-[#F1EEE8]">
                  <span className="block h-2.5 rounded bg-[#C8754D]" style={{ width: `${(cents / Math.max(1, s.sales)) * 100}%` }} />
                </span>
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="mb-1 text-[15px] font-extrabold">Top items</span>
            {s.top.map(([name, v], i) => (
              <div key={name} className="flex items-center gap-2.5 border-b border-[#F4F2EE] py-1.5 text-[13px]">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F1EEE8] text-[11px] font-extrabold">{i + 1}</span>
                <span className="flex-1 font-semibold">{name}</span>
                <span className="text-muted">{v.qty}×</span>
                <span className="w-20 text-right font-bold tabular-nums">{fmtRM(v.cents)}</span>
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="mb-1 text-[15px] font-extrabold">Recent receipts</span>
            {s.recent.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 border-b border-[#F4F2EE] py-1.5 text-[13px]">
                <span className="w-11 tabular-nums text-muted">{hhmm(p.createdAt)}</span>
                <span className="w-11 font-extrabold">{p.tableLabel}</span>
                <span className="flex-1 text-soft">{p.methodLabel}</span>
                <span className="font-bold tabular-nums">{fmtRM(p.chargedCents)}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Shell>
  );
}
