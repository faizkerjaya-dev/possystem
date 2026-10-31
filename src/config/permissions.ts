import type { Role } from '@/types/models';

/**
 * Who can do what. The UI uses this to show/hide buttons.
 * The REAL enforcement is in firestore.rules — keep both in sync.
 */
export const PERMISSIONS = {
  takeOrders: ['owner', 'admin', 'cashier', 'waiter'],
  voidSentItems: ['owner', 'admin'],
  applyDiscount: ['owner', 'admin', 'cashier'],
  takePayment: ['owner', 'admin', 'cashier'],
  reprint: ['owner', 'admin'],
  kitchen: ['owner', 'admin', 'kitchen'],
  editMenu: ['owner', 'admin'],
  settings: ['owner', 'admin'],
  reports: ['owner', 'admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Where each role lands after login. */
export const HOME_BY_ROLE: Record<Role, string> = {
  owner: '/admin',
  admin: '/admin',
  cashier: '/pos',
  waiter: '/m',
  kitchen: '/kds',
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  cashier: 'Cashier',
  waiter: 'Waiter',
  kitchen: 'Kitchen',
};
