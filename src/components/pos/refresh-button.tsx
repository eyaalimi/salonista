"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";

/**
 * Bouton « Actualiser » de la caisse.
 *
 * POURQUOI IL EXISTE : installee en `display: standalone`, la PWA n'a pas de
 * barre d'adresse — donc aucun bouton de rechargement. Apres un deploiement,
 * une tablette de comptoir restait sur l'ancienne version sans que la
 * caissiere ait le moindre moyen de la mettre a jour.
 *
 * POURQUOI CE N'EST PAS UN SIMPLE `location.reload()` : le service worker
 * sert `/_next/static/` en CacheFirst pendant 30 jours (voir public/sw.js).
 * Un rechargement nu ramenerait donc du HTML frais accroche a de l'ancien
 * JavaScript — un etat plus casse que celui qu'on voulait reparer. Il faut
 * vider les caches ET reveiller le service worker avant de recharger.
 *
 * GARDE-FOU : la caisse met les ventes hors ligne en file dans IndexedDB.
 * Recharger ne les efface pas, mais on refuse quand meme tant qu'il en reste :
 * la caissiere doit savoir que son travail n'est pas encore parti sur le
 * serveur avant de toucher a l'application. C'est la meme regle que la
 * deconnexion (voir topbar.tsx).
 */
export function RefreshButton({
  variant = "icone",
}: {
  /**
   * `icone` : compact, pour la barre du haut (l'espace y est compte sur
   * telephone). `menu` : pleine largeur et libelle toujours visible, pour le
   * menu du compte — c'est la que l'utilisatrice cherche une action qui
   * concerne l'application entiere, et la qu'on peut ecrire le mot en entier.
   */
  variant?: "icone" | "menu";
} = {}) {
  const [busy, setBusy] = useState(false);

  async function handleRefresh() {
    if (busy) return;
    setBusy(true);

    try {
      // 1) Des ventes attendent-elles encore d'etre envoyees ?
      try {
        const { listPendingSales } = await import("@/lib/pos-offline-db");
        const enAttente = await listPendingSales();
        if (enAttente.length > 0) {
          alert(
            `${enAttente.length} vente(s) ne sont pas encore enregistrées sur le serveur. ` +
              `Reconnecte-toi à Internet et attends la synchronisation avant d'actualiser.`,
          );
          setBusy(false);
          return;
        }
      } catch {
        // IndexedDB indisponible (navigation privee, quota) : on n'empeche
        // pas l'actualisation pour autant, il n'y a alors aucune file.
      }

      // 2) Vider les caches du service worker. C'est ce qui fait tomber le
      //    JavaScript fige en CacheFirst.
      if ("caches" in window) {
        const noms = await caches.keys();
        await Promise.all(noms.map((n) => caches.delete(n)));
      }

      // 3) Aller chercher un nouveau service worker. `update()` contourne le
      //    cache HTTP du navigateur pour /sw.js.
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      }
    } catch {
      // Un echec de purge ne doit pas bloquer : on recharge quand meme, ce
      // sera au pire l'ancienne version — l'etat d'avant le clic.
    }

    // 4) Recharger. `location.replace` plutot que `reload` : on ne veut pas
    //    empiler une entree d'historique a chaque actualisation.
    window.location.replace(window.location.href);
  }

  if (variant === "menu") {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={handleRefresh}
        disabled={busy}
        className="w-full flex items-center gap-2 border-t border-pos-border px-4 py-3 text-sm hover:bg-pos-highlight text-left disabled:opacity-60"
      >
        <RotateCw
          size={16}
          className={busy ? "animate-spin text-pos-ink-3" : "text-pos-ink-3"}
          aria-hidden="true"
        />
        {busy ? "Actualisation…" : "Actualiser l'application"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={busy}
      // 44px de cible tactile : c'est un bouton de comptoir, utilise au
      // pouce sur une tablette.
      className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2.5 text-xs font-medium hover:bg-pos-ink-2 disabled:opacity-60"
      title="Actualiser l'application"
      aria-label="Actualiser l'application"
    >
      <RotateCw size={16} className={busy ? "animate-spin" : undefined} aria-hidden="true" />
      <span className="hidden lg:inline">{busy ? "Actualisation…" : "Actualiser"}</span>
    </button>
  );
}
