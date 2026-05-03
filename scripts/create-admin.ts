import { config } from "dotenv";
config();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || "Admin";

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <password> [name]");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { email },
      data: {
        passwordHash: await hash(password, 12),
        role: "ADMIN",
        emailVerified: new Date(),
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });
    console.log(`Updated existing user to ADMIN: ${updated.email}`);
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hash(password, 12),
        role: "ADMIN",
        emailVerified: new Date(),
      },
    });
    console.log(`Created admin: ${user.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
