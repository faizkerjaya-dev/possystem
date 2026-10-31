import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { can, type Permission } from '@/config/permissions';
import { ScreenMessage } from '@/components/ui/controls';
import { Button } from '@/components/ui/Button';
import { signOut } from '@/services/auth';
import { ERROR_MESSAGES } from '@/lib/errors';
import { ConnectionInfo } from './ConnectionInfo';

/** Route guard: must be signed in, have a staff profile, and (optionally) a permission. */
export function RequireRole({ perm, children }: { perm?: Permission; children: ReactNode }) {
  const { user, staff, loading, problem } = useAuth();
  const { loaded, exists, error } = useSettings();
  const location = useLocation();

  if (loading) return <ScreenMessage title="Loading…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!staff)
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4">
        <ScreenMessage
          tone="error"
          title={problem === 'STAFF_INACTIVE' ? '[STAFF_INACTIVE]' : '[NO_STAFF_PROFILE]'}
          detail={problem === 'STAFF_INACTIVE' ? ERROR_MESSAGES.STAFF_INACTIVE : `${problem}. See docs/TROUBLESHOOTING.md.`}
        />
        <Button variant="dark" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  if (loaded && !exists)
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6">
        <ScreenMessage
          tone="error"
          title="[SETTINGS_MISSING]"
          detail={error ?? 'Setup kedai belum selesai. Owner/Admin boleh teruskan setup sekarang.'}
        />
        {(staff.role === 'owner' || staff.role === 'admin') && (
          <Link to="/setup" className="flex h-14 items-center rounded-xl bg-accent px-6 text-base font-extrabold text-white">
            Teruskan setup
          </Link>
        )}
        <Button onClick={() => signOut()}>Sign out</Button>
        <ConnectionInfo dark={false} />
      </div>
    );
  if (perm && !can(staff.role, perm))
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4">
        <ScreenMessage tone="error" title="[NOT_ALLOWED]" detail={ERROR_MESSAGES.NOT_ALLOWED} />
        <Button variant="dark" onClick={() => history.back()}>
          Go back
        </Button>
      </div>
    );
  return <>{children}</>;
}
