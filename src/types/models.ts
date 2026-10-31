/**
 * Data model shared by every screen. Money is ALWAYS stored as integer cents (sen)
 * to avoid floating point errors: RM 22.90 => 2290.
 * Timestamps are stored as epoch milliseconds (number) so they are easy to read in the
 * Firebase console and the print agent.
 */

export type Role = 'owner' | 'admin' | 'cashier' | 'waiter' | 'kitchen';
export type StationId = string; // 'A', 'B', ...

export interface Staff {
  id: string; // = Firebase Auth uid
  name: string;
  role: Role;
  email: string;
  active: boolean;
  station?: StationId | null; // kitchen staff only
}

// ---------------------------------------------------------------- settings
export interface BusinessSettings {
  name: string;
  legalName: string;
  sstNo: string;
  address: string;
  phone: string;
  accent: string; // hex colour used for primary buttons
}
export interface ReceiptSettings {
  headerNote: string;
  footerNote: string;
  showSstNo: boolean;
  showWaiter: boolean;
  paperWidth: 80 | 58;
}
export interface TaxSettings {
  sstEnabled: boolean;
  sstRate: number; // percent, e.g. 6
  serviceEnabled: boolean;
  serviceRate: number; // percent, e.g. 10
  serviceOnTakeaway: boolean;
  cashRounding: boolean; // round cash totals to nearest 5 sen
}
export interface KotCopy {
  label: string; // printed in the black bar, e.g. "STATION A"
  station: StationId | null; // items of this station are printed bold; null = all bold (counter copy)
}
export interface PrintingSettings {
  printerName: string;
  kotCopies: KotCopy[]; // one page per entry, printed on the single counter printer
  kotShowBusinessName: boolean;
  autoPrintReceipt: boolean;
}
export type PaymentKind = 'cash' | 'qr' | 'card' | 'other';
export interface PaymentMethod {
  id: string;
  label: string;
  kind: PaymentKind;
  enabled: boolean;
}
export interface Station {
  id: StationId;
  name: string;
  warnAfterMin: number;
  lateAfterMin: number;
}
export interface Settings {
  business: BusinessSettings;
  receipt: ReceiptSettings;
  tax: TaxSettings;
  printing: PrintingSettings;
  paymentMethods: PaymentMethod[];
  stations: Station[];
  areas: string[];
  discountOptions: number[]; // percent values offered to the cashier
}

// ---------------------------------------------------------------- menu
export interface Category {
  id: string;
  name: string;
  color: string;
  sort: number;
}
export interface ModifierOption {
  id: string;
  name: string;
  priceCents: number;
  isDefault: boolean;
  available: boolean;
}
export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  maxChoices: number;
  options: ModifierOption[];
  sort: number;
}
export interface Product {
  id: string;
  name: string;
  priceCents: number;
  categoryId: string;
  station: StationId;
  modifierGroupIds: string[];
  available: boolean;
  popular: boolean;
  description: string;
  sort: number;
}

// ---------------------------------------------------------------- floor
export type TableStatus = 'available' | 'occupied' | 'bill' | 'reserved' | 'cleaning';
export type TableShape = 'round' | 'square' | 'rect';
export interface Table {
  id: string;
  label: string; // "T01"
  area: string;
  seats: number;
  shape: TableShape;
  x: number; // position on the floor plan (px in a 1000 x 640 room)
  y: number;
  w: number;
  h: number;
  status: TableStatus;
  orderId: string | null;
  guests: number;
  openedAt: number | null;
  note: string; // e.g. reservation details
}

// ---------------------------------------------------------------- orders
export type OrderType = 'dine_in' | 'takeaway';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'awaiting_payment' | 'paid' | 'cancelled';
export type TicketStatus = 'new' | 'accepted' | 'preparing' | 'ready';

export interface ChosenModifier {
  group: string;
  option: string;
  priceCents: number;
}
export interface OrderLine {
  lineId: string;
  productId: string;
  name: string; // snapshot of product name at order time
  unitCents: number; // snapshot of price at order time
  qty: number;
  modifiers: ChosenModifier[];
  note: string;
  station: StationId;
  batch: number; // 1 = first send, 2+ = add-ons
  voided: boolean;
  voidedBy?: string;
  sentAt: number;
}
export interface Order {
  id: string;
  number: string; // ORD-1001
  type: OrderType;
  tableId: string | null;
  tableLabel: string; // "T03" or "TA"
  guests: number;
  waiterId: string;
  waiterName: string;
  status: OrderStatus;
  lines: OrderLine[];
  batchCount: number;
  batchRequestIds: string[]; // idempotency keys of add-on sends
  tickets: Record<string, TicketStatus>; // key `${batch}_${station}`
  discountPercent: number;
  paidCents: number;
  createdAt: number;
  updatedAt: number;
  paidAt: number | null;
}
export interface Ticket {
  id: string; // `${orderId}_${batch}_${station}`
  orderId: string;
  orderNumber: string;
  tableLabel: string;
  orderType: OrderType;
  station: StationId;
  batch: number;
  isAddon: boolean;
  lines: OrderLine[];
  status: TicketStatus;
  otherStations: StationId[];
  createdAt: number;
  readyAt: number | null;
}

// ---------------------------------------------------------------- money
export interface Totals {
  subtotalCents: number;
  discountCents: number;
  serviceCents: number;
  sstCents: number;
  roundingCents: number;
  totalCents: number; // amount to pay (after rounding)
  beforeRoundingCents: number;
}
export interface Payment {
  id: string; // idempotency key generated by the cashier screen
  orderId: string;
  orderNumber: string;
  tableLabel: string;
  receiptNo: string;
  methodId: string;
  methodLabel: string;
  methodKind: PaymentKind;
  amountCents: number; // part of the bill settled (before rounding)
  roundingCents: number;
  chargedCents: number; // amount + rounding
  tenderedCents: number;
  changeCents: number;
  settlesOrder: boolean;
  totals: Totals; // full bill breakdown at payment time
  cashierId: string;
  cashierName: string;
  createdAt: number;
}

// ---------------------------------------------------------------- printing
export interface PrintLine {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  big?: boolean; // double height + width
  invert?: boolean; // white text on black bar
}
export type PrintJobType = 'kot' | 'receipt' | 'test';
export type PrintJobStatus = 'pending' | 'printing' | 'printed' | 'failed' | 'uncertain';
export interface PrintJob {
  id: string;
  type: PrintJobType;
  ref: string; // order number / receipt number
  summary: string;
  pages: { lines: PrintLine[] }[]; // each page is cut separately
  paperWidth: 80 | 58;
  status: PrintJobStatus;
  attempts: number;
  error: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}
export interface AgentStatus {
  id: string;
  name: string;
  lastSeen: number;
  printerOnline: boolean;
  printerHost: string;
  version: string;
}
