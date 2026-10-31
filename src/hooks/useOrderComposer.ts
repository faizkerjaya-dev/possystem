import { useCallback, useEffect, useRef, useState } from 'react';
import { COL } from '@/config/collections';
import type { ChosenModifier, Order, OrderType, Product, Table } from '@/types/models';
import { docRef } from '@/services/db';
import { sendAddon, sendNewOrder, type DraftLine } from '@/services/orders';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import { log } from '@/lib/logger';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';
import { useToast } from './useToast';
import { useLiveDoc } from './useLive';

/**
 * Shared brain of the order screens (POS tablet and waiter handheld).
 * - Draft lines (not yet sent) are kept in localStorage, so a refresh or "Hold" never loses them.
 * - send() is protected against double taps: one requestId per send + a `sending` lock.
 */
export interface ComposerArgs {
  orderId?: string; // existing order (add-on)
  tableId?: string | null; // new dine-in order
  guests?: number;
  type?: OrderType;
}

export interface SentInfo {
  orderId: string;
  batch: number;
}

const draftKey = (a: ComposerArgs) => `pos.draft.${a.orderId ?? `new.${a.tableId ?? 'takeaway'}`}`;

function loadDraft(key: string): DraftLine[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as DraftLine[];
  } catch {
    return [];
  }
}

function saveDraft(key: string, lines: DraftLine[]) {
  try {
    if (lines.length) localStorage.setItem(key, JSON.stringify(lines));
    else localStorage.removeItem(key);
  } catch (err) {
    log.warn('composer', 'could not save draft', err);
  }
}

export function useOrderComposer(args: ComposerArgs) {
  const { staff } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const key = draftKey(args);

  const order = useLiveDoc<Order>(() => (args.orderId ? docRef(COL.orders, args.orderId) : null), [args.orderId]);
  const tableId = args.tableId ?? order.data?.tableId ?? null;
  const table = useLiveDoc<Table>(() => (tableId ? docRef(COL.tables, tableId) : null), [tableId]);

  // The draft is stored together with the key it belongs to, so switching orders never mixes drafts.
  const [store, setStore] = useState(() => ({ key, lines: loadDraft(key) }));
  const draft = store.key === key ? store.lines : loadDraft(key);
  const [sending, setSending] = useState(false);
  const requestId = useRef(newId('ord_'));

  const setDraft = useCallback(
    (next: DraftLine[] | ((cur: DraftLine[]) => DraftLine[])) =>
      setStore((s) => {
        const cur = s.key === key ? s.lines : loadDraft(key);
        const lines = typeof next === 'function' ? next(cur) : next;
        saveDraft(key, lines);
        return { key, lines };
      }),
    [key],
  );

  // New order/table => new idempotency key
  useEffect(() => {
    requestId.current = newId('ord_');
  }, [key]);

  const add = useCallback((product: Product, modifiers: ChosenModifier[] = [], note = '', qty = 1) => {
    setDraft((cur) => {
      const sig = JSON.stringify([product.id, modifiers, note]);
      const same = cur.find((l) => JSON.stringify([l.productId, l.modifiers, l.note]) === sig);
      if (same) return cur.map((l) => (l === same ? { ...l, qty: l.qty + qty } : l));
      return [
        ...cur,
        {
          lineId: newId('l_'),
          productId: product.id,
          name: product.name,
          unitCents: product.priceCents,
          qty,
          modifiers,
          note,
          station: product.station,
        },
      ];
    });
  }, [setDraft]);

  const changeQty = useCallback((lineId: string, delta: number) => {
    setDraft((cur) => cur.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0));
  }, [setDraft]);

  const clearDraft = useCallback(() => setDraft([]), [setDraft]);
  const sendingLock = useRef(false); // blocks a second tap before React re-renders

  const send = useCallback(async (): Promise<SentInfo | null> => {
    if (sendingLock.current || !staff || draft.length === 0) return null;
    if (!args.orderId && tableId && !table.data) {
      toast.error(new AppError('UNKNOWN', 'table is still loading, try again'), 'composer');
      return null;
    }
    sendingLock.current = true;
    setSending(true);
    try {
      let info: SentInfo;
      if (args.orderId) {
        if (!order.data) throw new AppError('ORDER_NOT_FOUND', 'still loading, try again');
        await sendAddon({ requestId: requestId.current, orderId: args.orderId, lines: draft, staff, settings });
        info = { orderId: args.orderId, batch: order.data.batchCount + 1 };
      } else {
        const orderId = await sendNewOrder({
          requestId: requestId.current,
          type: args.type ?? (tableId ? 'dine_in' : 'takeaway'),
          table: table.data,
          guests: args.guests ?? 1,
          lines: draft,
          staff,
          settings,
        });
        info = { orderId, batch: 1 };
      }
      setDraft([]);
      requestId.current = newId('ord_'); // next send gets a fresh idempotency key
      return info;
    } catch (err) {
      toast.error(err, 'composer');
      return null;
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  }, [staff, draft, args.orderId, args.type, args.guests, order.data, settings, tableId, table.data, setDraft, toast]);

  return { order: order.data, orderLoading: order.loading, table: table.data, draft, add, changeQty, clearDraft, send, sending };
}
