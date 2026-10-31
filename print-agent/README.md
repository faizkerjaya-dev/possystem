# Print agent (counter PC)

Program kecil yang berjalan di **satu komputer di kaunter** (Windows / Mac / Linux / mini PC). Ia mengambil kerja cetak dari Firestore satu demi satu dan menghantarnya ke printer thermal 80mm melalui LAN.

Tablet, telefon dan KDS **tidak** bercakap terus dengan printer. Mereka cuma buat dokumen dalam `printJobs`; agent ini yang mencetak.

## Keperluan

- Node.js 18 atau lebih baru (https://nodejs.org)
- Printer ESC/POS dengan port LAN (raw TCP 9100). Tetapkan **IP tetap** untuk printer di router (DHCP reservation).
- Komputer ini dan printer dalam rangkaian yang sama.
- Fail `service-account.json` (Firebase console › Project settings › Service accounts › Generate new private key). **Jangan kongsi / commit fail ini.**

## Pasang

```bash
cd print-agent
npm install
cp .env.example .env        # Windows: copy .env.example .env
# edit .env: PRINTER_HOST=192.168.x.x, GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
npm run test-print          # cetak satu halaman ujian terus ke printer
npm start                   # mula dengar kerja cetak
```

## Jalan automatik bila komputer hidup

Cara paling mudah (semua OS): guna **pm2**

```bash
npm install -g pm2
pm2 start index.js --name pos-print-agent
pm2 save
pm2 startup        # ikut arahan yang dipaparkan
pm2 logs pos-print-agent   # lihat log
```

Windows: jika `pm2 startup` tidak disokong, guna `pm2-installer` atau Task Scheduler (trigger: At log on, action: `node C:\path\print-agent\index.js`).

## Status kerja cetak

| Status | Maksud | Apa perlu buat |
|---|---|---|
| `pending` | Menunggu giliran | — |
| `printing` | Sedang dihantar | — |
| `printed` | Berjaya dihantar ke printer | — |
| `failed` | Tak dapat sambung ke printer. **Tiada apa dicetak.** Dicuba semula automatik `AUTO_RETRY_LIMIT` kali | Semak printer hidup / kabel LAN / IP, kemudian tekan **Retry** di halaman Printer |
| `uncertain` | Sambungan terputus semasa menghantar — mungkin sudah tercetak | Lihat printer. Jika slip keluar tekan **It printed**, jika tidak tekan **Reprint** (admin) |

Agent **tidak pernah** cetak semula `uncertain` sendiri, supaya dapur tak masak dua kali.

## Log

Setiap baris log bermula dengan masa dan `[agent]`. Contoh:

```
2026-10-30T12:52:01.000Z [agent][info] printing kot ORD-1005 (3 page)
2026-10-30T12:52:02.000Z [agent][info] printed kot ORD-1005 (3 page)
```

Masalah biasa: lihat `docs/TROUBLESHOOTING.md` (bahagian Printer).
