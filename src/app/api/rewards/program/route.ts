import { NextRequest } from "next/server";
import { requireEmployee, requirePermission, toResponse } from "@/lib/employee-session";
import { requireModule } from "@/lib/modules";
import {
  getOrCreateProgram,
  updateProgram,
  programToCashbackPct,
  cashbackPctToProgram,
  ProgramValidationError,
} from "@/lib/rewards/program";
import type { RewardEligibility } from "@/generated/prisma/enums";

export async function GET() {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "REWARDS");
  } catch {
    return Response.json({ error: "Module Fidélité non activé" }, { status: 403 });
  }

  const program = await getOrCreateProgram(employee.providerId);
  return Response.json({
    id: program.id,
    pointsPerDinar: program.pointsPerDinar.toString(),
    dinarPerPoint: program.dinarPerPoint.toString(),
    cashbackPct: programToCashbackPct(program),
    minPointsToRedeem: program.minPointsToRedeem,
    maxRedemptionPctPerSale: program.maxRedemptionPctPerSale,
    eligibleOn: program.eligibleOn,
    inactivityExpireMonths: program.inactivityExpireMonths,
    welcomeBonusPoints: program.welcomeBonusPoints,
    birthdayBonusPoints: program.birthdayBonusPoints,
    active: program.active,
    displayName: program.displayName,
    whatsappMessage: (program as unknown as { whatsappMessage: string | null }).whatsappMessage ?? null,
  });
}

type PutBody = {
  cashbackPct?: number;
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
  whatsappMessage?: string | null;
};

export async function PUT(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("rewards.settings");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "REWARDS");
  } catch {
    return Response.json({ error: "Module Fidélité non activé" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PutBody | null;
  if (!body) return Response.json({ error: "Corps invalide" }, { status: 400 });

  const program = await getOrCreateProgram(employee.providerId);

  // Cashback % UX takes priority over the raw ratios.
  let updates: Parameters<typeof updateProgram>[1] = {
    minPointsToRedeem: body.minPointsToRedeem,
    maxRedemptionPctPerSale: body.maxRedemptionPctPerSale,
    eligibleOn: body.eligibleOn,
    inactivityExpireMonths: body.inactivityExpireMonths,
    welcomeBonusPoints: body.welcomeBonusPoints,
    birthdayBonusPoints: body.birthdayBonusPoints,
    active: body.active,
    displayName: body.displayName,
    whatsappMessage:
      body.whatsappMessage === undefined
        ? undefined
        : body.whatsappMessage === null || body.whatsappMessage.trim() === ""
          ? null
          : body.whatsappMessage.slice(0, 500),
  };
  if (body.cashbackPct !== undefined) {
    try {
      updates = { ...updates, ...cashbackPctToProgram(body.cashbackPct) };
    } catch (err) {
      if (err instanceof ProgramValidationError) {
        return Response.json({ error: err.message, field: err.field }, { status: 422 });
      }
      throw err;
    }
  } else {
    if (body.pointsPerDinar !== undefined) updates.pointsPerDinar = body.pointsPerDinar;
    if (body.dinarPerPoint !== undefined) updates.dinarPerPoint = body.dinarPerPoint;
  }

  try {
    const updated = await updateProgram(program.id, updates);
    return Response.json({
      id: updated.id,
      pointsPerDinar: updated.pointsPerDinar.toString(),
      dinarPerPoint: updated.dinarPerPoint.toString(),
      cashbackPct: programToCashbackPct(updated),
      minPointsToRedeem: updated.minPointsToRedeem,
      maxRedemptionPctPerSale: updated.maxRedemptionPctPerSale,
      eligibleOn: updated.eligibleOn,
      inactivityExpireMonths: updated.inactivityExpireMonths,
      welcomeBonusPoints: updated.welcomeBonusPoints,
      birthdayBonusPoints: updated.birthdayBonusPoints,
      active: updated.active,
      displayName: updated.displayName,
      whatsappMessage: (updated as unknown as { whatsappMessage: string | null }).whatsappMessage ?? null,
    });
  } catch (err) {
    if (err instanceof ProgramValidationError) {
      return Response.json({ error: err.message, field: err.field }, { status: 422 });
    }
    throw err;
  }
}
