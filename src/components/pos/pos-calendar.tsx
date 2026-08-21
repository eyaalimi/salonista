"use client";

/**
 * Agenda du salon — une liste, pas une grille horaire.
 *
 * La version precedente etait une grille de 28 lignes par jour, avec une vue
 * semaine sur sept colonnes : il fallait situer un bloc sur un axe pour
 * savoir a quelle heure venait la cliente. Pour une proprietaire qui consulte
 * son telephone entre deux clientes, c'est un effort de lecture inutile.
 *
 * Ici chaque rendez-vous est une ligne : l'heure, la cliente, la prestation.
 * On lit de haut en bas, du matin au soir. Un jour a la fois, parce qu'un
 * salon travaille par journee.
 */

import { useCallback, useEffect, useState } from "react";
import { bookingClientName } from "@/lib/booking-client-name";
import { formatHeure } from "@/lib/datetime";

export type CalendarBooking = {
  id: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  walkIn: boolean;
  phantom: boolean;
  createdViaPos: boolean;
  customerName: string | null;
  serviceName: string;
  assignedEmployeeId: string | null;
  saleId: string | null;
};

type Props = {
  initialDate?: Date;
  onCreateAt: (start: Date) => void;
  onOpenBooking: (id: string) => void;
};

function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function libelleJour(d: Date): string {
  const aujourdhui = new Date();
  const demain = new Date(aujourdhui);
  demain.setDate(demain.getDate() + 1);
  const hier = new Date(aujourdhui);
  hier.setDate(hier.getDate() - 1);

  if (memeJour(d, aujourdhui)) return "Aujourd'hui";
  if (memeJour(d, demain)) return "Demain";
  if (memeJour(d, hier)) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Etat visuel d'un rendez-vous, en mots plutot qu'en code couleur seul. */
function etat(b: CalendarBooking): { texte: string; classes: string } | null {
  if (b.status === "CANCELLED") {
    return { texte: "Annulé", classes: "bg-pos-danger-soft text-pos-danger" };
  }
  if (b.saleId) {
    return { texte: "Encaissé", classes: "bg-pos-accent-soft text-pos-accent" };
  }
  if (b.walkIn) {
    return { texte: "Sans rendez-vous", classes: "bg-pos-highlight text-pos-ink-2" };
  }
  return null;
}

export function PosCalendar({ initialDate, onCreateAt, onOpenBooking }: Props) {
  const [jour, setJour] = useState<Date>(() =>
    initialDate ? new Date(initialDate) : new Date(),
  );
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    const debut = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate());
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 1);

    try {
      const params = new URLSearchParams({
        from: debut.toISOString(),
        to: fin.toISOString(),
      });
      const res = await fetch(`/api/pos/bookings?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      type Raw = {
        id: string;
        status: string;
        walkIn: boolean;
        phantom: boolean;
        createdViaPos: boolean;
        items: Array<{
          slot: { startTime: string; endTime: string } | null;
          offer: { title: string };
        }>;
        customer: { firstName: string | null; lastName: string | null } | null;
        client: { name: string | null; email: string } | null;
        assignedEmployeeId: string | null;
        sale: { id: string } | null;
        createdAt: string;
      };

      const raw = (await res.json()) as Raw[];
      const out: CalendarBooking[] = raw.map((b) => {
        const slot = b.items[0]?.slot;
        const start = slot?.startTime ?? b.createdAt;
        const end =
          slot?.endTime ??
          new Date(new Date(b.createdAt).getTime() + 30 * 60_000).toISOString();
        return {
          id: b.id,
          startTime: start,
          endTime: end,
          status: b.status as CalendarBooking["status"],
          walkIn: b.walkIn,
          phantom: b.phantom,
          createdViaPos: b.createdViaPos,
          customerName: bookingClientName(b.customer, b.client, "") || null,
          serviceName: b.items.map((it) => it.offer.title).join(" + ") || "Walk-in",
          assignedEmployeeId: b.assignedEmployeeId,
          saleId: b.sale?.id ?? null,
        };
      });

      out.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      setBookings(out);
    } finally {
      setChargement(false);
    }
  }, [jour]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Rafraichissement discret : une reservation prise en ligne pendant que le
  // salon regarde son agenda doit finir par apparaitre sans rechargement.
  useEffect(() => {
    const relire = () => {
      if (document.visibilityState === "visible") charger();
    };
    const t = setInterval(relire, 60_000);
    document.addEventListener("visibilitychange", relire);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", relire);
    };
  }, [charger]);

  function decaler(jours: number) {
    setChargement(true);
    setJour((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + jours);
      return n;
    });
  }

  const visibles = bookings.filter((b) => b.status !== "CANCELLED");

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      {/* Navigation entre les jours */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => decaler(-1)}
          aria-label="Jour précédent"
          className="ds-press ds-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline text-prune"
        >
          ‹
        </button>

        <div className="min-w-0 text-center">
          <p className="ds-display truncate text-lg text-prune">{libelleJour(jour)}</p>
          <button
            type="button"
            onClick={() => {
              setChargement(true);
              setJour(new Date());
            }}
            className="ds-focus text-sm text-prune-soft underline"
          >
            Revenir à aujourd&apos;hui
          </button>
        </div>

        <button
          type="button"
          onClick={() => decaler(1)}
          aria-label="Jour suivant"
          className="ds-press ds-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2 border-hairline text-prune"
        >
          ›
        </button>
      </div>

      <button
        type="button"
        onClick={() => onCreateAt(jour)}
        className="ds-press ds-focus mb-4 min-h-[48px] w-full rounded-[var(--radius-pill)] bg-rose text-base font-semibold text-prune"
      >
        + Nouveau rendez-vous
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {chargement ? (
          <p className="text-base text-prune-soft">Chargement…</p>
        ) : visibles.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8 text-center">
            <p className="text-base text-prune">Aucun rendez-vous ce jour-là.</p>
            <p className="mt-1 text-sm text-prune-soft">
              Les réservations prises en ligne apparaissent ici automatiquement.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visibles.map((b) => {
              const e = etat(b);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onOpenBooking(b.id)}
                    className="ds-press ds-focus flex w-full items-center gap-4 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-4 text-left hover:border-rose"
                  >
                    {/* L'heure d'abord et en gras : c'est l'information qu'on
                        cherche en parcourant la liste. */}
                    <span className="shrink-0 text-base font-bold text-prune">
                      {formatHeure(b.startTime)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-prune">
                        {b.customerName ?? "Sans client"}
                      </span>
                      <span className="block truncate text-sm text-prune-soft">
                        {b.serviceName}
                      </span>
                    </span>
                    {e && (
                      <span
                        className={`shrink-0 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold ${e.classes}`}
                      >
                        {e.texte}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
