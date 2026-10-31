import type { KotCopy, Order, OrderLine, Payment, PrintLine, Settings } from '@/types/models';
import { fmtPlain } from './money';
import { lineTotalCents } from './pricing';
import { dateTime } from './time';

/**
 * Builds the text of a KOT or receipt as simple lines.
 * The SAME lines are used for: the on-screen preview, the PDF and the thermal printer (print agent).
 * To change what is printed, change it here only.
 */

/** Characters per line in the printer's normal font. */
export function charsPerLine(paperWidth: 80 | 58): number {
  return paperWidth === 58 ? 32 : 48;
}

const divider = (w: number): PrintLine => ({ text: '-'.repeat(w) });

function twoCol(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length);
  if (left.length + right.length + 1 > width) return `${left.slice(0, width - right.length - 1)} ${right}`;
  return left + ' '.repeat(space) + right;
}

/** Wraps long text onto several lines (at spaces where possible), indenting continuation lines. */
function wrap(text: string, width: number, indent = ''): string[] {
  const out: string[] = [];
  let rest = text.trim();
  let first = true;
  while (rest.length > 0) {
    const room = Math.max(4, first ? width : width - indent.length);
    let cut = rest.length <= room ? rest.length : rest.lastIndexOf(' ', room);
    if (cut <= 0) cut = Math.min(room, rest.length);
    out.push((first ? '' : indent) + rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
    first = false;
  }
  return out.length ? out : [''];
}

/** Big (double-width) text only fits half as many characters per line. */
const bigWidth = (w: number) => Math.floor(w / 2);

// ------------------------------------------------------------------ KOT
export interface KotInput {
  settings: Settings;
  order: Pick<Order, 'number' | 'tableLabel' | 'waiterName' | 'type' | 'guests'>;
  lines: OrderLine[]; // only the lines of this batch
  batch: number;
  createdAt: number;
}

export function buildKotPages({ settings, order, lines, batch, createdAt }: KotInput): { lines: PrintLine[] }[] {
  const w = charsPerLine(settings.receipt.paperWidth);
  const copies: KotCopy[] = settings.printing.kotCopies.length
    ? settings.printing.kotCopies
    : [{ label: 'KITCHEN', station: null }];
  const isAddon = batch > 1;

  return copies.map((copy, i) => {
    const out: PrintLine[] = [];
    if (settings.printing.kotShowBusinessName) out.push({ text: settings.business.name, align: 'center', bold: true });
    out.push({ text: 'KITCHEN ORDER TICKET', align: 'center' });
    out.push({ text: `COPY ${i + 1}/${copies.length} · ${copy.label}`, align: 'center', bold: true, invert: true });
    if (isAddon) out.push({ text: `*** ADD-ON #${batch - 1} ***`, align: 'center', bold: true });
    out.push({ text: twoCol('Order', order.number, w), bold: true });
    out.push({
      text: order.type === 'takeaway' ? 'TAKEAWAY' : `TABLE ${order.tableLabel}`,
      big: true,
      bold: true,
    });
    out.push({ text: twoCol('Time', dateTime(createdAt), w) });
    out.push({ text: twoCol('Waiter', order.waiterName, w) });
    if (order.type === 'dine_in') out.push({ text: twoCol('Guests', String(order.guests), w) });
    out.push(divider(w));

    let mine = 0;
    for (const l of lines) {
      const isMine = copy.station === null || l.station === copy.station;
      if (isMine) mine += 1;
      const head = `[${l.station}] ${l.qty} x ${l.name}`;
      wrap(head, isMine ? bigWidth(w) : w, '      ').forEach((t) => out.push({ text: t, bold: isMine, big: isMine }));
      for (const m of l.modifiers) out.push({ text: `   - ${m.option}`, bold: isMine });
      if (l.note) wrap(`   * ${l.note}`, w, '     ').forEach((t) => out.push({ text: t, bold: true }));
    }
    out.push(divider(w));
    out.push({
      text: copy.station === null ? `Check all ${lines.length} line(s) reach the table` : `Your items: ${mine} line(s)`,
      align: 'center',
    });
    return { lines: out };
  });
}

// ------------------------------------------------------------------ receipt
export interface ReceiptInput {
  settings: Settings;
  order: Pick<Order, 'number' | 'tableLabel' | 'waiterName' | 'type' | 'lines'>;
  payment: Pick<
    Payment,
    | 'receiptNo'
    | 'createdAt'
    | 'cashierName'
    | 'methodLabel'
    | 'methodKind'
    | 'amountCents'
    | 'roundingCents'
    | 'chargedCents'
    | 'tenderedCents'
    | 'changeCents'
    | 'settlesOrder'
    | 'totals'
  >;
}

export function buildReceiptPages({ settings, order, payment }: ReceiptInput): { lines: PrintLine[] }[] {
  const w = charsPerLine(settings.receipt.paperWidth);
  const b = settings.business;
  const t = payment.totals;
  const out: PrintLine[] = [];

  wrap(b.name, bigWidth(w)).forEach((text) => out.push({ text, align: 'center', bold: true, big: true }));
  if (b.legalName) out.push({ text: b.legalName, align: 'center' });
  wrap(b.address, w).forEach((text) => out.push({ text, align: 'center' }));
  if (b.phone) out.push({ text: `Tel ${b.phone}`, align: 'center' });
  if (settings.receipt.showSstNo && b.sstNo) out.push({ text: `SST No: ${b.sstNo}`, align: 'center' });
  if (settings.receipt.headerNote) out.push({ text: settings.receipt.headerNote, align: 'center' });
  out.push(divider(w));
  out.push({ text: 'PAYMENT RECEIPT', align: 'center', bold: true });
  out.push({ text: twoCol('Receipt', payment.receiptNo, w) });
  out.push({ text: twoCol('Order', `${order.number} · ${order.type === 'takeaway' ? 'Takeaway' : order.tableLabel}`, w) });
  out.push({ text: twoCol('Date', dateTime(payment.createdAt), w) });
  out.push({ text: twoCol('Cashier', payment.cashierName, w) });
  if (settings.receipt.showWaiter) out.push({ text: twoCol('Waiter', order.waiterName, w) });
  out.push(divider(w));

  for (const l of order.lines.filter((x) => !x.voided)) {
    const left = `${l.qty} ${l.name}`;
    const right = fmtPlain(lineTotalCents(l));
    if (left.length + right.length + 1 <= w) out.push({ text: twoCol(left, right, w) });
    else {
      wrap(left, w).forEach((text) => out.push({ text }));
      out.push({ text: twoCol('', right, w) });
    }
    for (const m of l.modifiers) out.push({ text: `  - ${m.option}${m.priceCents ? ` +${fmtPlain(m.priceCents)}` : ''}` });
  }
  out.push(divider(w));
  out.push({ text: twoCol('Subtotal', fmtPlain(t.subtotalCents), w) });
  if (t.discountCents) out.push({ text: twoCol('Discount', '-' + fmtPlain(t.discountCents), w) });
  if (t.serviceCents) out.push({ text: twoCol(`Service charge ${settings.tax.serviceRate}%`, fmtPlain(t.serviceCents), w) });
  if (t.sstCents) out.push({ text: twoCol(`SST ${settings.tax.sstRate}%`, fmtPlain(t.sstCents), w) });
  out.push({ text: twoCol('BILL TOTAL', 'RM ' + fmtPlain(t.beforeRoundingCents), w), bold: true });
  out.push(divider(w));
  if (!payment.settlesOrder) out.push({ text: twoCol('This payment (part)', fmtPlain(payment.amountCents), w) });
  if (payment.roundingCents)
    out.push({ text: twoCol('Rounding', (payment.roundingCents > 0 ? '+' : '') + fmtPlain(payment.roundingCents), w) });
  out.push({ text: twoCol('PAID', 'RM ' + fmtPlain(payment.chargedCents), bigWidth(w)), bold: true, big: true });
  out.push({ text: twoCol(payment.methodLabel, fmtPlain(payment.tenderedCents), w) });
  if (payment.changeCents) out.push({ text: twoCol('Change', fmtPlain(payment.changeCents), w) });
  out.push({ text: twoCol('Status', payment.settlesOrder ? 'PAID' : 'PART PAID', w), bold: true });
  out.push(divider(w));
  if (settings.receipt.footerNote) out.push({ text: settings.receipt.footerNote, align: 'center' });
  return [{ lines: out }];
}

export function buildTestPage(settings: Settings, who: string): { lines: PrintLine[] }[] {
  const w = charsPerLine(settings.receipt.paperWidth);
  return [
    {
      lines: [
        ...wrap(settings.business.name, bigWidth(w)).map((text): PrintLine => ({ text, align: 'center', bold: true, big: true })),
        { text: 'TEST PRINT', align: 'center', invert: true, bold: true },
        { text: twoCol('Printer', settings.printing.printerName, w) },
        { text: twoCol('Requested by', who, w) },
        { text: twoCol('Time', dateTime(Date.now()), w) },
        divider(w),
        { text: 'If you can read this, printing works.', align: 'center' },
      ],
    },
  ];
}
