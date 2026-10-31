import { useMemo } from 'react';
import { query, where } from 'firebase/firestore';
import { COL } from '@/config/collections';
import { colRef } from '@/services/db';
import type { Order, OrderStatus, Table } from '@/types/models';
import { computeTotals } from '@/lib/pricing';
import { useLiveQuery } from './useLive';
import { useSettings } from './useSettings';

export const OPEN_STATUSES: OrderStatus[] = ['new', 'preparing', 'ready', 'served', 'awaiting_payment'];

/** All unpaid orders + their bill totals (card, before cash rounding). */
export function useOpenOrders() {
  const { settings } = useSettings();
  const orders = useLiveQuery<Order>(() => query(colRef(COL.orders), where('status', 'in', OPEN_STATUSES)), []);
  const byId = useMemo(() => new Map(orders.data.map((o) => [o.id, o])), [orders.data]);
  const totals = useMemo(
    () =>
      new Map(
        orders.data.map((o) => [
          o.id,
          computeTotals({ lines: o.lines, tax: settings.tax, orderType: o.type, discountPercent: o.discountPercent }).totalCents -
            o.paidCents,
        ]),
      ),
    [orders.data, settings.tax],
  );
  return { orders: orders.data, byId, totals, loading: orders.loading, error: orders.error };
}

export function useTables() {
  const tables = useLiveQuery<Table>(() => colRef(COL.tables), []);
  const sorted = useMemo(() => [...tables.data].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })), [tables.data]);
  return { tables: sorted, loading: tables.loading, error: tables.error };
}
