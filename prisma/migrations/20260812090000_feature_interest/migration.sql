-- CreateTable
CREATE TABLE "FeatureInterest" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureInterest_providerId_feature_key" ON "FeatureInterest"("providerId", "feature");

-- CreateIndex
CREATE INDEX "FeatureInterest_feature_idx" ON "FeatureInterest"("feature");

-- AddForeignKey
ALTER TABLE "FeatureInterest" ADD CONSTRAINT "FeatureInterest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
