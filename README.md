# Restaurant POS — template

POS restoran lengkap untuk **satu kedai**: tablet juruwang, telefon pelayan, skrin dapur (KDS) setiap station, back office, dan satu printer thermal di kaunter. Semua nama kedai, menu, harga, add-on, cukai, resit dan label KOT diubah oleh admin dalam aplikasi — tiada yang perlu ditukar dalam kod.

**Stack:** React 18 · Vite · TypeScript · Tailwind · Firebase (Auth + Firestore, pelan Spark percuma) · Vercel · print agent Node.js (ESC/POS LAN)

## Skrin

| URL | Peranti | Siapa |
|---|---|---|
| `/login` | semua | pilih nama + PIN 6 digit |
| `/pos` | tablet kaunter | juruwang, admin — pelan lantai, cek |
| `/pos/new`, `/pos/order/:id` | tablet kaunter | ambil order, add-on |
| `/pos/pay/:id` | tablet kaunter | bayaran, split, diskaun, resit |
| `/pos/checks` | tablet kaunter | semua bil belum bayar |
| `/m` | telefon pelayan | meja, order, hantar ke dapur |
| `/kds/A`, `/kds/B` | tablet dapur | tiket station |
| `/admin` | tablet / PC | overview hari ini |
| `/admin/printer` | tablet / PC | status printer, queue, cetak semula, PDF |
| `/admin/menu`, `/admin/modifiers`, `/admin/settings` | tablet / PC | **admin sahaja** |

## Mula cepat (local)

```bash
npm install
cp .env.example .env.local     # isi nilai Firebase
npm run dev                    # http://localhost:5173
npm run check                  # semak TypeScript + unit test
```

Deploy penuh ke Firebase + GitHub + Vercel: **[docs/DEPLOY.md](docs/DEPLOY.md)** (langkah demi langkah).

## Dokumen

| Fail | Isi |
|---|---|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Setup Firebase, seed data, GitHub, Vercel, print agent, peranti |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Struktur folder, aliran data, koleksi Firestore, cara tambah ciri |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Senarai kod ralat `[KOD]` dan cara betulkan |
| [print-agent/README.md](print-agent/README.md) | Pasang agent cetak di PC kaunter |

## Peraturan kod (ringkas)

1. Wang sentiasa **integer sen** (`2290` = RM 22.90). Tukar hanya melalui `src/lib/money.ts`.
2. Semua **tulis** ke Firestore ada dalam `src/services/*`. Skrin tidak tulis terus.
3. Kiraan bil hanya dalam `src/lib/pricing.ts` (ada unit test).
4. Kandungan KOT/resit hanya dalam `src/lib/printLayout.ts` — sama untuk skrin, PDF dan printer.
5. Setiap ralat dipapar sebagai `[KOD] mesej`. Cari kod itu dalam `docs/TROUBLESHOOTING.md`.
6. Kebenaran ikut peranan: `src/config/permissions.ts` (UI) **dan** `firestore.rules` (sebenar). Ubah kedua-duanya bersama.
