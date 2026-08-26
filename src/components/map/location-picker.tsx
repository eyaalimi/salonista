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
   * Geocodage AUTOMATIQUE des que l'adresse est complete.
   *
   * Le salon ne devrait pas avoir a cliquer pour que sa fiche soit
   * localisable : sans point, la cliente n'a ni carte ni itineraire.
   *
   * Trois gardes, chacune pour une raison :
   *  - `lat`/`lng` deja poses -> on ne bouge JAMAIS un marqueur place a la
   *    main, ce serait defaire le travail du salon ;
   *  - `dejaTente` -> une seule tentative par adresse, sinon chaque frappe
   *    dans la rue relancerait une requete Nominatim ;
   *  - le delai -> on attend que la saisie se stabilise.
   */
  const dejaTente = useRef<string | null>(null);

  // Declaree AVANT l'effet qui l'appelle : la regle react-hooks/immutability
  // refuse un acces a une fonction declaree plus bas — meme raison que
  // `placeMarker` ci-dessus.
  async function localiserAuto(cle: string) {
    const [gouv, del, rue] = cle.split("|");
    const found = await geocodeAddress(adresseComplete(rue, del, gouv));
    if (!found) return; // silencieux : le salon peut encore cliquer ou pointer
    map.current?.setView([found.lat, found.lng], ZOOM_ADRESSE);
    placeMarker(found.lat, found.lng, true);
    setMessage(
      "Emplacement trouvé automatiquement depuis ton adresse. Vérifie qu'il est exact.",
    );
  }

  useEffect(() => {
    if (lat !== null && lng !== null) return;
    if (!governorate || !city.trim() || address.trim().length < 3) return;

    const cle = `${governorate}|${city.trim()}|${address.trim()}`;
    if (dejaTente.current === cle) return;

    const t = setTimeout(() => {
      dejaTente.current = cle;
      localiserAuto(cle);
    }, 1200);
    return () => clearTimeout(t);
    // `localiserAuto` est stable pour la duree de vie du composant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorate, city, address, lat, lng]);

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
        setMessage("Position trouvée. Déplace le marqueur si besoin.");
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
        C&apos;est ce point qui ouvrira l&apos;itinéraire de tes clientes.
        Déplace le marqueur s&apos;il n&apos;est pas exact.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {/* Action principale : le salon remplit son profil DEPUIS son salon,
            sa position reelle vaut mieux qu'un geocodage d'adresse. */}
        <button
          type="button"
          onClick={seLocaliser}
          disabled={busy}
          className="rounded border border-pos-accent bg-pos-accent-soft px-3 py-1.5 text-xs font-medium text-pos-accent disabled:opacity-50"
        >
          {busy ? "Recherche…" : "📍 Me localiser"}
        </button>
        <button
          type="button"
          onClick={localiser}
          disabled={busy}
          className="rounded border border-pos-border px-3 py-1.5 text-xs text-pos-ink-2 disabled:opacity-50"
        >
          Depuis l&apos;adresse
        </button>
      </div>
      {message && <p className="mt-1 text-xs text-pos-ink-2">{message}</p>}
    </div>
  );
}
