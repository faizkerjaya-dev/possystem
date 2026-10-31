import { Link } from 'react-router-dom';
import { can } from '@/config/permissions';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Badge, ScreenMessage } from '@/components/ui/controls';
import { useStaff } from '@/hooks/useAuth';
import { useNow } from '@/hooks/useNow';
import { useOpenOrders } from '@/hooks/useOrders';
import { fmtRM } from '@/lib/money';
import { duration } from '@/lib/time';
import { ORDER_STATUS_LABEL } from './tableStyle';

/** Every unpaid order (dine-in and takeaway), bills requested first. */
export function ChecksPage() {
  const staff = useStaff();
  const now = useNow(30_000);
  const { orders, totals, loading, error } = useOpenOrders();
  const rank: Record<string, number> = { awaiting_payment: 0, served: 1, ready: 2, preparing: 3, new: 4 };
  const sorted = [...orders].sort((a, b) => rank[a.status] - rank[b.status] || a.createdAt - b.createdAt);

  return (
    <Shell area="pos">
      <TopBar>
        <span className="text-lg font-extrabold">Open checks</span>
        <span className="text-[13px] text-muted">
          {orders.length} unpaid · {fmtRM([...totals.values()].reduce((a, b) => a + b, 0))}
        </span>
      </TopBar>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <ScreenMessage tone="error" title={error} />
        ) : loading ? (
          <ScreenMessage title="Loading…" />
        ) : sorted.length === 0 ? (
          <ScreenMessage title="No open checks" />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {sorted.map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F1EEE8] text-lg font-extrabold">
                  {o.type === 'takeaway' ? 'TA' : o.tableLabel}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-bold">{o.number}</span>
                  <span className="text-xs text-muted">
                    {o.waiterName} · {duration(o.createdAt, now)}
                  </span>
                  <Badge tone={o.status === 'awaiting_payment' ? 'warn' : o.status === 'ready' ? 'ok' : 'grey'}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                </span>
                <span className="flex flex-col items-end gap-2">
                  <span className="text-[17px] font-extrabold tabular-nums">{fmtRM(totals.get(o.id) ?? 0)}</span>
                  <span className="flex gap-1.5">
                    <Link to={`/pos/order/${o.id}`} className="flex h-10 items-center rounded-lg border border-line px-3 text-sm font-bold">
                      Items
                    </Link>
                    {can(staff.role, 'takePayment') && (
                      <Link to={`/pos/pay/${o.id}`} className="flex h-10 items-center rounded-lg bg-accent px-3 text-sm font-bold text-white">
                        Pay
                      </Link>
                    )}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
