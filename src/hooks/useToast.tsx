import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { describeError } from '@/lib/errors';
import { log } from '@/lib/logger';

type Tone = 'ok' | 'error' | 'info';
interface Toast {
  id: number;
  tone: Tone;
  text: string;
}
interface ToastApi {
  ok: (text: string) => void;
  info: (text: string) => void;
  /** Shows "[CODE] message" — look the code up in docs/TROUBLESHOOTING.md */
  error: (err: unknown, scope?: string) => void;
}

const ToastContext = createContext<ToastApi>({ ok: () => {}, info: () => {}, error: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Tone, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 8000 : 4000);
  }, []);
  const api: ToastApi = {
    ok: (text) => push('ok', text),
    info: (text) => push('info', text),
    error: (err, scope = 'ui') => {
      log.error(scope, 'action failed', err);
      const e = describeError(err);
      push('error', `[${e.code}] ${e.message}`);
    },
  };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(560px,92vw)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
              t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'ok' ? 'bg-ok text-white' : 'bg-ink text-white'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
