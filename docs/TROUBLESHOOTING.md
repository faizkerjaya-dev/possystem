# Troubleshooting

Setiap ralat dalam app dipapar sebagai **`[KOD] mesej`**. Cari kod di bawah.
Untuk butiran lanjut: buka browser console (F12 / Safari › Develop) dan tapis `[POS]`.

## Kod ralat app

| Kod | Maksud | Betulkan |
|---|---|---|
| `CONFIG_MISSING` | Env `VITE_FIREBASE_*` kosong | Tambah di Vercel › Settings › Environment Variables, kemudian **Redeploy**. Local: `.env.local`, restart `npm run dev`. |
| `SETTINGS_MISSING` | Dokumen `settings/main` tiada | Jalankan seed (DEPLOY.md langkah 4). |
| `NO_STAFF_PROFILE` | Login Firebase wujud tetapi tiada `staff/{uid}` | Jalankan seed semula, atau cipta dokumen `staff/{uid}` (name, role, email, active: true). |
| `STAFF_INACTIVE` | Akaun dinyahaktifkan | Admin › Settings › Staff & roles › hidupkan suis. |
| `LOGIN_FAILED` | PIN salah | Cuba lagi. Lupa PIN: Firebase › Authentication › cari e-mel › *Reset password* (set 6 digit baharu), atau buat login baharu. |
| `NOT_ALLOWED` | Peranan tidak dibenarkan / ditolak oleh `firestore.rules` (`permission-denied`) | Semak peranan staf. Jika semua orang kena: rules belum dipublish atau lapuk — tampal semula `firestore.rules`. |
| `OFFLINE` | Tiada internet | Semak Wi-Fi. Data masih dipapar daripada cache, tetapi hantar order / bayaran perlukan sambungan. |
| `TABLE_BUSY` | Meja sudah ada order terbuka | Buka order sedia ada daripada pelan lantai. |
| `ORDER_NOT_FOUND` | Order tiada / masih dimuatkan | Tunggu sesaat dan cuba lagi; mungkin sudah dibayar/batal di peranti lain. |
| `ORDER_CLOSED` | Order sudah dibayar / dibatalkan | Cetak semula resit dari Admin › Printer. |
| `NOTHING_TO_SEND` | Tiada item baharu | — |
| `PAYMENT_SHORT` | Tunai diterima kurang dari jumlah | Masukkan jumlah tunai yang betul. |
| `failed-precondition` + pautan | **Index Firestore belum dicipta** | Klik pautan dalam ralat (console) › *Create index*, atau `firebase deploy --only firestore:indexes`. Tunggu 1–3 minit. |
| `auth/unauthorized-domain` | Domain Vercel belum dibenarkan | Firebase › Authentication › Settings › Authorized domains › tambah domain. |
| `auth/too-many-requests` | Terlalu banyak PIN salah | Tunggu beberapa minit. |

## Masalah biasa

**Skrin putih / "This screen crashed"** — ambil gambar mesej. Buka console, cari `[POS][crash]`. Biasanya data lama tidak lengkap; semak dokumen berkaitan di Firestore.

**Refresh halaman di Vercel beri 404** — `vercel.json` (rewrites) mesti ada dalam repo.

**Menu/tetapan tak berubah di peranti lain** — tekan *Save* / *Save changes*. Jika masih: peranti offline (titik merah "Offline" di bar atas).

**Login screen kosong ("No staff found")** — seed belum dijalankan, atau projek Firebase lain dalam env. Semak `VITE_FIREBASE_PROJECT_ID`.

**Nombor order bermula semula / bertindih** — jangan padam `counters/orders`. Nilai = nombor order terakhir.

**Jumlah bil berbeza dengan yang dijangka** — logik dalam `src/lib/pricing.ts`: SST dikira atas (subtotal − diskaun + caj perkhidmatan). Semak kadar di Settings › Tax & charges. Jalankan `npm test`.

## Printer

| Simptom | Semak |
|---|---|
| Admin › Printer: *No print agent* / *Print agent offline* | PC kaunter hidup? `pm2 logs pos-print-agent`. Mulakan semula: `pm2 restart pos-print-agent`. |
| *Printer: Not reachable* | Printer hidup, kabel LAN, IP betul dalam `print-agent/.env` (`PRINTER_HOST`). Cuba `ping <IP>`. Tetapkan IP tetap di router. |
| Kerja `WAITING` lama | Agent tidak berjalan atau index `printJobs (status, createdAt)` belum ada (log agent akan sebut). |
| Kerja `FAILED` | Tiada apa dicetak. Betulkan sambungan, tekan **Retry**. |
| Kerja `NEEDS CHECK` (uncertain) | Lihat printer. Keluar → **It printed**. Tidak → **Reprint** (admin). |
| Huruf pelik `?` | Printer hanya sokong ASCII; aksara khas ditukar automatik. |
| Kertas tidak dipotong | Printer tiada auto-cutter — koyak manual; tiada perubahan diperlukan. |
| Tulisan terlalu lebar (58mm) | Settings › Receipt › Paper width › 58 mm. |

## Bila perlu ubah kod

1. Cari kod ralat dalam `src/lib/errors.ts` → lihat di mana `new AppError('KOD')` dilempar (`grep -r "KOD" src`).
2. Log console bermula `[POS][scope]` memberitahu fail: `orders` → `services/orders.ts`, `payments` → `services/payments.ts`, `kitchen` → `services/kitchen.ts`, `composer` → `hooks/useOrderComposer.ts`.
3. Jalankan `npm run check` sebelum `git push`.
