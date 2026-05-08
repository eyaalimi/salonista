import { NextRequest } from "next/server";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { getWalletForPos } from "@/lib/rewards/wallet";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ customerId: string }> }) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { customerId } = await ctx.params;
  const bundle = await getWalletForPos(employee.providerId, customerId);
  if (!bundle) return Response.json(null);
  return Response.json(bundle);
}
