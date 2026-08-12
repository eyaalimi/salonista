import { parseCoords, type Coords } from "@/lib/coords";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/**
 * Cherche des coordonnees a partir d'une adresse libre.
 *
 * Appele depuis le navigateur, sur clic explicite de l'utilisateur — jamais a
 * la frappe. Nominatim limite a 1 requete/seconde ; ce rythme ne l'approche
 * pas.
 *
 * Renvoie null si l'adresse est introuvable ou si la reponse est inexploitable.
 * L'appelant distingue les deux cas par le message affiche, pas par le retour :
 * dans les deux cas il n'y a rien a placer sur la carte.
 */
export async function geocodeAddress(query: string): Promise<Coords | null> {
  const q = query.trim();
  if (!q) return null;

  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=tn&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0] as { lat?: string; lon?: string };
    // Nominatim nomme la longitude "lon", pas "lng".
    return parseCoords(first.lat, first.lon);
  } catch {
    return null;
  }
}
