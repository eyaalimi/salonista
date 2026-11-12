import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { egaliteTempsConstant, lireNotification, verifierBearer, verifierSignature } from "./webhook-whatsapp";

const secret = "secret-de-l-app";
const corps = JSON.stringify({ entry: [{ changes: [] }] });
const signer = (c: string, s = secret) => `sha256=${createHmac("sha256", s).update(c, "utf8").digest("hex")}`;

describe("verifierSignature", () => {
  it("signature valide", () => {
    expect(verifierSignature(corps, signer(corps), secret)).toBe(true);
  });

  it("signature invalide : autre secret, corps modifié, hex tronqué", () => {
    expect(verifierSignature(corps, signer(corps, "autre"), secret)).toBe(false);
    expect(verifierSignature(corps + " ", signer(corps), secret)).toBe(false);
    expect(verifierSignature(corps, signer(corps).slice(0, 20), secret)).toBe(false);
  });

  it("signature absente, mal formée, ou secret non configuré", () => {
    expect(verifierSignature(corps, null, secret)).toBe(false);
    expect(verifierSignature(corps, "", secret)).toBe(false);
    expect(verifierSignature(corps, signer(corps).replace("sha256=", "sha1="), secret)).toBe(false);
    expect(verifierSignature(corps, signer(corps), undefined)).toBe(false);
  });
});

describe("verifierBearer / egaliteTempsConstant", () => {
  it("Bearer exact seulement", () => {
    expect(verifierBearer("Bearer abc123", "abc123")).toBe(true);
    expect(verifierBearer("Bearer abc124", "abc123")).toBe(false);
    expect(verifierBearer("abc123", "abc123")).toBe(false);
    expect(verifierBearer("Bearer ", "")).toBe(false);
    expect(verifierBearer(null, "abc123")).toBe(false);
  });
  it("longueurs différentes", () => {
    expect(egaliteTempsConstant("a", "ab")).toBe(false);
  });
});

describe("lireNotification", () => {
  const notification = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { display_phone_number: "21622345678", phone_number_id: "PNID" },
              statuses: [
                { id: "wamid.A", status: "delivered", timestamp: "1" },
                {
                  id: "wamid.B",
                  status: "failed",
                  errors: [{ code: 131050, title: "Unable to deliver", message: "user stopped marketing" }],
                },
                { status: "read" },
              ],
              messages: [
                { from: "21656549547", type: "button", button: { text: "Ne plus recevoir", payload: "Ne plus recevoir" } },
                { from: "21622000001", type: "text", text: { body: "STOP" } },
                { from: "21622000002", type: "image" },
              ],
            },
          },
        ],
      },
    ],
  };

  it("statuts et messages, éléments incomplets ignorés", () => {
    const r = lireNotification(notification);
    expect(r.statuts).toEqual([
      { messageId: "wamid.A", statut: "delivered", codeErreur: null, messageErreur: null },
      { messageId: "wamid.B", statut: "failed", codeErreur: "131050", messageErreur: "user stopped marketing" },
    ]);
    expect(r.messages).toEqual([
      { phoneNumberId: "PNID", de: "21656549547", texte: "Ne plus recevoir" },
      { phoneNumberId: "PNID", de: "21622000001", texte: "STOP" },
      { phoneNumberId: "PNID", de: "21622000002", texte: null },
    ]);
  });

  it("corps inattendu : rien, sans planter", () => {
    expect(lireNotification(null)).toEqual({ statuts: [], messages: [] });
    expect(lireNotification({ entry: "x" })).toEqual({ statuts: [], messages: [] });
  });
});
