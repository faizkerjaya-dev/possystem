import type { ReactNode } from 'react';
import { Rail, POS_RAIL, ADMIN_RAIL } from './Rail';

/** Full-screen app frame: icon rail + content. No page scrolling — each panel scrolls on its own. */
export function Shell({ area, children }: { area: 'pos' | 'admin'; children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-cream text-ink">
      <Rail items={area === 'pos' ? POS_RAIL : ADMIN_RAIL} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
