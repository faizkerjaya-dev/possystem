import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScreenMessage } from '@/components/ui/controls';
import { useMenu } from '@/hooks/useMenu';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { useOrderComposer, type SentInfo } from '@/hooks/useOrderComposer';
import { markServed } from '@/services/orders';
import { computeTotals } from '@/lib/pricing';
import { fmtRM } from '@/lib/money';
import type { OrderType, Product } from '@/types/models';
import { MenuGrid, POPULAR, filterProducts } from '../pos/components/MenuGrid';
import { ModifierDialog } from '../pos/components/ModifierDialog';
import { CheckLines } from '../pos/components/CheckLines';

/** Waiter phone order screen: collapsible check on top, menu below, locked Hold/Send bar. */
export function HandheldOrderPage() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { settings } = useSettings();
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
  const [open, setOpen] = useState(true);
  const [optionsFor, setOptionsFor] = useState<Product | null>(null);
  const [held, setHeld] = useState(false);
  const [lastSent, setLastSent] = useState<SentInfo | null>(() => (location.state as { sent?: SentInfo } | null)?.sent ?? null);

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
  });
  const newQty = c.draft.reduce((s, l) => s + l.qty, 0);
  const title = c.order ? (c.order.type === 'takeaway' ? 'Takeaway' : c.order.tableLabel) : c.table?.label ?? 'Takeaway';

  if (orderId && !c.order && c.orderLoading) return <ScreenMessage title="Loading order…" />;

  const send = async () => {
    const info = await c.send();
    if (!info) return;
    setHeld(false);
    setLastSent(info);
    toast.ok(`Sent · ${settings.printing.kotCopies.length} KOT copies printing at the counter`);
    if (!orderId) navigate(`/m/order/${info.orderId}`, { replace: true, state: { sent: info } });
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-cream">
      <header className="flex h-[60px] shrink-0 items-center gap-1.5 bg-rail pl-1.5 pr-3 text-white">
        <Link to="/m" aria-label="Back to tables" className="flex h-11 w-11 items-center justify-center">
          <ChevronLeft size={24} aria-hidden />
        </Link>
        <span className="flex flex-1 flex-col">
          <span className="text-lg font-extrabold">
            {title}
            {c.order ? ` · ${c.order.guests} guests` : ''}
          </span>
          <span className="text-[11px] text-[#B5B1A8]">{c.order ? `${c.order.number} · ${c.order.waiterName}` : 'New order'}</span>
        </span>
        {c.order?.status === 'ready' && (
          <Button size="sm" variant="success" onClick={() => markServed(c.order!.id).catch((e) => toast.error(e))}>
            Served
          </Button>
        )}
      </header>

      <div className="shrink-0 border-b border-line bg-white">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-[52px] w-full items-center justify-between px-3.5">
          <span className="flex items-center gap-2 text-sm font-bold">
            Check
            <span className="rounded-md bg-[#F1EEE8] px-1.5 py-0.5 text-[11px] text-soft">{sentLines.filter((l) => !l.voided).reduce((s, l) => s + l.qty, 0)} sent</span>
            {newQty > 0 && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] text-white">{newQty} new</span>}
          </span>
          <span className="flex items-center gap-2 text-base font-extrabold tabular-nums">
            {fmtRM(totals.subtotalCents)}
            {open ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
          </span>
        </button>
        {open && (
          <div className="flex max-h-[34vh] flex-col">
            <CheckLines sent={sentLines} draft={c.draft} held={held} onQty={c.changeQty} compact />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 p-2.5 pb-1.5">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3">
          <Search size={16} className="text-muted" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search menu" className="w-full bg-transparent outline-none" />
        </label>
      </div>
      <div role="group" aria-label="Categories" className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-2.5 pb-2">
        {[{ id: POPULAR, name: 'Popular' }, ...menu.categories].map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={cat === k.id}
            onClick={() => {
              setCat(k.id);
              setSearch('');
            }}
            className={`h-10 shrink-0 whitespace-nowrap rounded-xl px-3.5 text-sm font-bold ${cat === k.id ? 'bg-ink text-white' : 'border border-line bg-white'}`}
          >
            {k.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
        {menu.loading ? (
          <ScreenMessage title="Loading menu…" />
        ) : (
          <MenuGrid
            columns={2}
            products={filterProducts(menu.products, cat, search)}
            categoryById={menu.categoryById}
            counts={counts}
            onPick={(p) => (p.modifierGroupIds.length ? setOptionsFor(p) : c.add(p))}
          />
        )}
      </div>

      {lastSent && newQty === 0 && (
        <div role="status" className="mx-2.5 mb-2 rounded-xl bg-okbg px-3 py-2.5 text-[13px] font-bold text-[#1F5A3A]">
          Sent{lastSent.batch > 1 ? ` add-on #${lastSent.batch - 1}` : ''} · {settings.printing.kotCopies.map((k) => k.label).join(' · ')}
        </div>
      )}

      <div className="grid shrink-0 grid-cols-[1fr_1.6fr] gap-2 border-t border-line bg-white p-2.5">
        <Button
          size="lg"
          disabled={newQty === 0}
          onClick={() => {
            setHeld(true);
            toast.info('Held on this phone — not sent yet.');
          }}
        >
          {held ? 'Held' : 'Hold'}
        </Button>
        <Button size="lg" variant="dark" disabled={newQty === 0 || c.sending} onClick={send}>
          {c.sending ? 'Sending…' : `Send · ${newQty}`}
        </Button>
      </div>

      {optionsFor && (
        <ModifierDialog
          product={optionsFor}
          groups={optionsFor.modifierGroupIds.map((id) => menu.groupById.get(id)).filter((g): g is NonNullable<typeof g> => !!g)}
          onClose={() => setOptionsFor(null)}
          onAdd={(mods, note, qty) => {
            c.add(optionsFor, mods, note, qty);
            setOptionsFor(null);
            setHeld(false);
          }}
        />
      )}
    </div>
  );
}
