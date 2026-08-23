-- Journal des televersements, pour le quota par utilisateur (lot C).
--
-- Ecrite a la main, PAS via `prisma migrate dev` : le schema et la base
-- divergent depuis juin sur `CashDrawerExpense_employeeId_fkey` (voir
-- docs/seo-notes.md). Une migration generee voudrait "reparer" cette
-- contrainte au passage, ce qui n'a rien a voir avec ce lot.
--
-- `userId` sans cle etrangere : un employe de caisse televerse via une
-- session PIN, ou il n'y a pas toujours de `User`.

CREATE TABLE "UploadLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UploadLog_userId_createdAt_idx" ON "UploadLog"("userId", "createdAt");
