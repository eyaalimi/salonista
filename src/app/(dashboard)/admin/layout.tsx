import { readBackupStatus } from "@/lib/backup-status";

async function BackupBanner() {
  const status = await readBackupStatus();
  const now = Date.now();
  const STALE_MS = 36 * 60 * 60 * 1000;

  const stale =
    !status.lastBackupAt ||
    now - status.lastBackupAt.getTime() > STALE_MS;
  const s3Failed =
    status.lastS3Error &&
    status.lastBackupAt &&
    status.lastS3Error > status.lastBackupAt;
  const noS3 = !status.s3Configured;

  if (stale) {
    return (
      <div className="bg-red-50 border-b border-red-300 px-6 py-3 text-sm text-red-900">
        ⚠️ Sauvegardes manquantes ou anciennes — vérifier <code>backup.sh</code>.
      </div>
    );
  }
  if (s3Failed) {
    return (
      <div className="bg-amber-50 border-b border-amber-300 px-6 py-3 text-sm text-amber-900">
        ⚠️ Dernière synchro S3 en échec — voir <code>backup.log</code>.
      </div>
    );
  }
  if (noS3) {
    return (
      <div className="bg-amber-50 border-b border-amber-300 px-6 py-3 text-sm text-amber-900">
        ⚠️ Sauvegardes locales uniquement — pas d&apos;offsite configuré. Voir <code>scripts/deploy/README.md</code>.
      </div>
    );
  }
  return null;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackupBanner />
      {children}
    </>
  );
}
