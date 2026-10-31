import { runTransaction } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COL } from '@/config/collections';
import type { Order, OrderStatus, Ticket, TicketStatus } from '@/types/models';
import { AppError } from '@/lib/errors';
import { log } from '@/lib/logger';
import { docRef, fromSnap } from './db';

export const NEXT_TICKET_STATUS: Record<TicketStatus, TicketStatus | null> = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: null,
};

/**
 * Works out the order status from all its station tickets.
 * The order is READY only when every station has marked its items ready.
 */
export function deriveOrderStatus(current: OrderStatus, tickets: Record<string, TicketStatus>): OrderStatus {
  if (!['new', 'preparing', 'ready'].includes(current)) return current; // served / billing / paid stay as is
  const all = Object.values(tickets);
  if (all.length && all.every((s) => s === 'ready')) return 'ready';
  if (all.some((s) => s !== 'new')) return 'preparing';
  return 'new';
}

/** Moves a kitchen ticket to `status` and updates the order in the same transaction. */
export async function setTicketStatus(ticket: Ticket, status: TicketStatus) {
  await runTransaction(db, async (tx) => {
    const ticketRef = docRef(COL.tickets, ticket.id);
    const orderRef = docRef(COL.orders, ticket.orderId);
    const [tSnap, oSnap] = await Promise.all([tx.get(ticketRef), tx.get(orderRef)]);
    if (!tSnap.exists() || !oSnap.exists()) throw new AppError('ORDER_NOT_FOUND');
    const order = fromSnap<Order>(oSnap);
    const key = `${ticket.batch}_${ticket.station}`;
    const tickets = { ...order.tickets, [key]: status };
    tx.update(ticketRef, { status, readyAt: status === 'ready' ? Date.now() : null });
    tx.update(orderRef, { tickets, status: deriveOrderStatus(order.status, tickets), updatedAt: Date.now() });
  });
  log.info('kitchen', 'ticket status', { ticket: ticket.id, status });
}
