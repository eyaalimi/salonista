"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress } from "@/lib/geocode";
import { markerIcon } from "@/components/map/marker-icon";
import { adresseComplete } from "@/lib/tunisie-geo";

/** Centre de la Tunisie, cadrage par defaut quand on n'a aucun point. */
const TUNISIE: [number, number] = [34.0, 9.0];
const ZOOM_PAYS = 6;
const ZOOM_ADRESSE = 16;

/**
 * Carte editable : marqueur deplaçable + bouton de geocodage.
 *
 * Ce composant importe Leaflet, qui manipule le DOM et n'existe pas cote
 * serveur. Il DOIT etre charge via dynamic(..., { ssr: false }).
 */
export default function LocationPicker({
  lat,
  lng,
  address,
  city,
  governorate,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  address: string;
  /** La delegation. */
  city: string;
  governorate?: string;
  onChange: (lat: number, lng: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [busy, setBusy] = useState(false);
  // Un point est-il defini ? Sans lui la fiche n'a ni carte ni itineraire :
  // l'ecran doit le dire, pas laisser croire que tout est en ordre.
  const place = lat !== null && lng !== null;
  const [message, setMessage] = useState<string | null>(null);

  // Le parent recree souvent onChange ; on garde la derniere version sans
  // relancer l'effet de montage, qui detruirait la carte a chaque frappe.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /**
   * Place ou deplace le marqueur, et remonte les coordonnees au parent.
   *
   * Declaree avant l'effet de montage qui l'appelle : la regle de lint
   * react-hooks/immutability refuse un acces a une fonction declaree plus bas.
   */
  function placeMarker(nextLat: number, nextLng: number, notify: boolean) {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setLatLng([nextLat, nextLng]);
    } else {
      marker.current = L.marker([nextLat, nextLng], {
        draggable: true,
        icon: markerIcon(),
      }).addTo(map.current);

      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        onChangeRef.current(p.lat, p.lng);
        setMessage(null);
      });
    }

    if (notify) onChangeRef.current(nextLat, nextLng);
  }

  // Montage unique. Les dependances sont volontairement vides : la position
  // initiale ne doit etre lue qu'une fois, les mises a jour passent par
  // placeMarker.
  useEffect(() => {
    if (!container.current || map.current) return;

    const hasPoint = lat !== null && lng !== null;
    map.current = L.map(container.current, {
      center: hasPoint ? [lat, lng] : TUNISIE,
      zoom: hasPoint ? ZOOM_ADRESSE : ZOOM_PAYS,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map.current);

    if (hasPoint) {
      placeMarker(lat, lng, false);
    }

    map.current.on("click", (e: L.LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng, true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * PAS DE GEOCODAGE AUTOMATIQUE — retire volontairement.
   *
   * Une version precedente posait un marqueur des que l'adresse etait
   * complete, en la geocodant. C'etait faux : Nominatim rend le centre de la
   * delegation, pas la devanture du salon. Le marqueur apparaissait tout seul
   * a plusieurs centaines de metres, et « Me localiser » semblait donner un
   * mauvais resultat alors qu'il n'avait jamais ete appele.
   *
   * Le point doit venir d'une intention explicite, dans cet ordre :
   *   1. « Me localiser » — la position REELLE de l'appareil (telephone) ;
   *   2. un clic sur la carte — le salon pointe sa devanture (ordinateur) ;
   *   3. « Depuis l'adresse » — approximation assumee, en dernier recours.
   *
   * C'est ce point qui ouvrira l'itineraire de la cliente : mieux vaut aucun
   * marqueur qu'un marqueur faux.
   */

  /**
   * Position reelle de l'appareil.
   *
   * Le salon remplit son profil DEPUIS son salon : sa position GPS est plus
   * juste que le geocodage d'une adresse, qui rend souvent le centre de la
   * delegation. Or c'est ce point qui ouvrira l'itineraire de la cliente.
   *
   * `geolocation` est natif (aucune dependance) mais exige HTTPS — vrai en
   * production, et sur localhost en developpement.
   */
  function seLocaliser() {
    if (!navigator.geolocation) {
      setMessage(
        "Ce navigateur ne sait pas donner ta position. Place le marqueur à la main.",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.current?.setView(
          [pos.coords.latitude, pos.coords.longitude],
          ZOOM_ADRESSE,
        );
        placeMarker(pos.coords.latitude, pos.coords.longitude, true);
        // `accuracy` est un rayon en metres. Un telephone donne ~10 m, un
        // ordinateur portable sans GPS se repere par le Wi-Fi et peut se
        // tromper de plusieurs centaines de metres — le dire evite qu'un
        // point grossier soit pris pour exact.
        const m = Math.round(pos.coords.accuracy);
        setMessage(
          m > 100
            ? `Position approximative (± ${m} m). Clique sur la carte pour pointer ton salon précisément.`
            : `Position trouvée (± ${m} m). Déplace le marqueur si besoin.`,
        );
        setBusy(false);
      },
      (err) => {
        // Distinguer le refus des autres echecs : dans un cas il faut
        // reautoriser dans le navigateur, dans l'autre reessayer.
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? "Accès à la position refusé. Autorise-le dans ton navigateur, ou place le marqueur à la main."
            : "Position indisponible. Place le marqueur à la main sur la carte.",
        );
        setBusy(false);
      },
      // `enableHighAccuracy` : on cherche une devanture, pas une ville.
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  async function localiser() {
    // Nominatim geocode mal sans pays ni echelon administratif : la requete
    // se limitait a la rue et a la delegation, et echouait souvent.
    const query = adresseComplete(address.trim(), city.trim(), governorate?.trim() ?? null);
    if (!query) {
      setMessage("Renseignez d'abord une adresse ou une ville.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const found = await geocodeAddress(query);
      if (!found) {
        setMessage("Adresse introuvable. Placez le marqueur à la main sur la carte.");
        return;
      }
      map.current?.setView([found.lat, found.lng], ZOOM_ADRESSE);
      placeMarker(found.lat, found.lng, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div ref={container} className="h-64 w-full rounded border border-pos-border" />

      <p className="mt-2 text-xs text-pos-ink-3">
        {place
          ? "C'est ce point qui ouvrira l'itinéraire de tes clientes. Clique sur la carte ou déplace le marqueur pour le corriger."
          : "Aucun emplacement défini. Tes clientes n'auront ni carte ni itinéraire."}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {/* Action principale, surtout sur telephone : la position REELLE de
            l'appareil. Le salon remplit son profil depuis son salon. */}
        <button
          type="button"
          onClick={seLocaliser}
          disabled={busy}
          className="rounded border border-pos-accent bg-pos-accent-soft px-3 py-1.5 text-xs font-medium text-pos-accent disabled:opacity-50"
        >
          {busy ? "Recherche…" : "📍 Utiliser ma position actuelle"}
        </button>
        {/* Dernier recours, jamais automatique : Nominatim rend le centre de
            la delegation, pas la devanture. */}
        <button
          type="button"
          onClick={localiser}
          disabled={busy}
          className="rounded border border-pos-border px-3 py-1.5 text-xs text-pos-ink-2 disabled:opacity-50"
        >
          Chercher depuis l&apos;adresse
        </button>
      </div>

      <p className="mt-2 text-xs text-pos-ink-3">
        Sur téléphone, autorise l&apos;accès à ta position quand le navigateur
        le demande. Sur ordinateur, clique directement sur la carte à
        l&apos;emplacement de ton salon.
      </p>

      {message && <p className="mt-1 text-xs text-pos-ink-2">{message}</p>}
    </div>
  );
}
