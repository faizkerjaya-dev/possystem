/**
 * SEED SCRIPT — run once to fill a new Firebase project with settings, menu, tables and staff logins.
 *
 *   cd scripts
 *   npm install
 *   node seed.mjs --key ../service-account.json --domain staff.pos.local
 *
 * Options:
 *   --key <path>        service account JSON (Firebase console › Project settings › Service accounts › Generate key)
 *   --domain <domain>   must equal VITE_STAFF_EMAIL_DOMAIN in the web app (default staff.pos.local)
 *   --reset-menu        overwrite categories/products/modifier groups/tables even if they exist
 *
 * Safe to run again: existing staff logins are NOT changed, existing menu is kept unless --reset-menu.
 * New staff PINs are printed ONCE at the end — write them down and give them to each person.
 */
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const KEY = arg('--key', process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '../service-account.json');
const DOMAIN = arg('--domain', 'staff.pos.local');
const RESET_MENU = args.includes('--reset-menu');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(KEY, 'utf8'));
} catch (err) {
  console.error(`[seed] Cannot read service account key at "${KEY}". Pass --key <path>.`, err.message);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();
console.log(`[seed] project: ${serviceAccount.project_id} · staff email domain: ${DOMAIN}`);

// ------------------------------------------------------------------ data
const SETTINGS = {
  business: { name: 'WESTERN HOUSE', legalName: 'Western House Sdn. Bhd.', sstNo: '[SST REG NO]', address: '[RESTAURANT ADDRESS]', phone: '[PHONE]', accent: '#A9592F' },
  receipt: { headerNote: 'Thank you for dining with us', footerNote: 'See you again!', showSstNo: true, showWaiter: true, paperWidth: 80 },
  tax: { sstEnabled: true, sstRate: 6, serviceEnabled: true, serviceRate: 10, serviceOnTakeaway: false, cashRounding: true },
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

const CATEGORIES = [
  ['app', 'Appetizers', '#B9A27A'],
  ['chk', 'Chicken', '#D69E2E'],
  ['beef', 'Beef & Steak', '#C8754D'],
  ['pasta', 'Pasta', '#A7A05A'],
  ['sea', 'Fish & Seafood', '#5B8BA3'],
  ['burg', 'Burgers', '#9C6B44'],
  ['side', 'Sides', '#A8A49B'],
  ['drk', 'Drinks', '#4F9A86'],
  ['des', 'Desserts', '#B9707F'],
];

const opt = (id, name, price = 0, isDefault = false) => ({ id, name, priceCents: Math.round(price * 100), isDefault, available: true });
const GROUPS = [
  { id: 'doneness', name: 'Doneness', required: true, maxChoices: 1, options: [opt('rare', 'Rare'), opt('mr', 'Medium rare'), opt('med', 'Medium'), opt('mw', 'Medium well'), opt('wd', 'Well done')] },
  { id: 'sauce', name: 'Sauce', required: true, maxChoices: 1, options: [opt('bp', 'Black pepper', 0, true), opt('mush', 'Mushroom'), opt('bbq', 'BBQ'), opt('mint', 'Mint')] },
  { id: 'side', name: 'Side', required: true, maxChoices: 1, options: [opt('fries', 'Fries', 0, true), opt('mash', 'Mashed potato'), opt('slaw', 'Coleslaw'), opt('salad', 'Garden salad', 2)] },
  { id: 'addons', name: 'Add-ons', required: false, maxChoices: 3, options: [opt('egg', 'Fried egg', 2.5), opt('gmush', 'Grilled mushrooms', 3), opt('xsauce', 'Extra sauce', 1.5), opt('cheese', 'Cheese slice', 2)] },
  { id: 'sugar', name: 'Sugar level', required: true, maxChoices: 1, options: [opt('normal', 'Normal sugar', 0, true), opt('less', 'Less sugar'), opt('none', 'No sugar')] },
  { id: 'ice', name: 'Ice level', required: true, maxChoices: 1, options: [opt('normal', 'Normal ice', 0, true), opt('less', 'Less ice'), opt('none', 'No ice')] },
  { id: 'size', name: 'Drink size', required: true, maxChoices: 1, options: [opt('reg', 'Regular', 0, true), opt('lg', 'Large', 3)] },
];

// [id, name, category, price RM, station, modifier groups, popular]
const PRODUCTS = [
  ['soup', 'Mushroom Soup', 'app', 9.9, 'A', [], true],
  ['garlic', 'Garlic Bread', 'app', 7.9, 'A', []],
  ['caesar', 'Caesar Salad', 'app', 15.9, 'A', []],
  ['chop', 'Chicken Chop', 'chk', 22.9, 'A', ['sauce', 'side'], true],
  ['gchicken', 'Grilled Chicken', 'chk', 21.9, 'A', ['sauce', 'side']],
  ['cordon', 'Chicken Cordon Bleu', 'chk', 26.9, 'A', ['side']],
  ['sirloin', 'Sirloin Steak', 'beef', 49.9, 'A', ['doneness', 'sauce', 'side', 'addons'], true],
  ['ribeye', 'Ribeye Steak', 'beef', 62.9, 'A', ['doneness', 'sauce', 'side', 'addons']],
  ['lamb', 'Grilled Lamb', 'beef', 38.9, 'A', ['doneness', 'sauce', 'side'], true],
  ['carbo', 'Carbonara', 'pasta', 21.9, 'A', [], true],
  ['bolo', 'Spaghetti Bolognese', 'pasta', 19.9, 'A', []],
  ['aglio', 'Aglio Olio Prawn', 'pasta', 23.9, 'A', []],
  ['fish', 'Fish & Chips', 'sea', 24.9, 'A', [], true],
  ['salmon', 'Grilled Salmon', 'sea', 39.9, 'A', ['side']],
  ['bburger', 'Classic Beef Burger', 'burg', 24.9, 'A', ['doneness', 'addons']],
  ['cburger', 'Chicken Burger', 'burg', 19.9, 'A', ['addons']],
  ['fries', 'French Fries', 'side', 8.9, 'A', [], true],
  ['mash', 'Mashed Potato', 'side', 7.9, 'A', []],
  ['slaw', 'Coleslaw', 'side', 5.9, 'A', []],
  ['tea', 'Iced Lemon Tea', 'drk', 6.5, 'B', ['sugar', 'ice'], true],
  ['oj', 'Orange Juice', 'drk', 8.9, 'B', ['ice'], true],
  ['shake', 'Chocolate Milkshake', 'drk', 12.9, 'B', ['size'], true],
  ['water', 'Mineral Water', 'drk', 3.0, 'B', []],
  ['icecream', 'Vanilla Ice Cream', 'des', 7.9, 'B', []],
  ['lava', 'Chocolate Lava Cake', 'des', 14.9, 'B', [], true],
];

// [label, area, seats, x, y]  (room is 1000 x 640)
const TABLES = [
  ['T01', 'Indoor', 2, 40, 40], ['T02', 'Indoor', 4, 220, 30], ['T03', 'Indoor', 4, 420, 30], ['T04', 'Indoor', 4, 620, 30],
  ['T05', 'Indoor', 4, 40, 250], ['T06', 'Indoor', 2, 240, 260], ['T07', 'Indoor', 2, 420, 260], ['T08', 'Indoor', 6, 620, 250],
  ['T09', 'Outdoor', 4, 150, 150], ['T10', 'Outdoor', 4, 450, 150],
  ['T11', 'VIP', 8, 100, 150], ['T12', 'VIP', 8, 520, 150],
];

// [username, name, role, station]
const STAFF = [
  ['owner', 'Owner', 'owner', null],
  ['adam', 'Adam', 'admin', null],
  ['sarah', 'Sarah', 'cashier', null],
  ['amir', 'Amir', 'waiter', null],
  ['daniel', 'Daniel', 'kitchen', 'A'],
  ['aina', 'Aina', 'kitchen', 'B'],
];

// ------------------------------------------------------------------ helpers
async function setIfMissing(ref, data, label) {
  const snap = await ref.get();
  if (snap.exists && !RESET_MENU) {
    console.log(`  - ${label} exists, kept`);
    return;
  }
  await ref.set(data);
  console.log(`  + ${label}`);
}

async function main() {
  console.log('[seed] settings');
  const sRef = db.doc('settings/main');
  if ((await sRef.get()).exists) console.log('  - settings/main exists, kept (edit in Admin › Settings)');
  else {
    await sRef.set({ ...SETTINGS, updatedAt: Date.now(), updatedBy: 'seed' });
    console.log('  + settings/main');
  }

  console.log('[seed] counters');
  for (const id of ['orders', 'receipts']) {
    const ref = db.doc(`counters/${id}`);
    if (!(await ref.get()).exists) {
      await ref.set({ value: id === 'orders' ? 1000 : 0 });
      console.log(`  + counters/${id}`);
    }
  }

  console.log('[seed] menu');
  for (const [i, [id, name, color]] of CATEGORIES.entries()) await setIfMissing(db.doc(`categories/${id}`), { name, color, sort: i + 1 }, `category ${name}`);
  for (const [i, g] of GROUPS.entries()) {
    const { id, ...rest } = g;
    await setIfMissing(db.doc(`modifierGroups/${id}`), { ...rest, sort: i + 1 }, `modifier group ${g.name}`);
  }
  for (const [i, [id, name, categoryId, price, station, groups, popular]] of PRODUCTS.entries()) {
    await setIfMissing(
      db.doc(`products/${id}`),
      { name, categoryId, priceCents: Math.round(price * 100), station, modifierGroupIds: groups, available: true, popular: !!popular, description: '', sort: i + 1 },
      `product ${name}`,
    );
  }

  console.log('[seed] tables');
  for (const [label, area, seats, x, y] of TABLES) {
    const shape = seats <= 2 ? 'round' : seats >= 6 ? 'rect' : 'square';
    await setIfMissing(
      db.doc(`tables/${label}`),
      { label, area, seats, shape, x, y, w: shape === 'rect' ? 220 : shape === 'round' ? 110 : 140, h: shape === 'round' ? 110 : 140, status: 'available', orderId: null, guests: 0, openedAt: null, note: '' },
      `table ${label}`,
    );
  }

  console.log('[seed] staff logins');
  const created = [];
  for (const [username, name, role, station] of STAFF) {
    const email = `${username}@${DOMAIN}`;
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`  - ${email} exists, PIN unchanged`);
    } catch {
      const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
      user = await auth.createUser({ email, password: pin, displayName: name });
      created.push({ name, role, email, pin });
      console.log(`  + ${email}`);
    }
    await db.doc(`staff/${user.uid}`).set({ name, role, email, active: true, station }, { merge: true });
  }

  console.log('\n[seed] DONE');
  if (created.length) {
    console.log('\nNEW STAFF PINs — shown only now. Write them down, then share each PIN privately:\n');
    console.table(created.map(({ name, role, pin }) => ({ name, role, pin })));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
