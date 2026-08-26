"use client";

/**
 * Remplit le panier a l'arrivee sur `/pos?bookingId=…`.
 *
 * C'est ce que produit « Encaisser » depuis l'agenda ou depuis la page de
 * verification du QR : la caissiere doit trouver la caisse deja prete, sans
 * rien rechercher.
 *
 * POURQUOI UN COMPOSANT A PART. Cette lecture vivait dans `side-panel.tsx`,
 * or le shell ne monte ce panneau QUE lorsqu'il est ouvert
 * (`{sideOpen && …}`). En arrivant sur `/pos?bookingId=…` le panneau est
 * ferme : le code n'existait pas dans l'arbre React et le panier restait
 * vide. Il faut que ce montage soit INCONDITIONNEL — d'ou ce composant sans
 * interface, rendu par le shell.
 */

import { useEffect, useRef, useState } from "react";
import { usePosStore } from "@/lib/pos-store";

/** Ce que rend `/api/pos/bookings/[id]` : le Booking brut de Prisma. */
type BookingDetail = {
  id: string;
  customer: {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  items: Array<{
    offer: {
      id: string;
      title: string;
      discountPrice: string;
      taxRate: string;
    };
  }>;
};

export function AttacheRdvDepuisUrl({
  defaultEmployeeId,
}: {
  defaultEmployeeId: string;
}) {
  const addLine = usePosStore((s) => s.addLine);
  const attachBooking = usePosStore((s) => s.attachBooking);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const [erreur, setErreur] = useState<string | null>(null);

  // Sans ce garde, un rendu supplementaire rejouerait l'attache et
  // dupliquerait les lignes.
  const fait = useRef(false);

  useEffect(() => {
    if (fait.current) return;
    const params = new URLSearchParams(window.location.search);
    const vise = params.get("bookingId");
    if (!vise) return;

    fait.current = true;

    // Nettoyer l'URL tout de suite : un rafraichissement ne doit pas
    // re-attacher le meme rendez-vous.
    params.delete("bookingId");
    const reste = params.toString();
    window.history.replaceState(
      null,
      "",
      reste ? `${window.location.pathname}?${reste}` : window.location.pathname,
    );

    (async () => {
      const res = await fetch(`/api/pos/bookings/${vise}`);
      if (!res.ok) {
        setErreur(
          "Ce rendez-vous n'a pas pu être chargé. Ajoute les services à la main.",
        );
        return;
      }
      const b = (await res.json()) as BookingDetail;

      // Deja attache (double clic, retour arriere) : ne pas dupliquer.
      if (usePosStore.getState().attachedBookingId === b.id) return;

      if (b.customer) {
        setCustomer({
          id: b.customer.id,
          phone: b.customer.phone,
          firstName: b.customer.firstName,
          lastName: b.customer.lastName,
          email: null,
        });
      }

      // Le prix et la TVA vivent sur l'OFFRE : `BookingItem` n'a qu'un
      // `unitPrice` et aucun `taxRate`. Meme derivation que
      // `/api/pos/bookings/today`.
      const uids: string[] = [];
      for (const it of b.items) {
        const uid = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        uids.push(uid);
        addLine({
          uid,
          kind: "SERVICE",
          offerId: it.offer.id,
          nameSnapshot: it.offer.title,
          priceSnapshot: it.offer.discountPrice,
          taxRateSnapshot: it.offer.taxRate,
          quantity: 1,
          assignedEmployeeId: defaultEmployeeId,
        });
      }
      attachBooking(b.id, uids);
    })();
  }, [addLine, attachBooking, setCustomer, defaultEmployeeId]);

  if (!erreur) return null;

  // Un panier vide ne doit jamais passer pour un panier rempli.
  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-pos-danger px-5 py-3 text-sm text-white shadow-xl"
    >
      {erreur}
    </div>
  );
}
