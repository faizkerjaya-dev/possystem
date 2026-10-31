import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, CreditCard, Delete, MoreHorizontal, QrCode, Wallet } from 'lucide-react';
import { COL } from '@/config/collections';
import { can } from '@/config/permissions';
import { Shell } from '@/components/layout/Shell';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Badge, ScreenMessage, Stepper } from '@/components/ui/controls';
import { Modal } from '@/components/ui/Modal';
import { PaperPreview } from '@/components/print/PaperPreview';
import { useStaff } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useLiveDoc } from '@/hooks/useLive';
import { useToast } from '@/hooks/useToast';
import { docRef } from '@/services/db';
import { confirmPayment } from '@/services/payments';
import { setDiscount } from '@/services/orders';
import { releaseTable } from '@/services/tables';
import { computeTotals, lineTotalCents } from '@/lib/pricing';
import { fmtRM, roundTo5Sen, toCents } from '@/lib/money';
import { buildReceiptPages } from '@/lib/printLayout';
import { savePagesAsPdf } from '@/lib/pdf';
import { newId } from '@/lib/ids';
import type { Order, Payment, PaymentKind, PaymentMethod, Table } from '@/types/models';

const KIND_ICON: Record<PaymentKind, typeof Wallet> = { cash: Wallet, qr: QrCode, card: CreditCard, other: MoreHorizontal };

