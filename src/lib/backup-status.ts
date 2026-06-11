import { stat } from "node:fs/promises";

const BACKUP_ROOT = process.env.BACKUP_ROOT || "/home/ubuntu/backups";

/**
 * If the touchfile is older than this, the admin sees a red "backups
 * stale" banner. Tuned to the cron cadence (03:30 UTC daily) plus a
 * safety margin — anything older than 36 h means at least one nightly
 * run was skipped.
 */
export const BACKUP_STALE_MS = 36 * 60 * 60 * 1000;

export type BackupStatus = {
  lastBackupAt: Date | null;
  s3Configured: boolean;
  lastS3Error: Date | null;
};

/**
 * Returns the file's mtime, or null when the file is absent. Other I/O
 * errors (permissions, broken symlinks, etc.) are re-thrown so the caller
 * surfaces a real failure instead of silently misreporting "stale" because
 * the status file was unreadable.
 */
async function mtime(path: string): Promise<Date | null> {
  try {
    const s = await stat(path);
    return s.mtime;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function readBackupStatus(): Promise<BackupStatus> {
  const [lastBackupAt, lastS3Error] = await Promise.all([
    mtime(`${BACKUP_ROOT}/.last-backup`),
    mtime(`${BACKUP_ROOT}/.last-s3-error`),
  ]);
  return {
    lastBackupAt,
    s3Configured: !!process.env.BACKUP_S3_BUCKET,
    lastS3Error,
  };
}
