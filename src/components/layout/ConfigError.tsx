/** Shown when Firebase env vars are missing (usually: not added in Vercel › Settings › Environment Variables). */
export function ConfigError({ missing }: { missing: string[] }) {
  return (
    <div role="alert" className="flex h-dvh flex-col items-center justify-center gap-4 bg-cream p-6 text-center text-ink">
      <span className="text-2xl font-extrabold">[CONFIG_MISSING] Firebase is not configured</span>
      <span className="max-w-lg text-muted">
        Add these environment variables (local: <code>.env.local</code>, Vercel: Project › Settings › Environment Variables), then
        redeploy:
      </span>
      <ul className="rounded-xl bg-white p-4 text-left font-mono text-sm">
        {missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
