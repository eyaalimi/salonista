import { stat } from "node:fs/promises";

const BACKUP_ROOT = process.env.BACKUP_ROOT || "/home/ubuntu/backups";

export type BackupStatus = {
  lastBackupAt: Date | null;
  s3Configured: boolean;
  lastS3Error: Date | null;
};

async function mtime(path: string): Promise<Date | null> {
  try {
    const s = await stat(path);
    return s.mtime;
  } catch {
    return null;
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
