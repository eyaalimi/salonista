import { describe, it, expect } from "vitest";
import {
  PAIEMENT_EN_LIGNE_ACTIF,
  etatCreationReservation,
  refusValidationArrivee,
} from "./booking-state";

describe("PAIEMENT_EN_LIGNE_ACTIF", () => {
  it("est desactive : aucun prestataire de paiement n'est branche", () => {
    expect(PAIEMENT_EN_LIGNE_ACTIF).toBe(false);
  });
});

describe("etatCreationReservation", () => {
  it("confirme la reservation et emet le QR sans paiement en ligne", () => {
    expect(etatCreationReservation(false)).toEqual({
      status: "CONFIRMED",
      paymentStatus: "UNPAID",
      emettreQr: true,
    });
  });

  it("ne marque jamais une reservation payee : le salon encaisse au comptoir", () => {
    expect(etatCreationReservation(false).paymentStatus).toBe("UNPAID");
  });

  it("attend le reglement avant de confirmer, si le paiement en ligne revient", () => {
    expect(etatCreationReservation(true)).toEqual({
      status: "PENDING",
      paymentStatus: "UNPAID",
      emettreQr: false,
    });
  });

  it("suit le drapeau du module par defaut", () => {
    expect(etatCreationReservation()).toEqual(
      etatCreationReservation(PAIEMENT_EN_LIGNE_ACTIF),
    );
  });
});

describe("refusValidationArrivee", () => {
  const enAttente = {
    status: "CONFIRMED" as const,
    paymentStatus: "UNPAID" as const,
    qrVerified: false,
  };

  /**
   * Le coeur du lot A : une reservation non payee doit pouvoir etre validee,
   * puisque la cliente vient regler sur place. Le controle precedent rendait
   * tout QR inutilisable.
   */
  it("accepte une reservation non payee — la cliente paie au salon", () => {
    expect(refusValidationArrivee(enAttente, false)).toBe(null);
  });

  it("refuse une reservation annulee", () => {
    const r = refusValidationArrivee({ ...enAttente, status: "CANCELLED" }, false);
    expect(r?.raison).toBe("annulee");
  });

  it("refuse une seconde validation du meme QR", () => {
    const r = refusValidationArrivee({ ...enAttente, qrVerified: true }, false);
    expect(r?.raison).toBe("deja-validee");
  });

  it("place l'annulation avant la double validation", () => {
    // Une reservation annulee puis re-scannee doit dire « annulee », le motif
    // le plus utile au salon qui a la cliente devant lui.
    const r = refusValidationArrivee(
      { ...enAttente, status: "CANCELLED", qrVerified: true },
      false,
    );
    expect(r?.raison).toBe("annulee");
  });

  it("exige le reglement si le paiement en ligne est actif", () => {
    const r = refusValidationArrivee(enAttente, true);
    expect(r?.raison).toBe("non-payee");
  });

  it("accepte une reservation payee quand le paiement en ligne est actif", () => {
    const r = refusValidationArrivee(
      { ...enAttente, paymentStatus: "PAID" },
      true,
    );
    expect(r).toBe(null);
  });

  it("rend des messages en francais", () => {
    const r = refusValidationArrivee({ ...enAttente, status: "CANCELLED" }, false);
    expect(r?.message).toMatch(/annulée/i);
  });
});
