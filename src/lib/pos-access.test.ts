import { describe, it, expect } from "vitest";
import { posLandingPath, isCashSection } from "./pos-access";

describe("posLandingPath", () => {
  it("envoie vers la caisse quand le module POS est actif", () => {
    expect(posLandingPath(["POS"])).toBe(null);
  });

  it("envoie vers le calendrier quand le module POS est absent", () => {
    expect(posLandingPath([])).toBe("/pos/calendar");
  });

  it("envoie vers le calendrier quand seul REWARDS est actif", () => {
    expect(posLandingPath(["REWARDS"])).toBe("/pos/calendar");
  });

  it("envoie vers la caisse quand POS et REWARDS sont actifs", () => {
    expect(posLandingPath(["POS", "REWARDS"])).toBe(null);
  });
});

describe("isCashSection", () => {
  it("reconnait les pages de caisse", () => {
    expect(isCashSection("/pos/cash-drawer")).toBe(true);
    expect(isCashSection("/pos/sales")).toBe(true);
    expect(isCashSection("/pos/products")).toBe(true);
    expect(isCashSection("/pos/employees")).toBe(true);
    expect(isCashSection("/pos/commissions")).toBe(true);
    expect(isCashSection("/pos/sync-issues")).toBe(true);
  });

  it("reconnait la caisse elle-meme", () => {
    expect(isCashSection("/pos")).toBe(true);
  });

  it("ne bloque pas les pages metier", () => {
    expect(isCashSection("/pos/calendar")).toBe(false);
    expect(isCashSection("/pos/customers")).toBe(false);
    expect(isCashSection("/pos/services")).toBe(false);
    expect(isCashSection("/pos/settings")).toBe(false);
  });

  it("ne bloque pas la fidelite ni les stats", () => {
    expect(isCashSection("/pos/loyalty")).toBe(false);
    expect(isCashSection("/pos/analytics")).toBe(false);
  });

  it("ne bloque pas les teasers commerciaux", () => {
    expect(isCashSection("/pos/collab")).toBe(false);
    expect(isCashSection("/pos/store")).toBe(false);
  });
});
