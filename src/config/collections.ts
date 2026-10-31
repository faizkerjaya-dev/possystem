/**
 * Firestore collection names in ONE place. firestore.rules, the seed script and the
 * print agent use the same names — change them together.
 */
export const COL = {
  settings: 'settings', // single doc: settings/main
  staff: 'staff', // staff/{authUid}
  categories: 'categories',
  products: 'products',
  modifierGroups: 'modifierGroups',
  tables: 'tables',
  orders: 'orders',
  tickets: 'tickets', // one per order batch per kitchen station (what the KDS shows)
  payments: 'payments',
  printJobs: 'printJobs',
  agents: 'agents', // print agent heartbeat
  counters: 'counters', // counters/orders, counters/receipts
  auditLogs: 'auditLogs',
} as const;

export const SETTINGS_DOC_ID = 'main';
