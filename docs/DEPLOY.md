# Deploy: Firebase + GitHub + Vercel

Ikut langkah mengikut turutan. Anggaran masa: 45–60 minit kali pertama.

Anda perlukan: akaun Google (Firebase), akaun GitHub, akaun Vercel (log masuk dengan GitHub), Node.js 18+ di komputer anda.

---

## 1. Buat projek Firebase (pelan Spark — percuma)

1. Buka https://console.firebase.google.com › **Add project** › beri nama (cth. `western-house-pos`). Google Analytics boleh dimatikan.
2. **Build › Authentication › Get started › Sign-in method › Email/Password › Enable › Save.**
3. **Build › Firestore Database › Create database**
   - Location: `asia-southeast1 (Singapore)` — paling dekat dengan Malaysia. **Tidak boleh ditukar kemudian.**
   - Mode: **Production mode**.
4. **Project settings (ikon gear) › General › Your apps › Web (`</>`)** › daftar app › salin nilai `firebaseConfig`. Anda perlukannya di langkah 7.

## 2. Pasang security rules dan index

Cara A — Firebase CLI (disyorkan, satu arahan):

```bash
npm install -g firebase-tools
firebase login
cd western-house-pos
firebase use --add            # pilih projek anda
firebase deploy --only firestore:rules,firestore:indexes
```

Cara B — tanpa CLI:
- **Firestore › Rules** › padam semua › tampal isi fail `firestore.rules` › **Publish**.
- Index: biarkan dahulu. Kali pertama skrin KDS / print agent memerlukan index, ralat akan memaparkan **pautan** — klik pautan itu dan tekan **Create index** (siap dalam 1–3 minit). Senarai index ada dalam `firestore.indexes.json`.

## 3. Kunci service account (untuk seed & print agent)

**Project settings › Service accounts › Generate new private key** › simpan sebagai `service-account.json` dalam folder projek.

> ⚠️ Fail ini = kunci penuh kepada pangkalan data. **Jangan** hantar melalui WhatsApp/e-mel dan **jangan** commit ke GitHub (`.gitignore` sudah menyekatnya).

## 4. Isi data permulaan (seed)

```bash
cd scripts
npm install
node seed.mjs --key ../service-account.json --domain staff.pos.local
```

Ia akan mencipta: tetapan kedai, kategori + menu contoh, kumpulan add-on, meja T01–T12, kaunter nombor order/resit, dan login staf (Owner, Adam, Sarah, Amir, Daniel, Aina).

**PIN 6 digit setiap staf dipaparkan sekali sahaja di hujung.** Salin dan beri kepada setiap orang. Selepas ini tambah staf baharu di **Admin › Settings › Staff & roles**.

`--domain` mesti sama dengan `VITE_STAFF_EMAIL_DOMAIN` (langkah 7).

## 5. Uji di komputer sendiri (pilihan tetapi disyorkan)

```bash
cd ..                         # kembali ke folder projek
npm install
cp .env.example .env.local    # isi nilai firebaseConfig
npm run dev
```

Buka http://localhost:5173 › pilih **Owner** › masukkan PIN.

## 6. Naik ke GitHub

1. https://github.com/new › nama repo (cth. `western-house-pos`) › **Private** › Create.
2. Dalam folder projek:

```bash
git init
git add .
git status                    # pastikan service-account.json dan .env.local TIADA dalam senarai
git commit -m "Initial POS"
git branch -M main
git remote add origin https://github.com/<username>/western-house-pos.git
git push -u origin main
```

## 7. Deploy ke Vercel

1. https://vercel.com/new › **Import** repo GitHub tadi.
2. Framework Preset: **Vite** (dikesan automatik). Build: `npm run build`. Output: `dist`.
3. **Environment Variables** — tambah semua (nilai dari langkah 1.4):

| Name | Contoh |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIza...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `western-house-pos.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `western-house-pos` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `western-house-pos.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1234567890` |
| `VITE_FIREBASE_APP_ID` | `1:1234567890:web:abc...` |
| `VITE_STAFF_EMAIL_DOMAIN` | `staff.pos.local` |

4. **Deploy.** Anda akan dapat URL seperti `https://western-house-pos.vercel.app`.

## 8. Benarkan domain Vercel dalam Firebase Auth

**Firebase › Authentication › Settings › Authorized domains › Add domain** › masukkan `western-house-pos.vercel.app` (dan domain sendiri jika ada). Tanpa langkah ini login akan gagal dengan `auth/unauthorized-domain`.

## 9. Pasang print agent di PC kaunter

Ikut [print-agent/README.md](../print-agent/README.md). Ringkasnya: salin folder `print-agent` + `service-account.json` ke PC kaunter, isi `.env` (IP printer), `npm install`, `npm run test-print`, `npm start`.

Selepas itu **Admin › Printer** patut tunjuk *Print agent: Online* dan *Printer: Reachable*.

## 10. Sediakan peranti

| Peranti | Buka | Log masuk |
|---|---|---|
| Tablet kaunter | `https://<domain>/pos` | Sarah (cashier) |
| Telefon pelayan | `https://<domain>/m` | Amir (waiter) |
| Tablet dapur A | `https://<domain>/kds/A` | Daniel (kitchen, station A) |
| Tablet dapur B | `https://<domain>/kds/B` | Aina (kitchen, station B) |
| Admin | `https://<domain>/admin` | Adam / Owner |

Pada setiap peranti: menu browser › **Add to Home Screen** supaya ia dibuka skrin penuh seperti app. Matikan auto-lock skrin pada tablet dapur.

## 11. Tukar kepada kedai anda

Log masuk sebagai Owner/Adam › **Settings**: nama kedai, alamat, no. SST, warna, cukai, label KOT, cara bayaran, station, meja. **Menu** dan **Add-ons**: padam item contoh, masukkan menu sebenar.

---

## Kemaskini selepas ini

- Ubah kod › `git commit` › `git push` › Vercel deploy automatik dalam ~1 minit.
- Jika versi baharu bermasalah: Vercel › Deployments › pilih deployment lama › **Promote to Production** (rollback serta-merta).
- Ubah `firestore.rules`? Jalankan `firebase deploy --only firestore:rules` atau tampal semula di console.

## Had pelan Spark (percuma)

- 50k bacaan / 20k tulisan / hari Firestore — cukup untuk kedai sederhana (~200–400 order sehari). Pantau di Firebase › Usage.
- Tiada Cloud Functions: jumlah bil dikira pada tablet juruwang **di dalam transaction** daripada order yang tersimpan, dan rules memastikan hanya cashier/admin boleh rekod bayaran, bayaran tidak boleh diubah/dipadam, dan setiap tindakan sensitif direkod dalam `auditLogs`. Jika mahu kiraan di server, naik ke pelan Blaze dan pindahkan `services/payments.ts` ke Cloud Function (lihat ARCHITECTURE.md › Upgrade path).
