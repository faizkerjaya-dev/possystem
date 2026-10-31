import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { query, where } from 'firebase/firestore';
import { Delete, Lock } from 'lucide-react';
import { COL } from '@/config/collections';
import { ROLE_LABEL } from '@/config/permissions';
import { colRef } from '@/services/db';
import { PIN_LENGTH, signInWithPin } from '@/services/auth';
import { useLiveQuery } from '@/hooks/useLive';
import { useAuth } from '@/hooks/useAuth';
import { describeError } from '@/lib/errors';
import type { Staff } from '@/types/models';

/**
 * Shared-device login: tap your name, enter your 6-digit PIN.
 * The staff list is readable without login (names + roles only) — see firestore.rules.
 */
export function LoginPage() {
  const { staff: me, loading } = useAuth();
  const navigate = useNavigate();
  const staff = useLiveQuery<Staff>(() => query(colRef(COL.staff), where('active', '==', true)), []);
  const [picked, setPicked] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !picked || busy) return;
    setBusy(true);
    setError(null);
    signInWithPin(picked.email, pin)
      .then(() => navigate('/', { replace: true }))
      .catch((err) => {
        const e = describeError(err);
        setError(`[${e.code}] ${e.message}`);
        setPin('');
      })
      .finally(() => setBusy(false));
  }, [pin, picked, busy, navigate]);

  if (!loading && me) return <Navigate to="/" replace />;

  const press = (k: string) => {
    setError(null);
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else if (k === 'clr') setPin('');
    else setPin((p) => (p.length < PIN_LENGTH ? p + k : p));
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-kds p-6 text-cream lg:flex-row lg:gap-16">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <Lock className="text-white" size={26} aria-hidden />
        </span>
        <h1 className="text-3xl font-extrabold">Who is using this device?</h1>
        {staff.error && <p className="rounded-xl bg-danger p-3 text-sm font-semibold">{staff.error}</p>}
        {!staff.loading && staff.data.length === 0 && !staff.error && (
          <p className="rounded-xl bg-[#2B2D31] p-3 text-sm">
            No staff found. Run the seed script first (docs/DEPLOY.md, step 5).
          </p>
        )}
        <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
          {staff.data.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={picked?.id === s.id}
              onClick={() => {
                setPicked(s);
                setPin('');
                setError(null);
              }}
              className={`flex h-16 items-center gap-3 rounded-2xl px-3 text-left ${
                picked?.id === s.id ? 'border-2 border-[#E39A74] bg-[#2B2D31]' : 'border border-[#3A3C41]'
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-sm font-extrabold text-ink">
                {s.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex flex-col">
                <span className="font-bold">{s.name}</span>
                <span className="text-xs text-[#B5B1A8]">{ROLE_LABEL[s.role]}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-3xl bg-rail p-6">
        <span className="text-sm font-semibold text-[#B5B1A8]">{picked ? `PIN for ${picked.name}` : 'Choose your name first'}</span>
        <div aria-label={`${pin.length} of ${PIN_LENGTH} digits`} className="flex gap-3">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 border-[#8E8A82] ${i < pin.length ? 'bg-cream' : ''}`} />
          ))}
        </div>
        {error && <span role="alert" className="text-center text-sm font-semibold text-[#F19A9A]">{error}</span>}
        <div className="grid w-full grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map((k) => (
            <button
              key={k}
              type="button"
              disabled={!picked || busy}
              onClick={() => press(k)}
              aria-label={k === 'del' ? 'Delete' : k === 'clr' ? 'Clear' : k}
              className="flex h-16 items-center justify-center rounded-2xl bg-[#2B2D31] text-2xl font-semibold disabled:opacity-40"
            >
              {k === 'del' ? <Delete size={22} aria-hidden /> : k === 'clr' ? 'C' : k}
            </button>
          ))}
        </div>
        {busy && <span className="text-sm text-[#B5B1A8]">Signing in…</span>}
      </div>
    </div>
  );
}
