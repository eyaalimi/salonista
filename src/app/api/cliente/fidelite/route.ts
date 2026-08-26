import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  const userId = session.user.id;
  const customer = await prisma.customer.findUnique({ where: { userId } });
  if (!customer) return Response.json({ wallets: [] });

  const wallets = await prisma.rewardWallet.findMany({
    where: { customerId: customer.id },
    orderBy: { lastActivityAt: "desc" },
    include: {
      provider: { select: { id: true, salonName: true, city: true, photos: true, logo: true } },
      program: { select: { dinarPerPoint: true } },
    },
  });

  return Response.json({
    wallets: wallets.map((w) => ({
      id: w.id,
      balance: w.balance,
      lastActivityAt: w.lastActivityAt,
      dinarPerPoint: w.program.dinarPerPoint.toString(),
      provider: {
        id: w.provider.id,
        salonName: w.provider.salonName,
        city: w.provider.city,
        // Le logo d'abord, la premiere photo ensuite : depuis que l'assistant
        // ecrit dans `logo`, un salon recent a un logo mais pas forcement
        // de photos.
        photo: w.provider.logo ?? w.provider.photos[0] ?? null,
      },
    })),
  });
}
