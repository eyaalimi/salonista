/**
 * L'attribution : quelle campagne a amene ce salon ?
 *
 * Decisions pures, sans base ni cookies. Les adaptateurs sont dans
 * /c/[slug] (pose) et /api/pos/signup (lecture).
 */

/** Ce qu'on retient d'une visite, et qu'on recopie sur le salon inscrit. */
export type Attribution = {
  /** Identifiant interne de la campagne, si le visiteur est venu par /c/<slug>. */
  campaignId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

export function attributionVide(): Attribution {
  return {
    campaignId: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
  };
}

export function estVide(a: Attribution): boolean {
  return (
    a.campaignId === null &&
    a.utmSource === null &&
    a.utmMedium === null &&
    a.utmCampaign === null
  );
}

/**
 * Longueur maximale d'une valeur UTM conservee.
 *
 * Ces valeurs viennent de l'URL, donc de n'importe qui. Sans borne, une URL
 * fabriquee ferait grossir la base indefiniment. 120 caracteres couvrent tout
 * nom de campagne raisonnable.
 */
const UTM_MAX = 120;

/**
 * Nettoie une valeur UTM venue de l'URL.
 *
 * Rend `null` pour tout ce qui est vide ou absent, afin qu'une chaine vide ne
 * se distingue jamais d'une valeur manquante dans les comparaisons.
 */
export function nettoyerUtm(valeur: string | null | undefined): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.trim().slice(0, UTM_MAX);
  return propre.length > 0 ? propre : null;
}

/**
 * PREMIERE TOUCHE GAGNE.
 *
 * Choix deliberе : c'est la campagne qui a fait DECOUVRIR Salonista a un
 * salon qu'on veut mesurer, pas celle qu'il a croisee en revenant. Un salon
 * qui voit une publicite Facebook, reflechit trois jours, puis revient par
 * une recherche Google doit rester attribue a Facebook — sans quoi on
 * couperait le budget de la campagne qui fonctionne reellement.
 *
 * La derniere touche ne sert QUE si rien n'a jamais ete retenu : mieux vaut
 * une attribution tardive que pas d'attribution du tout.
 */
export function fusionnerAttribution(
  existante: Attribution,
  nouvelle: Attribution,
): Attribution {
  if (!estVide(existante)) return existante;
  return nouvelle;
}

/**
 * Un slug de campagne est-il acceptable ?
 *
 * Il voyage dans une URL courte (/c/<slug>) qu'on imprime sur des flyers et
 * qu'on dicte au telephone : lettres minuscules, chiffres et tirets
 * uniquement. Pas de point ni de barre oblique, qui pretent a confusion a
 * l'oral comme dans un chemin.
 */
export function slugValide(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}

/**
 * Construit l'URL de destination d'un lien de campagne.
 *
 * Les parametres UTM sont ajoutes a la landing pour rester lisibles dans les
 * outils d'analyse externes, et parce qu'un visiteur qui partage l'URL
 * transmet alors l'attribution.
 *
 * `origine` vient TOUJOURS de `NEXTAUTH_URL` cote appelant, jamais des
 * en-têtes de la requete : Nginx ne les reecrit pas, et quelqu'un pourrait
 * faire rediriger nos liens de campagne vers son propre site (voir la note 16
 * de CLAUDE.md).
 */
export function urlDestination(
  origine: string,
  campagne: { slug: string; utmSource: string | null; utmMedium: string | null },
  destination: string = "/",
): string {
  const url = new URL(destination, origine);
  if (campagne.utmSource) url.searchParams.set("utm_source", campagne.utmSource);
  if (campagne.utmMedium) url.searchParams.set("utm_medium", campagne.utmMedium);
  url.searchParams.set("utm_campaign", campagne.slug);
  return url.toString();
}

/**
 * Taille d'un identifiant de visiteur, en octets d'aleatoire.
 *
 * 16 octets = 128 bits. Il n'encode RIEN : ni IP, ni empreinte de navigateur,
 * ni horodatage. C'est un numero tire au hasard, et c'est tout ce qu'on sait
 * d'un visiteur anonyme — conformement a ce qu'annonce /confidentialite.
 */
export const VISITEUR_OCTETS = 16;

/** Nom du cookie qui porte l'identifiant anonyme. */
export const COOKIE_VISITEUR = "salonista-visiteur";

/** Nom du cookie qui porte l'attribution. */
export const COOKIE_ATTRIBUTION = "salonista-attribution";

/**
 * Duree de vie des deux cookies : 90 jours.
 *
 * Un salon qui decouvre Salonista par une publicite ne s'inscrit pas le jour
 * meme : il en parle a son associee, compare, revient. Sept jours (la duree
 * du suivi des influenceuses) couperait l'attribution de la majorite des
 * conversions reelles.
 */
export const COOKIE_JOURS = 90;

/** Serialise l'attribution pour le cookie. Compact : il voyage a chaque requete. */
export function serialiserAttribution(a: Attribution): string {
  return JSON.stringify([a.campaignId, a.utmSource, a.utmMedium, a.utmCampaign]);
}

/**
 * Relit l'attribution depuis le cookie.
 *
 * Tout ce qui n'est pas exactement la forme attendue rend une attribution
 * VIDE plutot qu'une exception : ce cookie vient du navigateur, donc de
 * n'importe qui. Une inscription ne doit jamais echouer parce qu'un cookie
 * est malforme.
 */
export function lireAttribution(brut: string | null | undefined): Attribution {
  if (!brut) return attributionVide();
  try {
    const v = JSON.parse(brut);
    if (!Array.isArray(v) || v.length !== 4) return attributionVide();
    const [c, s, m, ca] = v;
    return {
      campaignId: typeof c === "string" ? c.slice(0, 40) : null,
      utmSource: nettoyerUtm(s),
      utmMedium: nettoyerUtm(m),
      utmCampaign: nettoyerUtm(ca),
    };
  } catch {
    return attributionVide();
  }
}
