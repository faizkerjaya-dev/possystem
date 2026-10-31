import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Settings } from '@/types/models';
import { withDefaults } from '@/config/defaultSettings';
import { settingsRef } from '@/services/settings';
import { useLiveDoc } from './useLive';

interface SettingsState {
  settings: Settings;
  loaded: boolean; // false until the first snapshot arrives
  exists: boolean; // false = settings/main missing → run the seed script
  error: string | null;
}

const SettingsContext = createContext<SettingsState>({
  settings: withDefaults(undefined),
  loaded: false,
  exists: false,
  error: null,
});

/** One live listener on settings/main for the whole app. Also applies the brand accent colour. */
export function SettingsProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const doc = useLiveDoc<Settings & { id: string }>(() => (enabled ? settingsRef() : null), [enabled]);
  const value = useMemo<SettingsState>(
    () => ({
      settings: withDefaults(doc.data ?? undefined),
      loaded: !doc.loading,
      exists: !!doc.data,
      error: doc.error,
    }),
    [doc.data, doc.loading, doc.error],
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', value.settings.business.accent);
    document.title = `${value.settings.business.name} · POS`;
  }, [value.settings.business.accent, value.settings.business.name]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
