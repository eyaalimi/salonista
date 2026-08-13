"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress } from "@/lib/geocode";
import { markerIcon } from "@/components/map/marker-icon";

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
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  address: string;
  city: string;
  onChange: (lat: number, lng: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [busy, setBusy] = useState(false);
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

  async function localiser() {
    const query = [address.trim(), city.trim()].filter(Boolean).join(", ");
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
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="text-xs text-pos-ink-3">
          Déplacez le marqueur si l&apos;emplacement n&apos;est pas exact.
        </p>
        <button
          type="button"
          onClick={localiser}
          disabled={busy}
          className="shrink-0 rounded border border-pos-border px-3 py-1.5 text-xs text-pos-ink-2 disabled:opacity-50"
        >
          {busy ? "Recherche…" : "Localiser"}
        </button>
      </div>
      {message && <p className="mt-1 text-xs text-amber-700">{message}</p>}
    </div>
  );
}
