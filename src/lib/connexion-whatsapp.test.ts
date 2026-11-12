import { describe, expect, it } from "vitest";
import { validerConnexionWhatsapp } from "./connexion-whatsapp";

const base = {
  numeroAffiche: "+216 22 345 678",
  phoneNumberId: "106540352242922",
  wabaId: "102290129340398",
  jeton: "EAAGm0PX4ZCpsBAKZCZAAZDZDtresLongJeton",
  nomModele: "promo_salon_yasmine",
  langueModele: "fr",
  texteFinModele: "Nestanewk 3andna 💖",
  prixMessageDT: "0,150",
  statut: "BROUILLON",
};

describe("validerConnexionWhatsapp", () => {
  it("saisie complète", () => {
    const r = validerConnexionWhatsapp(base, false);
    expect(r).toMatchObject({ ok: true, saisie: { prixMessageDT: "0.150", jeton: base.jeton, statut: "BROUILLON" } });
  });

  it("jeton : obligatoire à la création, vide = garder à la modification", () => {
    expect(validerConnexionWhatsapp({ ...base, jeton: "" }, false).ok).toBe(false);
    const r = validerConnexionWhatsapp({ ...base, jeton: "" }, true);
    expect(r.ok && r.saisie.jeton).toBeNull();
    expect(validerConnexionWhatsapp({ ...base, jeton: "court" }, true).ok).toBe(false);
  });

  it("prix facultatif : vide = coût selon le tarif Meta", () => {
    const r = validerConnexionWhatsapp({ ...base, prixMessageDT: "" }, false);
    expect(r.ok && r.saisie.prixMessageDT).toBeNull();
    expect(validerConnexionWhatsapp({ ...base, prixMessageDT: "-1" }, false).ok).toBe(false);
  });

  it("refuse identifiants non numériques, nom de modèle Meta invalide, texte de fin vide, statut inconnu", () => {
    expect(validerConnexionWhatsapp({ ...base, phoneNumberId: "abc" }, false).ok).toBe(false);
    expect(validerConnexionWhatsapp({ ...base, nomModele: "Promo Salon" }, false).ok).toBe(false);
    expect(validerConnexionWhatsapp({ ...base, texteFinModele: "  " }, false).ok).toBe(false);
    expect(validerConnexionWhatsapp({ ...base, statut: "ON" }, false).ok).toBe(false);
    expect(validerConnexionWhatsapp({ ...base, langueModele: "fr_FR" }, false).ok).toBe(true);
    expect(validerConnexionWhatsapp({ ...base, langueModele: "français" }, false).ok).toBe(false);
  });
});
