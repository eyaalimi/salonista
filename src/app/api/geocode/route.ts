import { NextRequest, NextResponse } from "next/server";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { parseCoords } from "@/lib/coords";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/**
 * Proxy de geocodage vers Nominatim.
 *
 * POURQUOI CETTE ROUTE EXISTE : Nominatim renvoie 403 a toute requete sans
 * User-Agent identifiant (sa politique d'usage l'exige). Or `User-Agent` est
 * un en-tete interdit cote navigateur — `fetch` l'ignore silencieusement. Le
 * geocodage depuis le client est donc structurellement impossible, verifie :
 * sans en-tete 403, avec en-tete 200.
 *
 * La contrepartie est que toutes les requetes partent de l'IP du serveur.
 * Acceptable au volume actuel : un appel par clic sur « Localiser », pas par
 * visite. Si le volume monte, ajouter un cache par adresse ici.
 *
 * Reservee aux employes connectes : un proxy de geocodage ouvert serait un
 * relais anonyme vers Nominatim, ce que sa politique interdit.
 */
export async function GET(req: NextRequest) {
  try {
    await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Adresse manquante" }, { status: 400 });
  }

  // countrycodes=tn ecarte les homonymes etrangers : « rue de Marseille »
  // existe aussi a Marseille.
  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=tn&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Salonista/1.0 (https://salonista.tn)",
      },
    });
    if (!res.ok) {
      return NextResponse.json({ coords: null }, { status: 200 });
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ coords: null }, { status: 200 });
    }

    // Nominatim nomme la longitude "lon", pas "lng".
    const first = data[0] as { lat?: string; lon?: string };
    return NextResponse.json({ coords: parseCoords(first.lat, first.lon) });
  } catch {
    return NextResponse.json({ coords: null }, { status: 200 });
  }
}
