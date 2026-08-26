export class InvalidPhoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPhoneError";
  }
}

const VALID_FIRST_DIGITS = new Set(["2", "3", "4", "5", "7", "9"]);

export function normalizePhone(input: string): string {
  if (typeof input !== "string") {
    throw new InvalidPhoneError("Numéro de téléphone requis");
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new InvalidPhoneError("Numéro de téléphone requis");
  }

  let digits = trimmed.replace(/[\s\-().]/g, "");

  if (/[^\d+]/.test(digits)) {
    throw new InvalidPhoneError("Le numéro contient des caractères invalides");
  }

  if (digits.startsWith("+")) {
    if (!digits.startsWith("+216")) {
      throw new InvalidPhoneError("Seuls les numéros tunisiens (+216) sont acceptés");
    }
    digits = digits.slice(4);
  } else if (digits.startsWith("00216")) {
    digits = digits.slice(5);
  } else if (digits.startsWith("216") && digits.length >= 11) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0") && digits.length === 9) {
    digits = digits.slice(1);
  }

  if (digits.length !== 8) {
    throw new InvalidPhoneError("Le numéro doit comporter 8 chiffres");
  }

  if (!/^\d{8}$/.test(digits)) {
    throw new InvalidPhoneError("Le numéro doit comporter 8 chiffres");
  }

  if (!VALID_FIRST_DIGITS.has(digits[0])) {
    throw new InvalidPhoneError("Préfixe tunisien invalide");
  }

  return `+216${digits}`;
}

export function tryNormalizePhone(input: string): string | null {
  try {
    return normalizePhone(input);
  } catch {
    return null;
  }
}

/**
 * Le telephone d'un salon est OBLIGATOIRE.
 *
 * Il portera l'envoi des confirmations de reservation et des validations
 * d'arrivee par WhatsApp : un salon sans numero n'est joignable par aucun de
 * ces canaux, et la cliente se retrouve sans confirmation.
 *
 * La regle vaut aussi pour les salons deja inscrits sans numero — ils devront
 * en saisir un a leur prochaine modification de profil. C'est le prix pour que
 * le canal fonctionne pour tout le monde, sans relance manuelle.
 *
 * Rend le numero normalise (`+216…`) ou un message d'erreur en francais.
 */
export function exigerTelephoneSalon(
  input: unknown,
): { ok: true; phone: string } | { ok: false; message: string } {
  if (typeof input !== "string" || input.trim() === "") {
    return {
      ok: false,
      message:
        "Le numéro de téléphone est obligatoire : il sert à envoyer les confirmations de réservation par WhatsApp.",
    };
  }
  const normalise = tryNormalizePhone(input);
  if (!normalise) {
    return {
      ok: false,
      message: "Numéro de téléphone invalide. Format attendu : 8 chiffres.",
    };
  }
  return { ok: true, phone: normalise };
}

export function formatPhoneDisplay(e164: string): string {
  if (!e164.startsWith("+216") || e164.length !== 12) {
    return e164;
  }
  const local = e164.slice(4);
  return `+216 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
