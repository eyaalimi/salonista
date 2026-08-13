import { parseCoords, type Coords } from "@/lib/coords";

/**
 * Cherche des coordonnees a partir d'une adresse libre.
 *
 * Passe par /api/geocode et non directement par Nominatim : ce dernier renvoie
 * 403 sans User-Agent identifiant, et `User-Agent` est un en-tete interdit
 * cote navigateur — fetch l'ignore. Le detail vit dans la route ; ici on ne
 * garde que le contrat.
 *
 * Appele sur clic explicite de l'utilisateur, jamais a la frappe : Nominatim
 * limite a 1 requete/seconde et ce rythme ne l'approche pas.
 *
 * Renvoie null si l'adresse est introuvable ou si la reponse est inexploitable.
 * L'appelant ne distingue pas les deux cas : dans les deux il n'y a rien a
 * placer sur la carte.
 */
export async function geocodeAddress(query: string): Promise<Coords | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;

    const data = (await res.json()) as { coords?: unknown };
    if (!data.coords || typeof data.coords !== "object") return null;

    const { lat, lng } = data.coords as { lat?: unknown; lng?: unknown };
    // Revalide cote client : la route est un proxy, pas une source de verite.
    return parseCoords(lat as number, lng as number);
  } catch {
    return null;
  }
}
