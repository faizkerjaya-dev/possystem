import { firebaseEnv, projectIdLooksWrong } from '@/config/env';

/**
 * Small diagnostic line: which Firebase project this build talks to.
 * If it is not the project you expect, fix VITE_FIREBASE_* in Vercel and redeploy.
 */
export function ConnectionInfo({ dark = true }: { dark?: boolean }) {
  return (
    <p className={`text-center text-xs ${dark ? 'text-[#8E8A82]' : 'text-muted'}`}>
      Firebase project: <code className="font-mono">{JSON.stringify(firebaseEnv.projectId ?? '')}</code>
      {projectIdLooksWrong && (
        <span className="mt-1 block font-bold text-[#F19A9A]">
          [PROJECT_ID_INVALID] Nilai VITE_FIREBASE_PROJECT_ID kelihatan salah. Betulkan di Vercel › Settings › Environment Variables, kemudian
          Redeploy.
        </span>
      )}
    </p>
  );
}
