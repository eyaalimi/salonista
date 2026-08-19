import { describe, it, expect } from "vitest";
import { posLandingPath } from "./pos-access";

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
