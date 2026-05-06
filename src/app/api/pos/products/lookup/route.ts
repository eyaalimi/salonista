import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const barcode = req.nextUrl.searchParams.get("barcode");
  if (!barcode) {
    return Response.json({ error: "Code-barres requis" }, { status: 400 });
  }
  const product = await prisma.product.findFirst({
    where: { providerId: employee.providerId, barcode, active: true },
  });
  if (!product) return Response.json({ found: false });
  return Response.json({ found: true, product });
}
