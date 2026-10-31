# Architecture

Panduan untuk sesiapa yang akan menyelenggara kod ini.

## Gambaran besar

```
 Tablet kaunter / telefon / KDS  ──(Firebase JS SDK, realtime)──►  Firestore  ◄──(Admin SDK)──  Print agent (PC kaunter)
          (React app di Vercel)                                     (Spark)                          │
                                                                                                    ▼  TCP 9100, ESC/POS
                                                                                              Printer thermal 80mm
```

- Tiada server sendiri. Vercel hanya hos fail statik.
- Semua peranti mendengar Firestore secara realtime (`onSnapshot`), jadi perubahan muncul di semua skrin dalam ~1 saat.
- Printer hanya disentuh oleh **print agent**. App web hanya mencipta dokumen `printJobs`.

## Struktur folder

```
src/
  main.tsx                 semak env → muatkan App
  App.tsx                  SEMUA route di satu tempat
  config/
    env.ts                 baca VITE_* env
    firebase.ts            initialise Firebase (satu tempat)
    collections.ts         nama koleksi Firestore
    permissions.ts         siapa boleh buat apa (UI) — selaras dengan firestore.rules
    defaultSettings.ts     nilai lalai tetapan + withDefaults()
  types/models.ts          semua jenis data (Order, Product, Payment, PrintJob, …)
  lib/                     fungsi tulen, tiada Firebase — mudah diuji
    money.ts               sen ↔ RM, pembundaran 5 sen
    pricing.ts (+ .test)   kiraan bil
    printLayout.ts         kandungan KOT / resit / test page
    pdf.ts                 simpan halaman sebagai PDF 80mm
    errors.ts              kod ralat [KOD] + mesej
    logger.ts              log console [POS][scope]
  services/                SEMUA tulisan ke Firestore
    orders.ts              hantar order baharu / add-on (transaction), void, bil
    kitchen.ts             status tiket KDS + status order
    payments.ts            sahkan bayaran (transaction) + kerja cetak resit
    printJobs.ts           test print, retry, reprint
    menu.ts, tables.ts, settings.ts, auth.ts, audit.ts
  hooks/                   useLiveQuery/useLiveDoc, useAuth, useSettings, useMenu,
                           useOrders, useOrderComposer (otak skrin order), useToast …
  components/              UI dikongsi (Button, controls, Modal, PaperPreview, layout/)
  modules/                 satu folder setiap kawasan
    auth/  pos/  handheld/  kitchen/  admin/ (settings/)
firestore.rules            keselamatan sebenar
firestore.indexes.json     index komposit
scripts/seed.mjs           data permulaan + login staf
print-agent/               program cetak untuk PC kaunter
```

**Peraturan:** skrin (`modules/*`) boleh *membaca* melalui `useLiveQuery` / `useLiveDoc`, tetapi *menulis* hanya melalui `services/*`.

## Koleksi Firestore

| Koleksi | Dokumen | Ditulis oleh |
|---|---|---|
| `settings/main` | tetapan kedai (lihat `Settings` dalam models.ts) | admin |
| `staff/{uid}` | nama, peranan, station, aktif | admin, seed |
| `categories`, `products`, `modifierGroups` | menu | admin |
| `tables/{id}` | meja, status, kedudukan, `orderId` | staf (status), admin (layout) |
| `orders/{id}` | order + `lines[]` + `tickets{batch_station: status}` | staf |
| `tickets/{orderId_batch_station}` | apa yang dipapar di KDS | staf, dapur |
| `payments/{payKey}` | bayaran (tidak boleh diubah) | cashier/admin |
| `printJobs/{id}` | halaman untuk dicetak + status | app (cipta), agent (status) |
| `agents/{name}` | heartbeat print agent | agent |
| `counters/orders`, `counters/receipts` | nombor berjujukan | transaction |
| `auditLogs` | void, diskaun, cetak semula, tetapan | semua (tambah sahaja) |

Wang = integer sen. Masa = epoch milisaat (nombor).

## Aliran utama

### Hantar order (pelayan / juruwang)
`useOrderComposer.send()` → `services/orders.sendNewOrder()` **satu transaction**:
1. `orders/{requestId}` (id = kunci idempotency; tekan dua kali = tiada order kedua)
2. `tickets/{order}_1_A`, `..._1_B` — satu tiket setiap station yang ada item (tiada tiket kosong)
3. `printJobs/kot_{order}_1` — halaman KOT ikut `settings.printing.kotCopies` (cth. 3 salinan berlabel)
4. meja → `occupied`, `counters/orders` +1

Add-on (`sendAddon`): tambah baris dengan `batch = N`, tiket baharu, KOT **baris baharu sahaja**.

### Dapur
`services/kitchen.setTicketStatus()` (transaction) kemas kini tiket + `order.tickets`. `deriveOrderStatus()` menjadikan order `ready` **hanya bila semua station ready**.

### Bayaran
`services/payments.confirmPayment()` (transaction): kira semula bil daripada order tersimpan, cipta `payments/{payKey}`, kemas kini `paidCents/status`, nombor resit, dan `printJobs/rcpt_{payKey}` (1 salinan). Resit **hanya** dicipta di sini. Meja tidak dilepaskan automatik — juruwang tekan *Release* (→ `cleaning`) kemudian *Mark available*.

### Cetak
`print-agent/index.js` dengar `printJobs where status == pending orderBy createdAt` dan cetak satu demi satu. `failed` (tak sambung) dicuba semula automatik; `uncertain` (putus semasa hantar) **tidak** — staf tentukan.

## Cara tambah ciri

| Mahu… | Ubah |
|---|---|
| Medan baharu pada item menu | `types/models.ts` (Product) → `MenuAdminPage.tsx` (borang) → `scripts/seed.mjs` (pilihan) |
| Tetapan baharu | `types/models.ts` (Settings) → `defaultSettings.ts` → komponen dalam `settings/SettingsSections.tsx` → satu baris dalam `SECTIONS` di `SettingsPage.tsx` |
| Ubah rupa KOT/resit | `lib/printLayout.ts` sahaja |
| Ubah cara kira cukai | `lib/pricing.ts` + tambah ujian dalam `pricing.test.ts` |
| Skrin baharu | fail dalam `modules/…` → route dalam `App.tsx` → item rail dalam `components/layout/Rail.tsx` |
| Peranan / kebenaran | `config/permissions.ts` **dan** `firestore.rules` |
| Kod ralat baharu | `lib/errors.ts` **dan** `docs/TROUBLESHOOTING.md` |

## Upgrade path (pelan Blaze)

Untuk kiraan bil di server: cipta Cloud Function callable `confirmPayment` yang memanggil logik yang sama (`lib/pricing.ts`, `lib/printLayout.ts` boleh diimport terus), tukar `services/payments.ts` supaya memanggil function itu, dan dalam rules tetapkan `payments` `allow create: if false`.
