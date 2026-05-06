import type { Prisma } from "@/generated/prisma/client";

type Tx = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use"
>;

/**
 * Generate the next receipt number for a salon and date inside an existing
 * Prisma transaction.
 *
 * Atomicity: the underlying `SaleSequence` row is unique per `(providerId,
 * date)` and we use Postgres `UPDATE ... RETURNING` semantics via
 * Prisma `upsert` + `update` chain. Two concurrent transactions targeting the
 * same (provider, date) take row-level locks and get sequential counters.
 *
 * Format: `S-YYYYMMDD-NNNN`. NNNN is zero-padded to 4 digits; sequences resume
 * the next day from 1.
 */
export async function nextReceiptNumber(
  tx: Tx,
  providerId: string,
  date: Date,
): Promise<string> {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  await tx.saleSequence.upsert({
    where: { providerId_date: { providerId, date: day } },
    create: { providerId, date: day, counter: 0 },
    update: {},
  });

  const updated = await tx.saleSequence.update({
    where: { providerId_date: { providerId, date: day } },
    data: { counter: { increment: 1 } },
    select: { counter: true },
  });

  const yyyy = day.getUTCFullYear();
  const mm = String(day.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(day.getUTCDate()).padStart(2, "0");
  const nnnn = String(updated.counter).padStart(4, "0");
  return `S-${yyyy}${mm}${dd}-${nnnn}`;
}