/** Cashier payment screen: method, cash numpad, split, discount, confirm → receipt. */
export function PayPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const staff = useStaff();
  const { settings } = useSettings();
  const toast = useToast();
  const order = useLiveDoc<Order>(() => docRef(COL.orders, orderId), [orderId]);
  const table = useLiveDoc<Table>(() => (order.data?.tableId ? docRef(COL.tables, order.data.tableId) : null), [order.data?.tableId]);

  const methods = settings.paymentMethods.filter((m) => m.enabled);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? 'cash');
  const method: PaymentMethod = methods.find((m) => m.id === methodId) ?? methods[0];
  const [entry, setEntry] = useState('');
  const [ways, setWays] = useState(1);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<Payment | null>(null);
  const [released, setReleased] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const payKey = useRef(newId('pay_'));

  const o = order.data;
  const totals = useMemo(
    () => (o ? computeTotals({ lines: o.lines, tax: settings.tax, orderType: o.type, discountPercent: o.discountPercent }) : null),
    [o, settings.tax],
  );

  if (order.loading) return <ScreenMessage title="Loading bill…" />;
  if (!o || !totals) return <ScreenMessage tone="error" title="[ORDER_NOT_FOUND]" />;
  if (!paid && (o.status === 'paid' || o.status === 'cancelled'))
    return <ScreenMessage title={`[ORDER_CLOSED] ${o.number} is already ${o.status}`} detail="Reprint receipts from the Printer page." />;

  const remaining = totals.beforeRoundingCents - o.paidCents;
  const share = ways > 1 ? Math.floor(totals.beforeRoundingCents / ways) : remaining;
  const amount = remaining - share < ways ? remaining : Math.min(share, remaining); // last part absorbs leftover sen
  const settles = amount === remaining;
  const isCash = method?.kind === 'cash';
  const due = settles && isCash && settings.tax.cashRounding ? roundTo5Sen(amount) : amount;
  const received = isCash ? toCents(entry || '0') : due;
  const short = isCash && received < due;

  const press = (k: string) => {
    if (k === 'del') return setEntry((e) => e.slice(0, -1));
    if (k === '.' && entry.includes('.')) return;
    if (entry.includes('.') && entry.split('.')[1].length >= 2) return;
    if (entry.replace('.', '').length >= 7) return;
    setEntry((e) => e + k);
  };
  const quick = [due, ...[10, 20, 50, 100].map((s) => Math.ceil(due / (s * 100)) * s * 100)]
    .filter((v, i, a) => v >= due && a.indexOf(v) === i)
    .slice(0, 4);

  const confirm = async () => {
    if (busy || short || !method) return;
    setBusy(true);
    try {
      const p = await confirmPayment({
        payKey: payKey.current,
        orderId: o.id,
        method,
        amountCents: amount,
        tenderedCents: received,
        staff,
        settings,
      });
      payKey.current = newId('pay_');
      setPaid(p);
      setEntry('');
    } catch (err) {
      toast.error(err, 'payment');
    } finally {
      setBusy(false);
    }
  };

  const label = o.type === 'takeaway' ? 'Takeaway' : o.tableLabel;
  const sumRows: [string, number, string?][] = [
    ['Subtotal', totals.subtotalCents],
    [o.discountPercent ? `Discount ${o.discountPercent}%` : 'Discount', -totals.discountCents, totals.discountCents ? '#1F6440' : undefined],
    [`Service charge ${settings.tax.serviceRate}%`, totals.serviceCents],
    [`SST ${settings.tax.sstRate}%`, totals.sstCents],
  ];

  return (
    <Shell area="pos">
      <TopBar>
        <Link to="/pos" className="flex h-11 items-center gap-1 pr-2 text-sm font-semibold">
          <ChevronLeft size={20} aria-hidden /> Floor
        </Link>
        <span className="h-7 w-px bg-line" />
        <span className="text-xl font-extrabold">{label}</span>
        <span className="truncate text-[13px] text-muted">
          {o.number} · {o.guests} guests · {o.waiterName}
        </span>
      </TopBar>

      <div className="flex min-h-0 flex-1">
        <aside aria-label="Bill" className="flex w-[340px] shrink-0 flex-col border-r border-line bg-white">
          <div className="flex items-center justify-between border-b border-[#F1EEE8] px-4 py-3.5">
            <span className="text-base font-extrabold">Bill</span>
            {o.status === 'awaiting_payment' && <Badge tone="warn">BILL REQUESTED</Badge>}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-4">
            {o.lines.filter((l) => !l.voided).map((l) => (
              <li key={l.lineId} className="flex gap-2.5 border-b border-[#F4F2EE] py-2.5 text-sm">
                <span className="w-6 font-bold">{l.qty}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{l.name}</span>
                  {l.modifiers.length > 0 && <span className="text-xs text-muted">{l.modifiers.map((m) => m.option).join(' · ')}</span>}
                </span>
                <span className="tabular-nums">{fmtRM(lineTotalCents(l))}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1.5 border-t border-line px-4 py-3 text-sm">
            {sumRows.map(([k, v, color]) => (
              <div key={k} className="flex justify-between text-soft" style={color ? { color } : undefined}>
                <dt>{k}</dt>
                <dd className="tabular-nums">{fmtRM(v)}</dd>
              </div>
            ))}
            <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-line pt-2">
              <dt className="font-extrabold">Bill total</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{fmtRM(totals.beforeRoundingCents)}</dd>
            </div>
            {o.paidCents > 0 && (
              <div className="flex justify-between font-semibold text-[#1F6440]">
                <dt>Already paid</dt>
                <dd className="tabular-nums">{fmtRM(o.paidCents)}</dd>
              </div>
            )}
          </dl>
        </aside>

        <section aria-label="Payment" className="relative flex min-w-0 flex-1 flex-col gap-4 p-5">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-extrabold tracking-widest text-muted">{settles ? 'AMOUNT DUE' : `PART ${ways > 1 ? `· ÷${ways}` : ''}`}</span>
              <span className="text-[56px] font-extrabold leading-none tracking-tight tabular-nums">{fmtRM(due)}</span>
            </div>
            <span className="text-right text-[13px] text-muted">
              {settles && isCash && settings.tax.cashRounding ? `Cash rounded to 5 sen from ${fmtRM(amount)}` : 'Exact amount'}
              <br />
              Remaining on bill: {fmtRM(remaining)}
            </span>
          </div>

          <div role="group" aria-label="Payment method" className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(4, methods.length || 1)}, minmax(0,1fr))` }}>
            {methods.map((m) => {
              const Icon = KIND_ICON[m.kind];
              const on = m.id === method?.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setMethodId(m.id);
                    setEntry('');
                  }}
                  className={`flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[15px] font-bold ${
                    on ? 'bg-ink text-white' : 'border border-line bg-white'
                  }`}
                >
                  <Icon size={24} aria-hidden />
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-1 gap-4">
            {isCash ? (
              <>
                <div role="group" aria-label="Number pad" className="grid w-[330px] shrink-0 grid-cols-3 gap-2" style={{ gridAutoRows: '1fr' }}>
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'].map((k) => (
                    <button key={k} type="button" onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k} className="flex items-center justify-center rounded-2xl border border-line bg-white text-[26px] font-semibold">
                      {k === 'del' ? <Delete size={24} aria-hidden /> : k}
                    </button>
                  ))}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <div className="flex items-baseline justify-between rounded-2xl border-2 border-ink bg-white px-4 py-3.5">
                    <span className="text-[13px] font-bold text-soft">Cash received</span>
                    <span className={`text-[30px] font-extrabold tabular-nums ${entry ? '' : 'text-[#A8A49B]'}`}>RM {entry || '0.00'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {quick.map((v, i) => (
                      <Button key={v} size="lg" onClick={() => setEntry((v / 100).toFixed(2))}>
                        {i === 0 ? `Exact ${(v / 100).toFixed(2)}` : `RM ${v / 100}`}
                      </Button>
                    ))}
                  </div>
                  <div className={`mt-auto flex items-baseline justify-between rounded-2xl px-4 py-3.5 ${!short && received > 0 ? 'bg-okbg' : 'bg-[#EFEDE8]'}`}>
                    <span className="text-[13px] font-bold text-[#1F5A3A]">Change</span>
                    <span className="text-[30px] font-extrabold tabular-nums text-[#1F5A3A]">{fmtRM(Math.max(0, received - due))}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <span className="text-2xl font-extrabold">
                  {method?.kind === 'qr' ? `Scan to pay ${fmtRM(due)}` : `Charge ${fmtRM(due)} on the terminal`}
                </span>
                <span className="max-w-md rounded-xl bg-warnbg px-4 py-3 text-sm font-semibold text-[#5C3D06]">
                  Confirm only after the payment shows as {method?.kind === 'card' ? 'APPROVED on the card terminal' : 'received in the merchant app'}.
                </span>
              </div>
            )}
          </div>

          {ways > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
              <span className="text-sm font-bold">Split equally</span>
              <Stepper label="people" value={ways} min={1} max={20} onChange={setWays} />
              <span className="text-sm text-muted">
                <strong className="text-xl text-ink tabular-nums">{fmtRM(share)}</strong> each
              </span>
            </div>
          )}

          <div className="flex gap-2.5">
            {can(staff.role, 'applyDiscount') && (
              <Button size="xl" className="w-40" onClick={() => setShowDiscount(true)}>
                {o.discountPercent ? `Disc ${o.discountPercent}%` : 'Discount'}
              </Button>
            )}
            <Button size="xl" className="w-40" onClick={() => setWays((w) => (w > 1 ? 1 : 2))}>
              {ways > 1 ? 'No split' : 'Split bill'}
            </Button>
            <Button variant="primary" size="xl" className="flex-1" disabled={busy || short || !method} onClick={confirm}>
              {busy ? 'Confirming…' : isCash && !entry ? 'Enter cash received' : short ? `Short by ${fmtRM(due - received)}` : `Confirm ${method?.label ?? ''} · ${fmtRM(due)}`}
            </Button>
          </div>

          {paid && (
            <PaidOverlay
              payment={paid}
              order={o}
              table={table.data}
              released={released}
              onRelease={async () => {
                try {
                  if (table.data) await releaseTable(staff, table.data);
                  setReleased(true);
                } catch (err) {
                  toast.error(err, 'payment');
                }
              }}
              onNextPart={() => setPaid(null)}
              onDone={() => navigate('/pos')}
            />
          )}
        </section>
      </div>

      {showDiscount && (
        <Modal title="Discount" subtitle="Applied to the whole bill · logged with your name" onClose={() => setShowDiscount(false)}>
          <div className="grid grid-cols-4 gap-2">
            {[0, ...settings.discountOptions].map((pct) => (
              <Button
                key={pct}
                size="xl"
                variant={o.discountPercent === pct ? 'dark' : 'outline'}
                onClick={async () => {
                  try {
                    await setDiscount(staff, o.id, pct);
                    setShowDiscount(false);
                  } catch (err) {
                    toast.error(err, 'payment');
                  }
                }}
              >
                {pct === 0 ? 'None' : `${pct}%`}
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </Shell>
  );
}

function PaidOverlay({
  payment,
  order,
  table,
  released,
  onRelease,
  onNextPart,
  onDone,
}: {
  payment: Payment;
  order: Order;
  table: Table | null;
  released: boolean;
  onRelease: () => void;
  onNextPart: () => void;
  onDone: () => void;
}) {
  const { settings } = useSettings();
  const pages = buildReceiptPages({ settings, order, payment });
  return (
    <div role="status" className="absolute inset-0 flex items-center justify-center gap-8 bg-cream p-5">
      <div className="flex w-[340px] flex-col items-center gap-3.5 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-ok">
          <Check size={52} className="text-white" strokeWidth={2.6} aria-hidden />
        </span>
        <span className="text-[28px] font-extrabold">
          {payment.settlesOrder ? 'Paid' : 'Part paid'} · {fmtRM(payment.chargedCents)}
        </span>
        <span className="text-[15px] text-soft">
          {payment.methodLabel} · {payment.receiptNo}
          {settings.printing.autoPrintReceipt ? ' · printing 1 copy' : ''}
        </span>
        {payment.changeCents > 0 && (
          <span className="flex flex-col rounded-2xl bg-okbg px-7 py-4 text-[#1F5A3A]">
            <span className="text-[13px] font-extrabold tracking-widest">GIVE CHANGE</span>
            <span className="text-5xl font-extrabold tabular-nums">{fmtRM(payment.changeCents)}</span>
          </span>
        )}
        {!payment.settlesOrder ? (
          <Button variant="dark" size="xl" full onClick={onNextPart}>
            Take next part
          </Button>
        ) : table && !released ? (
          <Button variant="dark" size="xl" full onClick={onRelease}>
            Release {table.label} · set cleaning
          </Button>
        ) : (
          <>
            {released && <span className="text-sm font-bold text-soft">{table?.label} released · now cleaning</span>}
            <Button variant="primary" size="xl" full onClick={onDone}>
              Back to floor
            </Button>
          </>
        )}
      </div>
      <div className="flex max-h-full flex-col items-stretch gap-2.5">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PaperPreview lines={pages[0].lines} paperWidth={settings.receipt.paperWidth} />
        </div>
        <Button onClick={() => savePagesAsPdf(pages, payment.receiptNo, settings.receipt.paperWidth)}>Save PDF</Button>
      </div>
    </div>
  );
}
