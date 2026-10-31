import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth } from '@/config/firebase';
import { COL } from '@/config/collections';
import { docRef } from '@/services/db';
import type { Staff } from '@/types/models';
import { log } from '@/lib/logger';

interface AuthState {
  user: User | null;
  staff: Staff | null; // profile from staff/{uid}; null if signed out or missing
  loading: boolean;
  problem: string | null; // e.g. signed in but no staff profile
}

const AuthContext = createContext<AuthState>({ user: null, staff: null, loading: true, problem: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, staff: null, loading: true, problem: null });

  useEffect(() => {
    let stopStaff: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopStaff?.();
      if (!user) {
        setState({ user: null, staff: null, loading: false, problem: null });
        return;
      }
      stopStaff = onSnapshot(
        docRef(COL.staff, user.uid),
        (snap) => {
          if (!snap.exists()) {
            log.warn('auth', 'signed in but staff profile missing', user.uid);
            setState({ user, staff: null, loading: false, problem: `No staff profile for uid ${user.uid}` });
            return;
          }
          const staff = { id: snap.id, ...snap.data() } as Staff;
          setState({
            user,
            staff: staff.active ? staff : null,
            loading: false,
            problem: staff.active ? null : 'STAFF_INACTIVE',
          });
        },
        (err) => {
          log.error('auth', 'staff profile read failed', err);
          setState({ user, staff: null, loading: false, problem: err.message });
        },
      );
    });
    return () => {
      stopStaff?.();
      stopAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** For screens behind RequireRole — staff is guaranteed to exist there. */
export function useStaff(): Staff {
  const { staff } = useAuth();
  if (!staff) throw new Error('useStaff used outside a signed-in route');
  return staff;
}
