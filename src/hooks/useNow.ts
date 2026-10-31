import { useEffect, useState } from 'react';

/** Current time, refreshed every `everyMs` (default 1s). Used for clocks and kitchen timers. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
