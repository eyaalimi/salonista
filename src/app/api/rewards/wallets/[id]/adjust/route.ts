import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { requireModule } from "@/lib/modules";
import { adjustWallet, AdjustmentError } from "@/lib/rewards/adjust";

type Body = { delta: number; note: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("rewards.adjust");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "REWARDS");
  } catch {
    return Response.json({ error: "Module Fidélité non activé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: "Corps invalide" }, { status: 400 });

  // Confirm wallet belongs to this salon.
  const wallet = await prisma.rewardWallet.findUnique({
    where: { id },
    select: { providerId: true },
  });
  if (!wallet || wallet.providerId !== employee.providerId) {
    return Response.json({ error: "Portefeuille introuvable" }, { status: 404 });
  }

  try {
    const txn = await adjustWallet(id, body.delta, employee.id, body.note);
    return Response.json(
      {
        id: txn.id,
        delta: txn.delta,
        balanceAfter: txn.balanceAfter,
        reason: txn.reason,
        createdAt: txn.createdAt,
        note: txn.note,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AdjustmentError) {
      return Response.json({ error: err.message, code: err.code }, { status: 422 });
    }
    throw err;
  }
}
