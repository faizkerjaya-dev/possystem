import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNow } from '@/hooks/useNow';
import { useOnline, usePrinterStatus } from '@/hooks/useDeviceStatus';
import { ROLE_LABEL } from '@/config/permissions';
import { signOut } from '@/services/auth';
import { hhmm } from '@/lib/time';

function Dot({ ok }: { ok: boolean }) {
  return <span className={`h-2 w-2 rounded-full ${ok ? 'bg-ok' : 'bg-danger'}`} />;
}

/** Thin status bar on every POS / back-office screen: context on the left, device status on the right. */
export function TopBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  const { staff } = useAuth();
  const now = useNow(15_000);
  const online = useOnline();
  const printer = usePrinterStatus();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-white pl-4 pr-3">
      <div className="flex min-w-0 items-center gap-3">{children}</div>
      <div className="flex shrink-0 items-center gap-3 text-[13px] text-soft">
        {right}
        <span className="hidden items-center gap-1.5 md:flex" title={printer.label}>
          <Dot ok={printer.printerOnline} />
          {printer.label}
        </span>
        <span className="flex items-center gap-1.5">
          <Dot ok={online} />
          {online ? 'Online' : 'Offline'}
        </span>
        <span className="text-[17px] font-bold tabular-nums text-ink">{hhmm(now)}</span>
        {staff && (
          <button
            type="button"
            onClick={() => signOut()}
            title="Sign out"
            className="flex h-10 items-center gap-2 rounded-full bg-[#F1EEE8] px-3 font-semibold text-ink"
          >
            {staff.name} · {ROLE_LABEL[staff.role]}
            <LogOut size={16} aria-hidden />
          </button>
        )}
      </div>
    </header>
  );
}
