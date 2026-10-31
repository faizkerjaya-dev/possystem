import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
import { can } from '@/config/permissions';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { ScreenMessage } from '@/components/ui/controls';
import { useStaff } from '@/hooks/useAuth';
import { useMenu } from '@/hooks/useMenu';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { useOrderComposer, type SentInfo } from '@/hooks/useOrderComposer';
import { voidLine } from '@/services/orders';
import { computeTotals } from '@/lib/pricing';
import { fmtRM } from '@/lib/money';
import type { OrderLine, OrderType, Product } from '@/types/models';
import { MenuGrid, POPULAR, filterProducts } from './components/MenuGrid';
import { ModifierDialog } from './components/ModifierDialog';
import { CheckLines } from './components/CheckLines';
import { KotSentDialog } from './components/KotSentDialog';

/**
 * POS tablet order screen (new order or add-on).
 *   /pos/new?table=<tableId>&guests=4      new dine-in order
 *   /pos/new?type=takeaway                  new takeaway
 *   /pos/order/<orderId>                    add items to an existing order
 */
export function OrderPage() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const staff = useStaff();
  const { settings } = useSettings();
  const toast = useToast();
  const menu = useMenu();

  const type = (params.get('type') as OrderType | null) ?? (params.get('table') ? 'dine_in' : 'takeaway');
  const c = useOrderComposer({
    orderId,
    tableId: params.get('table'),
    guests: Number(params.get('guests') ?? 1),
    type: orderId ? undefined : type,
  });

  const [cat, setCat] = useState(POPULAR);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [optionsFor, setOptionsFor] = useState<Product | null>(null);
  const [held, setHeld] = useState(false);
  // After the first send we navigate to /pos/order/:id and pass the KOT info along, so the dialog survives.
  const location = useLocation();
  const [sent, setSent] = useState<SentInfo | null>(() => (location.state as { sent?: SentInfo } | null)?.sent ?? null);

  const visible = filterProducts(menu.products, cat, search);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    c.draft.forEach((l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty));
    return m;
  }, [c.draft]);

  const sentLines = c.order?.lines ?? [];
  const totals = computeTotals({
    lines: [...sentLines, ...c.draft.map((l) => ({ ...l, voided: false }))],
    tax: settings.tax,
    orderType: c.order?.type ?? type,
    discountPercent: c.order?.discountPercent ?? 0,
  });
  const newQty = c.draft.reduce((s, l) => s + l.qty, 0);
  const label = c.order ? (c.order.type === 'takeaway' ? 'Takeaway' : c.order.tableLabel) : c.table?.label ?? 'Takeaway';

  const pick = (p: Product) => {
    if (p.modifierGroupIds.length) setOptionsFor(p);
    else c.add(p);
    setHeld(false);
  };

  const onSend = async () => {
    const info = await c.send();
    if (!info) return;
    setHeld(false);
    setSent(info);
    if (!orderId) navigate(`/pos/order/${info.orderId}`, { replace: true, state: { sent: info } });
  };

  const onVoid = async (l: OrderLine) => {
    const reason = window.prompt(`Void ${l.qty} x ${l.name}? Reason:`);
    if (!reason || !c.order) return;
    try {
      await voidLine(staff, c.order.id, l.lineId, reason);
      toast.ok(`${l.name} voided · kitchen screen updated`);
    } catch (err) {
      toast.error(err, 'order');
    }
  };

  if (orderId && !c.order && c.orderLoading) return <ScreenMessage title="Loading order…" />;
  if (orderId && !c.order) return <ScreenMessage tone="error" title="[ORDER_NOT_FOUND]" detail="It may have been paid or cancelled." />;

  return (
    <Shell area="pos">
      <TopBar>
        <Link to="/pos" className="flex h-11 items-center gap-1 rounded-lg pr-2 text-sm font-semibold">
          <ChevronLeft size={20} aria-hidden /> Floor
        </Link>
        <span className="h-7 w-px bg-line" />
        <span className="text-xl font-extrabold">{label}</span>
        <span className="truncate text-[13px] text-muted">
          {c.order ? `${c.order.number} · ${c.order.guests} guests · ${c.order.waiterName}` : `New ${type === 'takeaway' ? 'takeaway' : 'dine-in'} order`}
        </span>
        <button
          type="button"
          aria-label="Search menu"
          onClick={() => setShowSearch((s) => !s)}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-line"
        >
          <Search size={18} aria-hidden />
        </button>
        {showSearch && (
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu…"
            aria-label="Search menu"
            className="h-11 w-48 rounded-lg border border-line px-3"
          />
        )}
      </TopBar>

      <div className="flex min-h-0 flex-1">
        <div role="group" aria-label="Categories" className="flex w-[138px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-white p-2">
          {[{ id: POPULAR, name: 'Popular', color: '#8E8A82' }, ...menu.categories].map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={cat === k.id}
              onClick={() => {
                setCat(k.id);
                setSearch('');
              }}
              className={`flex min-h-[56px] items-center gap-2 rounded-xl px-2.5 text-left text-sm leading-tight ${
                cat === k.id ? 'bg-ink font-bold text-white' : 'font-medium'
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: k.color }} />
              {k.name}
            </button>
          ))}
        </div>

        <section aria-label="Menu" className="min-w-0 flex-1 overflow-y-auto p-3">
          {menu.error ? (
            <ScreenMessage tone="error" title={menu.error} />
          ) : menu.loading ? (
            <ScreenMessage title="Loading menu…" />
          ) : (
            <MenuGrid products={visible} categoryById={menu.categoryById} counts={counts} onPick={pick} />
          )}
        </section>

        <aside aria-label="Check" className="flex w-[360px] shrink-0 flex-col border-l border-line bg-white">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <span className="text-[17px] font-extrabold">Check {c.order ? `· ${c.order.number}` : ''}</span>
            <span className="rounded-md bg-[#F1EEE8] px-2 py-1 text-xs font-bold text-soft">
              {sentLines.filter((l) => !l.voided).reduce((s, l) => s + l.qty, 0)} sent · {newQty} new
            </span>
          </div>
          <CheckLines
            sent={sentLines}
            draft={c.draft}
            held={held}
            onQty={c.changeQty}
            onVoid={can(staff.role, 'voidSentItems') ? onVoid : undefined}
          />
          <dl className="flex flex-col gap-1 border-t border-line px-4 py-3 text-[13px] text-soft">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{fmtRM(totals.subtotalCents)}</dd></div>
            <div className="flex justify-between">
              <dt>Service {settings.tax.serviceRate}% · SST {settings.tax.sstRate}%</dt>
              <dd className="tabular-nums">{fmtRM(totals.serviceCents + totals.sstCents)}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 px-3 pb-3">
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <Button
                size="lg"
                disabled={newQty === 0}
                onClick={() => {
                  setHeld(true);
                  toast.info('Items held on this device. They are not sent to the kitchen.');
                }}
              >
                Hold
              </Button>
              <Button size="lg" variant="dark" disabled={newQty === 0 || c.sending} onClick={onSend}>
                {c.sending ? 'Sending…' : `Send · ${newQty} new`}
              </Button>
            </div>
            {c.order && can(staff.role, 'takePayment') && (
              <Link
                to={`/pos/pay/${c.order.id}`}
                className="flex h-[60px] items-center justify-between rounded-xl bg-accent px-5 text-white"
              >
                <span className="text-base font-bold">Pay</span>
                <span className="text-xl font-extrabold tabular-nums">{fmtRM(totals.totalCents - (c.order.paidCents ?? 0))}</span>
              </Link>
            )}
          </div>
        </aside>
      </div>

      {optionsFor && (
        <ModifierDialog
          product={optionsFor}
          groups={optionsFor.modifierGroupIds.map((id) => menu.groupById.get(id)).filter((g): g is NonNullable<typeof g> => !!g)}
          onClose={() => setOptionsFor(null)}
          onAdd={(mods, note, qty) => {
            c.add(optionsFor, mods, note, qty);
            setOptionsFor(null);
          }}
        />
      )}
      {sent && <KotSentDialog orderId={sent.orderId} batch={sent.batch} onClose={() => setSent(null)} />}
    </Shell>
  );
}
