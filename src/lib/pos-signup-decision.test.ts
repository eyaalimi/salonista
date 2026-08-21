import { describe, it, expect } from "vitest";
import { decidePosSignup } from "./pos-signup-decision";

describe("decidePosSignup", () => {
  it("cree le salon quand l'email est libre", () => {
    expect(decidePosSignup(false)).toEqual({ action: "create" });
  });

  it("refuse quand un compte porte deja cet email", () => {
    const d = decidePosSignup(true);
    expect(d.action).toBe("reject");
  });

  it("refuse avec un 409, comme le refus deja connu du client", () => {
    const d = decidePosSignup(true);
    if (d.action !== "reject") throw new Error("attendu : reject");
    expect(d.status).toBe(409);
  });

  it("invite a se connecter, en francais", () => {
    const d = decidePosSignup(true);
    if (d.action !== "reject") throw new Error("attendu : reject");
    expect(d.error).toMatch(/connectez-vous/i);
  });

  /**
   * Le coeur de la faille : un compte SANS profil salon — toute cliente, toute
   * influenceuse — etait auparavant reutilise et promu en PROVIDER. Il doit
   * desormais etre refuse exactement comme un salon.
   */
  it("refuse aussi un compte sans profil salon (cliente, influenceuse)", () => {
    expect(decidePosSignup(true).action).toBe("reject");
  });

  /**
   * La route ne doit pas reveler le type du compte trouve : sinon elle indique
   * a qui teste un email s'il correspond a une cliente ou a un salon.
   */
  it("ne revele pas le type du compte trouve", () => {
    const d = decidePosSignup(true);
    if (d.action !== "reject") throw new Error("attendu : reject");
    expect(d.error).not.toMatch(/salon|cliente|influenceuse|prestataire/i);
  });
});
