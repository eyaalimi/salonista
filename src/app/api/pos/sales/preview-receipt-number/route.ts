import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";

/**
 * Show the cashier the *next-expected* receipt number for today, while a
 * cart is being assembled (DRAFT). Read-only — does NOT increment the
 * SaleSequence counter; the actual receipt number is allocated atomically
 * inside the sale-creation transaction.
 *
 * Format: S-YYYYMMDD-NNNN
 */
export async function GET() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seq = await prisma.saleSequence.findUnique({
    where: { providerId_date: { providerId: employee.providerId, date: today } },
    select: { counter: true },
  });
  const next = (seq?.counter ?? 0) + 1;
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const nn = String(next).padStart(4, "0");
  return Response.json({ receiptNumber: `S-${yyyy}${mm}${dd}-${nn}` });
}
