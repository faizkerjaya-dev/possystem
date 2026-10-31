import type { Settings } from '@/types/models';

/**
 * Used when settings/main is missing a field (older data) and by the seed script.
 * Everything here can be changed by an admin in Settings — nothing is hard-coded elsewhere.
 */
export const DEFAULT_SETTINGS: Settings = {
  business: {
    name: 'WESTERN HOUSE',
    legalName: 'Western House Sdn. Bhd.',
    sstNo: '[SST REG NO]',
    address: '[RESTAURANT ADDRESS]',
    phone: '[PHONE]',
    accent: '#A9592F',
  },
  receipt: {
    headerNote: 'Thank you for dining with us',
    footerNote: 'See you again!',
    showSstNo: true,
    showWaiter: true,
    paperWidth: 80,
  },
  tax: {
    sstEnabled: true,
    sstRate: 6,
    serviceEnabled: true,
    serviceRate: 10,
    serviceOnTakeaway: false,
    cashRounding: true,
  },
  printing: {
    printerName: 'Counter Printer',
    kotCopies: [
      { label: 'STATION A', station: 'A' },
      { label: 'STATION B', station: 'B' },
      { label: 'KAUNTER / PELAYAN', station: null },
    ],
    kotShowBusinessName: true,
    autoPrintReceipt: true,
  },
  paymentMethods: [
    { id: 'cash', label: 'Cash', kind: 'cash', enabled: true },
    { id: 'duitnow', label: 'DuitNow QR', kind: 'qr', enabled: true },
    { id: 'card', label: 'Card', kind: 'card', enabled: true },
    { id: 'tng', label: 'TNG eWallet', kind: 'other', enabled: true },
  ],
  stations: [
    { id: 'A', name: 'Hot kitchen', warnAfterMin: 10, lateAfterMin: 20 },
    { id: 'B', name: 'Drinks & desserts', warnAfterMin: 8, lateAfterMin: 15 },
  ],
  areas: ['Indoor', 'Outdoor', 'VIP'],
  discountOptions: [5, 10, 15],
};

/** Deep-merge saved settings over defaults so new fields never crash old data. */
export function withDefaults(saved: Partial<Settings> | undefined): Settings {
  const s = saved ?? {};
  return {
    business: { ...DEFAULT_SETTINGS.business, ...s.business },
    receipt: { ...DEFAULT_SETTINGS.receipt, ...s.receipt },
    tax: { ...DEFAULT_SETTINGS.tax, ...s.tax },
    printing: { ...DEFAULT_SETTINGS.printing, ...s.printing },
    paymentMethods: s.paymentMethods ?? DEFAULT_SETTINGS.paymentMethods,
    stations: s.stations ?? DEFAULT_SETTINGS.stations,
    areas: s.areas ?? DEFAULT_SETTINGS.areas,
    discountOptions: s.discountOptions ?? DEFAULT_SETTINGS.discountOptions,
  };
}
