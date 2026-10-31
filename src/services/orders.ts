import { runTransaction, updateDoc, type Transaction } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COL } from '@/config/collections';
import type {
  Order,
  OrderLine,
  OrderStatus,
  OrderType,
  PrintJob,
  Settings,
  Staff,
  Table,
  Ticket,
  TicketStatus,
} from '@/types/models';
import { AppError } from '@/lib/errors';
import { buildKotPages } from '@/lib/printLayout';
import { log } from '@/lib/logger';
import { docRef, fromSnap } from './db';
import { writeAudit } from './audit';

/**
 * ORDER FLOW (all writes happen inside ONE Firestore transaction, so they succeed or fail together):
 *
 *   send (new order)  -> orders/{id} + tickets per station + printJobs/kot_{id}_1 + table OCCUPIED + counter++
 *   send (add-on)     -> append lines (batch N) + tickets for batch N + printJobs/kot_{id}_N (new items only)
 *
 * Double-tap protection: the screen generates `requestId` once per send. A repeated call with the same id
 * finds the existing order/batch and does nothing.
 */

/** A line in the composer that has not been sent yet. */
export type DraftLine = Omit<OrderLine, 'batch' | 'voided' | 'sentAt'>;

const ORDER_NUMBER_START = 1000;

function toSentLines(lines: DraftLine[], batch: number, now: number): OrderLine[] {
  return lines.map((l) => ({ ...l, batch, voided: false, sentAt: now }));
}

/** Writes one ticket per station that has items in this batch. Returns the order.tickets entries. */
function writeTickets(
  tx: Transaction,
  order: Pick<Order, 'id' | 'number' | 'tableLabel' | 'type'>,
  lines: OrderLine[],
  batch: number,
  now: number,
): Record<string, TicketStatus> {
  const stations = Array.from(new Set(lines.map((l) => l.station)));
  const entries: Record<string, TicketStatus> = {};
  for (const station of stations) {
    const ticket: Omit<Ticket, 'id'> = {
      orderId: order.id,
      orderNumber: order.number,
      tableLabel: order.tableLabel,
      orderType: order.type,
      station,
      batch,
      isAddon: batch > 1,
      lines: lines.filter((l) => l.station === station),
      status: 'new',
      otherStations: stations.filter((s) => s !== station),
      createdAt: now,
      readyAt: null,
    };
    tx.set(docRef(COL.tickets, `${order.id}_${batch}_${station}`), ticket);
    entries[`${batch}_${station}`] = 'new';
  }
  return entries;
}

function writeKotJob(
  tx: Transaction,
  settings: Settings,
  order: Pick<Order, 'id' | 'number' | 'tableLabel' | 'waiterName' | 'type' | 'guests'>,
  lines: OrderLine[],
  batch: number,
  staff: Staff,
  now: number,
) {
  const job: Omit<PrintJob, 'id'> = {
    type: 'kot',
    ref: order.number,
    summary: `${batch > 1 ? `Add-on #${batch - 1}` : 'New order'} · ${order.tableLabel} · ${lines.length} line(s)`,
    pages: buildKotPages({ settings, order, lines, batch, createdAt: now }),
    paperWidth: settings.receipt.paperWidth,
    status: 'pending',
    attempts: 0,
    error: null,
    createdBy: staff.name,
    createdAt: now,
    updatedAt: now,
  };
  tx.set(docRef(COL.printJobs, `kot_${order.id}_${batch}`), job);
}

export interface SendNewOrderInput {
  requestId: string;
  type: OrderType;
  table: Table | null;
  guests: number;
  lines: DraftLine[];
  staff: Staff;
  settings: Settings;
}

/** Creates the order, kitchen tickets and KOT print job. Returns the order id. */
export async function sendNewOrder(input: SendNewOrderInput): Promise<string> {
  const { requestId, type, table, guests, lines, staff, settings } = input;
  if (lines.length === 0) throw new AppError('NOTHING_TO_SEND');
  const orderId = requestId;

  await runTransaction(db, async (tx) => {
    const orderRef = docRef(COL.orders, orderId);
    const counterRef = docRef(COL.counters, 'orders');
    const [existing, counter, tableSnap] = await Promise.all([
      tx.get(orderRef),
      tx.get(counterRef),
      table ? tx.get(docRef(COL.tables, table.id)) : Promise.resolve(null),
    ]);
    if (existing.exists()) return; // double tap: already created

    if (tableSnap) {
      const t = tableSnap.data() as Table | undefined;
      if (t?.orderId) throw new AppError('TABLE_BUSY', t.label);
    }

    const now = Date.now();
    const nextNumber = (counter.exists() ? (counter.data().value as number) : ORDER_NUMBER_START) + 1;
    const sent = toSentLines(lines, 1, now);
    const base: Omit<Order, 'tickets'> = {
      id: orderId,
      number: `ORD-${nextNumber}`,
      type,
      tableId: table?.id ?? null,
      tableLabel: table?.label ?? 'TA',
      guests,
      waiterId: staff.id,
      waiterName: staff.name,
      status: 'new',
      lines: sent,
      batchCount: 1,
      batchRequestIds: [requestId],
      discountPercent: 0,
      paidCents: 0,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    };
    const tickets = writeTickets(tx, base, sent, 1, now);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _omit, ...orderData } = base;
    tx.set(orderRef, { ...orderData, tickets });
    tx.set(counterRef, { value: nextNumber });
    writeKotJob(tx, settings, base, sent, 1, staff, now);
    if (table) {
      tx.update(docRef(COL.tables, table.id), { status: 'occupied', orderId, guests, openedAt: now, note: '' });
    }
  });
  log.info('orders', 'new order sent', { orderId });
  return orderId;
}

