import { describe, expect, it } from "vitest";
import { getRoleDefaults, mergePermissions } from "./permissions";
import { estEcriture } from "./support-salon";

describe("permission pos.credit (« Payer plus tard »)", () => {
  it("propriétaire, gérante et caissière : oui ; styliste : non", () => {
    expect(getRoleDefaults("OWNER")["pos.credit"]).toBe(true);
    expect(getRoleDefaults("MANAGER")["pos.credit"]).toBe(true);
    expect(getRoleDefaults("CASHIER")["pos.credit"]).toBe(true);
    expect(getRoleDefaults("STYLIST")["pos.credit"]).toBe(false);
  });

  it("une styliste encaisse quand même un crédit existant (pos.sell)", () => {
    expect(getRoleDefaults("STYLIST")["pos.sell"]).toBe(true);
  });

  it("effacer une dette = pos.void : propriétaire et gérante seulement", () => {
    expect(getRoleDefaults("OWNER")["pos.void"]).toBe(true);
    expect(getRoleDefaults("MANAGER")["pos.void"]).toBe(true);
    expect(getRoleDefaults("CASHIER")["pos.void"]).toBe(false);
    expect(getRoleDefaults("STYLIST")["pos.void"]).toBe(false);
  });

  it("une surcharge individuelle reste possible", () => {
    expect(mergePermissions("STYLIST", { "pos.credit": true })["pos.credit"]).toBe(true);
  });

  it("est une écriture : bloquée dans la vue « voir comme le salon »", () => {
    expect(estEcriture("pos.credit")).toBe(true);
  });
});
