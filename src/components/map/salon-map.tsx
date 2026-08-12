"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { markerIcon } from "@/components/map/marker-icon";

/**
 * Carte en lecture seule : un marqueur, pas d'edition.
 *
 * Ce composant importe Leaflet, qui manipule le DOM et n'existe pas cote
 * serveur. Il DOIT etre charge via dynamic(..., { ssr: false }) — sinon le
 * build echoue sur « window is not defined ».
 */
export default function SalonMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;

    map.current = L.map(container.current, {
      center: [lat, lng],
      zoom: 16,
      // La molette zoome la page, pas la carte : sur une fiche longue, capturer
      // le scroll pieger la visiteuse qui veut simplement descendre.
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map.current);

    L.marker([lat, lng], { icon: markerIcon() })
      .addTo(map.current)
      .bindPopup(label);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [lat, lng, label]);

  return <div ref={container} className="h-56 w-full rounded" />;
}
