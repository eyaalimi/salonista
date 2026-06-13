import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("pos.refund");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;

  try {
    await prisma.$transaction(async (tx) => {
      const exp = await (tx as never as {
        cashDrawerExpense: {
          findUnique: (a: unknown) => Promise<
            | { cashDrawerSession: { providerId: string; status: string } }
            | null
          >;
        };
      }).cashDrawerExpense.findUnique({
        where: { id },
        include: {
          cashDrawerSession: { select: { providerId: true, status: true } },
        },
      });
      if (!exp) throw new Error("NOT_FOUND");
      if (exp.cashDrawerSession.providerId !== employee.providerId) throw new Error("FORBIDDEN");
      if (exp.cashDrawerSession.status !== "OPEN") throw new Error("CLOSED");
      await (tx as never as {
        cashDrawerExpense: { delete: (a: unknown) => Promise<unknown> };
      }).cashDrawerExpense.delete({ where: { id } });
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND") return Response.json({ error: "Dépense introuvable" }, { status: 404 });
    if (msg === "FORBIDDEN") return Response.json({ error: "Interdit" }, { status: 403 });
    if (msg === "CLOSED") return Response.json({ error: "Session fermée" }, { status: 409 });
    throw err;
  }
}