export interface SendAddonInput {
  requestId: string;
  orderId: string;
  lines: DraftLine[];
  staff: Staff;
  settings: Settings;
}

/** Adds a new batch to an existing order. Only the new lines go to the kitchen and printer. */
export async function sendAddon({ requestId, orderId, lines, staff, settings }: SendAddonInput) {
  if (lines.length === 0) throw new AppError('NOTHING_TO_SEND');
  await runTransaction(db, async (tx) => {
    const orderRef = docRef(COL.orders, orderId);
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new AppError('ORDER_NOT_FOUND');
    const order = fromSnap<Order>(snap);
    if (order.batchRequestIds?.includes(requestId)) return; // double tap
    if (order.status === 'paid' || order.status === 'cancelled') throw new AppError('ORDER_CLOSED');

    const now = Date.now();
    const batch = order.batchCount + 1;
    const sent = toSentLines(lines, batch, now);
    const tickets = writeTickets(tx, order, sent, batch, now);
    tx.update(orderRef, {
      lines: [...order.lines, ...sent],
      batchCount: batch,
      batchRequestIds: [...(order.batchRequestIds ?? []), requestId],
      tickets: { ...order.tickets, ...tickets },
      status: 'preparing' satisfies OrderStatus,
      updatedAt: now,
    });
    writeKotJob(tx, settings, order, sent, batch, staff, now);
    if (order.tableId && order.status === 'awaiting_payment') {
      tx.update(docRef(COL.tables, order.tableId), { status: 'occupied' });
    }
  });
  log.info('orders', 'add-on sent', { orderId });
}

/** Admin only: void a line that was already sent. The kitchen ticket shows it as VOID. */
export async function voidLine(staff: Staff, orderId: string, lineId: string, reason: string) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef(COL.orders, orderId));
    if (!snap.exists()) throw new AppError('ORDER_NOT_FOUND');
    const order = fromSnap<Order>(snap);
    const line = order.lines.find((l) => l.lineId === lineId);
    if (!line) return;
    const ticketRef = docRef(COL.tickets, `${orderId}_${line.batch}_${line.station}`);
    const ticketSnap = await tx.get(ticketRef);
    const mark = (l: OrderLine) => (l.lineId === lineId ? { ...l, voided: true, voidedBy: staff.name } : l);
    tx.update(snap.ref, { lines: order.lines.map(mark), updatedAt: Date.now() });
    if (ticketSnap.exists()) tx.update(ticketRef, { lines: (ticketSnap.data() as Ticket).lines.map(mark) });
  });
  await writeAudit(staff, 'order.void', { orderId, lineId, reason });
}

export async function markServed(orderId: string) {
  await updateDoc(docRef(COL.orders, orderId), { status: 'served', updatedAt: Date.now() });
}

/** Waiter/cashier asks for the bill. The table turns yellow; it is NOT released until paid. */
export async function requestBill(order: Order) {
  await updateDoc(docRef(COL.orders, order.id), { status: 'awaiting_payment', updatedAt: Date.now() });
  if (order.tableId) await updateDoc(docRef(COL.tables, order.tableId), { status: 'bill' });
}

export async function setDiscount(staff: Staff, orderId: string, percent: number) {
  await updateDoc(docRef(COL.orders, orderId), { discountPercent: percent, updatedAt: Date.now() });
  await writeAudit(staff, 'order.discount', { orderId, percent });
}

export async function cancelOrder(staff: Staff, order: Order, reason: string) {
  await updateDoc(docRef(COL.orders, order.id), { status: 'cancelled', updatedAt: Date.now() });
  if (order.tableId) await updateDoc(docRef(COL.tables, order.tableId), { status: 'cleaning', orderId: null });
  await writeAudit(staff, 'order.cancel', { orderId: order.id, number: order.number, reason });
}
