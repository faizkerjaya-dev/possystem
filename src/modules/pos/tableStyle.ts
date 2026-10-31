import type { TableStatus } from '@/types/models';

/** Table colours. Used by the tablet floor plan and the handheld table grid. */
export const TABLE_STYLE: Record<TableStatus, { label: string; bg: string; fg: string; border: string }> = {
  available: { label: 'Available', bg: '#FFFFFF', fg: '#202124', border: '2px solid #D6D1C7' },
  occupied: { label: 'Occupied', bg: '#A9592F', fg: '#FFFFFF', border: '2px solid #A9592F' },
  bill: { label: 'Bill requested', bg: '#D69E2E', fg: '#2A1E05', border: '2px solid #D69E2E' },
  reserved: { label: 'Reserved', bg: '#5A6B94', fg: '#FFFFFF', border: '2px solid #5A6B94' },
  cleaning: { label: 'Cleaning', bg: '#E3E0DA', fg: '#55524C', border: '2px dashed #A8A49B' },
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Food ready',
  served: 'Served',
  awaiting_payment: 'Bill requested',
  paid: 'Paid',
  cancelled: 'Cancelled',
};
