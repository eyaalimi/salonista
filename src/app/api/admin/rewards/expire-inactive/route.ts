import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { expireInactiveWallets } from "@/lib/rewards/expiration";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }
  const url = new URL(req.url);
  const providerId = url.searchParams.get("providerId") ?? undefined;
  const result = await expireInactiveWallets(providerId);
  return Response.json(result);
}
