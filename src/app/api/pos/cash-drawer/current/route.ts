import { requireEmployee, toResponse } from "@/lib/employee-session";
import { findOpenSession, computeSummary } from "@/lib/cash-drawer";

export async function GET() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const session = await findOpenSession(employee.id);
  if (!session) return Response.json({ session: null });
  const summary = await computeSummary(session.id);
  return Response.json({ session, summary });
}
