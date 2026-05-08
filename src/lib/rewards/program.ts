/**
 * RewardProgram CRUD + the cashback-% UX bridge.
 *
 * Owners think in cashback percentages ("3% back"). Internally that becomes
 * `pointsPerDinar = 3` and `dinarPerPoint = 0.010` (so 100 pts = 1 DT).
 * The two ratios stay editable directly via the "Avancé" toggle.
 */

import { prisma } from "@/lib/prisma";
import type { RewardProgram } from "@/generated/prisma/client";
import type { RewardEligibility } from "@/generated/prisma/enums";

export type RewardProgramInput = {
  pointsPerDinar?: string | number;
  dinarPerPoint?: string | number;
  minPointsToRedeem?: number;
  maxRedemptionPctPerSale?: number;
  eligibleOn?: RewardEligibility;
  inactivityExpireMonths?: number | null;
  welcomeBonusPoints?: number;
  birthdayBonusPoints?: number;
  active?: boolean;
  displayName?: string | null;
};

/**
 * Get the program for a salon, lazily creating it with defaults.
 * Race-safe: concurrent first-time accesses (e.g. multiple cashiers loading
 * /api/pos/catalog at once after REWARDS gets activated) collapse to a single
 * row via the @unique constraint on providerId.
 */
export async function getOrCreateProgram(providerId: string): Promise<RewardProgram> {
  const existing = await prisma.rewardProgram.findUnique({ where: { providerId } });
  if (existing) return existing;
  try {
    return await prisma.rewardProgram.create({ data: { providerId } });
  } catch {
    const refetch = await prisma.rewardProgram.findUnique({ where: { providerId } });
    if (refetch) return refetch;
    throw new Error("Impossible de créer le programme de fidélité");
  }
}

export class ProgramValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ProgramValidationError";
  }
}

function validate(input: RewardProgramInput): void {
  if (input.minPointsToRedeem !== undefined && input.minPointsToRedeem < 0) {
    throw new ProgramValidationError("minPointsToRedeem", "Doit être ≥ 0");
  }
  if (input.maxRedemptionPctPerSale !== undefined) {
    if (input.maxRedemptionPctPerSale < 0 || input.maxRedemptionPctPerSale > 100) {
      throw new ProgramValidationError("maxRedemptionPctPerSale", "Doit être entre 0 et 100");
    }
  }
  if (input.welcomeBonusPoints !== undefined && input.welcomeBonusPoints < 0) {
    throw new ProgramValidationError("welcomeBonusPoints", "Doit être ≥ 0");
  }
  if (input.birthdayBonusPoints !== undefined && input.birthdayBonusPoints < 0) {
    throw new ProgramValidationError("birthdayBonusPoints", "Doit être ≥ 0");
  }
  if (input.inactivityExpireMonths !== undefined && input.inactivityExpireMonths !== null) {
    if (input.inactivityExpireMonths < 1 || input.inactivityExpireMonths > 60) {
      throw new ProgramValidationError("inactivityExpireMonths", "Doit être entre 1 et 60 mois");
    }
  }
  if (input.pointsPerDinar !== undefined) {
    const n = Number(input.pointsPerDinar);
    if (!Number.isFinite(n) || n < 0) {
      throw new ProgramValidationError("pointsPerDinar", "Valeur invalide");
    }
  }
  if (input.dinarPerPoint !== undefined) {
    const n = Number(input.dinarPerPoint);
    if (!Number.isFinite(n) || n <= 0) {
      throw new ProgramValidationError("dinarPerPoint", "Doit être > 0");
    }
  }
}

export async function updateProgram(
  programId: string,
  updates: RewardProgramInput,
): Promise<RewardProgram> {
  validate(updates);
  return prisma.rewardProgram.update({
    where: { id: programId },
    data: {
      pointsPerDinar:
        updates.pointsPerDinar !== undefined ? String(updates.pointsPerDinar) : undefined,
      dinarPerPoint:
        updates.dinarPerPoint !== undefined ? String(updates.dinarPerPoint) : undefined,
      minPointsToRedeem: updates.minPointsToRedeem,
      maxRedemptionPctPerSale: updates.maxRedemptionPctPerSale,
      eligibleOn: updates.eligibleOn,
      inactivityExpireMonths: updates.inactivityExpireMonths,
      welcomeBonusPoints: updates.welcomeBonusPoints,
      birthdayBonusPoints: updates.birthdayBonusPoints,
      active: updates.active,
      displayName: updates.displayName,
    },
  });
}

/** Cashback % = pointsPerDinar × dinarPerPoint × 100. */
export function programToCashbackPct(p: Pick<RewardProgram, "pointsPerDinar" | "dinarPerPoint">): string {
  const ppd = Number(p.pointsPerDinar.toString());
  const dpp = Number(p.dinarPerPoint.toString());
  return (ppd * dpp * 100).toFixed(3);
}

/** Convert a cashback % into the canonical (1 pt = 0.010 DT) ratios. */
export function cashbackPctToProgram(pct: number): {
  pointsPerDinar: string;
  dinarPerPoint: string;
} {
  if (!Number.isFinite(pct) || pct < 0) {
    throw new ProgramValidationError("cashbackPct", "Pourcentage invalide");
  }
  return {
    pointsPerDinar: pct.toFixed(3),
    dinarPerPoint: "0.010",
  };
}
