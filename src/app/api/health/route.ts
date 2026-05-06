// Lightweight liveness endpoint used by the offline connectivity probe.
// No auth, no DB query — should respond in single-digit milliseconds.

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, time: new Date().toISOString() });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
