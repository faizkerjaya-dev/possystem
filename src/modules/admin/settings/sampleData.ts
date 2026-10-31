import type { Order, OrderLine, Payment, Settings } from '@/types/models';
import { buildKotPages, buildReceiptPages } from '@/lib/printLayout';
import { computeTotals } from '@/lib/pricing';

/** Fake order used ONLY for the live preview in Settings (never saved). */
const line = (name: string, unitCents: number, qty: number, station: string, mods: string[] = []): OrderLine => ({
  lineId: name,
  productId: name,
  name,
  unitCents,
  qty,
  modifiers: mods.map((m) => ({ group: '', option: m, priceCents: 0 })),
  note: '',
  station,
  batch: 1,
  voided: false,
  sentAt: Date.now(),
});

const SAMPLE_LINES = [
  line('Chicken Chop', 2290, 1, 'A', ['Black pepper', 'Fries']),
  line('Sirloin Steak', 4990, 1, 'A', ['Medium rare']),
  line('Iced Lemon Tea', 650, 2, 'B', ['Less sugar']),
];

const SAMPLE_ORDER: Order = {
  id: 'sample',
  number: 'ORD-1001',
  type: 'dine_in',
  tableId: null,
  tableLabel: 'T03',
  guests: 2,
  waiterId: '',
  waiterName: 'Amir',
  status: 'paid',
  lines: SAMPLE_LINES,
  batchCount: 1,
  batchRequestIds: [],
  tickets: {},
  discountPercent: 0,
  paidCents: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  paidAt: Date.now(),
};

export function sampleReceipt(settings: Settings) {
  const totals = computeTotals({ lines: SAMPLE_LINES, tax: settings.tax, orderType: 'dine_in', cash: true });
  const payment: Payment = {
    id: 'sample',
    orderId: 'sample',
    orderNumber: SAMPLE_ORDER.number,
    tableLabel: 'T03',
    receiptNo: 'RCP-20261030-0060',
    methodId: 'cash',
    methodLabel: 'Cash',
    methodKind: 'cash',
    amountCents: totals.beforeRoundingCents,
    roundingCents: totals.roundingCents,
    chargedCents: totals.totalCents,
    tenderedCents: Math.ceil(totals.totalCents / 1000) * 1000,
    changeCents: Math.ceil(totals.totalCents / 1000) * 1000 - totals.totalCents,
    settlesOrder: true,
    totals,
    cashierId: '',
    cashierName: 'Sarah',
    createdAt: Date.now(),
  };
  return buildReceiptPages({ settings, order: SAMPLE_ORDER, payment });
}

export function sampleKot(settings: Settings) {
  return buildKotPages({ settings, order: SAMPLE_ORDER, lines: SAMPLE_LINES, batch: 1, createdAt: Date.now() });
}
