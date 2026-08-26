import { BACKUP_STALE_MS, readBackupStatus } from "@/lib/backup-status";

// The banner is rendered inside the parent dashboard's <main> content area
// (padding: p-6 md:p-10). To look intentional there we render it as a
// rounded card pinned to the top of the page, not a full-bleed stripe.
// Reading status via fs.stat surfaces an admin-page error if the backup
// directory is unreadable — that is intentional: silent misreporting of
// "stale" because of EACCES would waste real debugging time.
async function BackupBanner() {
  let status;
  try {
    status = await readBackupStatus();
  } catch {
    return (
      <div
        role="alert"
        className="mb-6 rounded-2xl border border-rose/50 bg-rose-soft px-4 py-3 text-sm text-prune"
      >
        ⚠️ Impossible de lire l&apos;état des sauvegardes — vérifier les
        permissions de <code>/home/ubuntu/backups</code>.
      </div>
    );
  }

  const now = Date.now();
  const stale =
    !status.lastBackupAt ||
    now - status.lastBackupAt.getTime() > BACKUP_STALE_MS;
  const s3Failed =
    status.lastS3Error &&
    status.lastBackupAt &&
    status.lastS3Error > status.lastBackupAt;
  const noS3 = !status.s3Configured;

  if (stale) {
    return (
      <div
        role="alert"
        className="mb-6 rounded-2xl border border-rose/50 bg-rose-soft px-4 py-3 text-sm text-prune"
      >
        ⚠️ Sauvegardes manquantes ou anciennes — vérifier <code>backup.sh</code>.
      </div>
    );
  }
  if (s3Failed) {
    return (
      <div
        role="alert"
        className="mb-6 rounded-2xl border border-hairline bg-creme px-4 py-3 text-sm text-prune"
      >
        ⚠️ Dernière synchro S3 en échec — voir <code>backup.log</code>.
      </div>
    );
  }
  if (noS3) {
    return (
      <div
        role="status"
        className="mb-6 rounded-2xl border border-hairline bg-creme px-4 py-3 text-sm text-prune"
      >
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
