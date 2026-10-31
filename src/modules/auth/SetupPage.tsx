import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Store } from 'lucide-react';
import { COL } from '@/config/collections';
import { colRef } from '@/services/db';
import { PIN_LENGTH } from '@/services/auth';
import { runFirstTimeSetup } from '@/services/setup';
import { useLiveQuery } from '@/hooks/useLive';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { ConnectionInfo } from '@/components/layout/ConnectionInfo';
import type { Staff } from '@/types/models';

/**
 * Shown once, when the database has no staff yet. Creates the owner (and optionally a developer admin),
 * sample menu/tables and the shop settings — all from the browser.
 */
export function SetupPage() {
  const navigate = useNavigate();
  const staff = useLiveQuery<Staff>(() => colRef(COL.staff), []);
  const { staff: me } = useAuth();
  const shop = useSettings();
  // Signed-in owner/admin whose setup stopped half-way → continue without creating the owner again
  const resumeAs = me && (me.role === 'owner' || me.role === 'admin') && shop.loaded && !shop.exists ? me : null;
  const [f, setF] = useState({
    businessName: '',
    ownerName: '',
    ownerUsername: '',
    ownerPin: '',
    ownerPin2: '',
    withDev: true,
    devName: 'Developer',
    devUsername: 'dev',
    devPin: '',
    sampleData: true,
  });
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((cur) => ({ ...cur, ...patch }));
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_LENGTH);

  const pinMismatch = f.ownerPin2.length === PIN_LENGTH && f.ownerPin !== f.ownerPin2;
  const ownerOk = resumeAs || (f.ownerName.trim() && f.ownerUsername.trim() && f.ownerPin.length === PIN_LENGTH && f.ownerPin === f.ownerPin2);
  const ready =
    f.businessName.trim() &&
    ownerOk &&
    (!f.withDev || (f.devName.trim() && f.devUsername.trim() && f.devPin.length === PIN_LENGTH && f.devUsername !== f.ownerUsername));
  // Setup already done → send to login / home (but never interrupt our own run)
  const alreadyDone = me ? shop.loaded && shop.exists : !staff.loading && staff.data.length > 0;
  if (!running && steps.length === 0 && alreadyDone) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-kds p-6 text-center text-cream">
        <span className="text-2xl font-extrabold">Setup sudah dibuat</span>
        <Link to={me ? '/' : '/login'} className="flex h-14 items-center rounded-2xl bg-accent px-6 font-bold text-white">
          {me ? 'Buka sistem' : 'Pergi ke login'}
        </Link>
      </div>
    );
  }

  const start = async () => {
    setRunning(true);
    setError(null);
    setSteps([]);
    try {
      await runFirstTimeSetup(
        {
          businessName: f.businessName,
          ownerName: f.ownerName,
          ownerUsername: f.ownerUsername,
          ownerPin: f.ownerPin,
          developer: f.withDev ? { name: f.devName.trim(), username: f.devUsername, pin: f.devPin } : null,
          sampleData: f.sampleData,
          resumeAs,
        },
        (s) => setSteps((cur) => [...cur, s]),
      );
      setSteps((cur) => [...cur, 'Siap!']);
      setTimeout(() => navigate('/', { replace: true }), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRunning(false);
    }
  };

  const input = 'h-12 w-full rounded-xl border border-[#3A3C41] bg-[#1C1D1F] px-3 text-[15px] font-semibold text-cream outline-none focus:border-[#E39A74]';
  const label = 'flex flex-col gap-1.5 text-xs font-bold text-[#B5B1A8]';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-kds p-4 text-cream">
      <div className="flex w-full max-w-xl flex-col gap-5 rounded-3xl bg-rail p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
            <Store size={24} className="text-white" aria-hidden />
          </span>
          <span className="flex flex-col">
            <span className="text-2xl font-extrabold">Setup kali pertama</span>
            <span className="text-sm text-[#B5B1A8]">Sekali sahaja. Semua boleh diubah kemudian dalam Settings.</span>
          </span>
        </div>

        <fieldset disabled={running} className="flex flex-col gap-4">
          <label className={label}>
            Nama kedai
            <input className={input} value={f.businessName} onChange={(e) => set({ businessName: e.target.value })} placeholder="Western House" />
          </label>

          {resumeAs ? (
            <p className="rounded-2xl border border-[#2E3034] p-4 text-sm">
              Anda login sebagai <strong>{resumeAs.name}</strong>. Setup tadi belum selesai, jadi kita teruskan sahaja.
            </p>
          ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-[#2E3034] p-4">
            <span className="text-sm font-extrabold">Owner (pemilik kedai)</span>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Nama
                <input
                  className={input}
                  value={f.ownerName}
                  onChange={(e) =>
                    set({ ownerName: e.target.value, ownerUsername: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) })
                  }
                  placeholder="Encik Ali"
                />
              </label>
              <label className={label}>
                Username
                <input className={input} value={f.ownerUsername} onChange={(e) => set({ ownerUsername: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} />
              </label>
              <label className={label}>
                PIN ({PIN_LENGTH} digit)
                <input className={input} type="password" inputMode="numeric" value={f.ownerPin} onChange={(e) => set({ ownerPin: digits(e.target.value) })} />
              </label>
              <label className={label}>
                Ulang PIN
                <input className={input} type="password" inputMode="numeric" value={f.ownerPin2} onChange={(e) => set({ ownerPin2: digits(e.target.value) })} />
              </label>
            </div>
            {pinMismatch && <span className="text-sm font-semibold text-[#F19A9A]">PIN tidak sama.</span>}
          </div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border border-[#2E3034] p-4">
            <label className="flex items-center gap-3 text-sm font-extrabold">
              <input type="checkbox" className="h-5 w-5" checked={f.withDev} onChange={(e) => set({ withDev: e.target.checked })} />
              Cipta akaun Developer (admin) untuk saya
            </label>
            {f.withDev && (
              <div className="grid grid-cols-3 gap-3">
                <label className={label}>
                  Nama
                  <input className={input} value={f.devName} onChange={(e) => set({ devName: e.target.value })} />
                </label>
                <label className={label}>
                  Username
                  <input className={input} value={f.devUsername} onChange={(e) => set({ devUsername: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} />
                </label>
                <label className={label}>
                  PIN
                  <input className={input} type="password" inputMode="numeric" value={f.devPin} onChange={(e) => set({ devPin: digits(e.target.value) })} />
                </label>
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5" checked={f.sampleData} onChange={(e) => set({ sampleData: e.target.checked })} />
            Masukkan menu contoh (25 item) dan meja T01–T12
          </label>
        </fieldset>

        {steps.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-2xl bg-[#26282B] p-4 text-sm">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#48BB78]" aria-hidden /> {s}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-danger p-4 text-sm font-semibold leading-relaxed text-white">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!ready || running}
          onClick={start}
          className="h-16 rounded-2xl bg-accent text-lg font-extrabold text-white disabled:bg-[#3A3C41] disabled:text-[#8E8A82]"
        >
          {running ? 'Sedang menyediakan…' : 'Mula guna sistem'}
        </button>
        <p className="text-center text-xs text-[#8E8A82]">Ingat PIN anda. Staf lain boleh ditambah kemudian di Settings › Staff &amp; roles.</p>
        <ConnectionInfo />
      </div>
    </div>
  );
}
