"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Calendar,
  Scissors,
  Users,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  UserCog,
  Star,
  Coins,
  Settings,
  Handshake,
  ShoppingBag,
  Lock,
} from "lucide-react";
import type { SubscriptionModule } from "@/generated/prisma/enums";

type Permission = string;

type RailItem = {
  href: string;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  perm?: Permission;
  /**
   * Fonctionnalite pas encore livree : l'entree s'affiche grisee avec un
   * cadenas et mene a une page teaser. Elle ignore volontairement le filtre
   * de permission — l'offre commerciale doit etre visible par tous, pas
   * seulement par le proprietaire.
   */
  locked?: boolean;
  /**
   * Module requis pour que l'entree soit utile. Sans lui, l'entree est
   * masquee : mieux vaut ne rien montrer qu'un lien vers un mur.
   */
  module?: SubscriptionModule;
};

export function Rail({
  permissions,
  activeModules,
}: {
  permissions: Record<Permission, boolean>;
  activeModules: SubscriptionModule[];
}) {
  const pathname = usePathname();

  // Groupe 1 — CAISSE : le quotidien de la caissiere.
  //
  // « Mon salon » ouvre la marche : c'est la vue d'ensemble que la
  // proprietaire consulte en arrivant, avant meme d'encaisser.
  const groupCaisse: RailItem[] = [
    { href: "/pos/analytics", label: "Mon salon", shortcut: "A", icon: <BarChart3 size={20} />, perm: "analytics.view" },
    { href: "/pos", label: "Caisse", shortcut: "1", icon: <LayoutGrid size={20} />, perm: "pos.sell", module: "POS" },
    { href: "/pos/calendar", label: "RDV", shortcut: "B", icon: <Calendar size={20} />, perm: "bookings.view" },
    { href: "/pos/customers", label: "Clients", shortcut: "C", icon: <Users size={20} />, perm: "customers.view" },
  ];

  // Groupe 2 — CATALOGUE : ce que le salon vend.
  const groupCatalogue: RailItem[] = [
    { href: "/pos/services", label: "Services", shortcut: "S", icon: <Scissors size={20} />, perm: "products.manage" },
    { href: "/pos/products", label: "Produits", shortcut: "P", icon: <Package size={20} />, perm: "inventory.view", module: "POS" },
  ];

  // Groupe 3 — GESTION : ce que le proprietaire consulte.
  const groupGestion: RailItem[] = [
    { href: "/pos/sales", label: "Ventes", shortcut: "V", icon: <Receipt size={20} />, perm: "pos.sell", module: "POS" },
    { href: "/pos/cash-drawer", label: "Tiroir", shortcut: "F", icon: <Wallet size={20} />, perm: "pos.cash_drawer", module: "POS" },
    { href: "/pos/loyalty", label: "Fidélité", shortcut: "L", icon: <Star size={20} />, perm: "rewards.adjust" },
    { href: "/pos/commissions", label: "Commissions", shortcut: "M", icon: <Coins size={20} />, perm: "employees.manage", module: "POS" },
    { href: "/pos/employees", label: "Équipe", shortcut: "E", icon: <UserCog size={20} />, perm: "employees.manage", module: "POS" },
    { href: "/pos/settings", label: "Profil", shortcut: "R", icon: <Settings size={20} />, perm: "settings.manage" },
  ];

  // Groupe 4 — VERROUILLE : teasing commercial.
  const groupLocked: RailItem[] = [
    { href: "/pos/collab", label: "Collab", shortcut: "", icon: <Handshake size={20} />, locked: true },
    { href: "/pos/store", label: "Store", shortcut: "", icon: <ShoppingBag size={20} />, locked: true },
    // Seulement pour les salons sans le module : un salon qui paie deja la
    // caisse ne doit pas voir une publicite pour ce qu'il possede.
    ...(activeModules.includes("POS")
      ? []
      : [
          {
            href: "/pos/caisse-offre",
            label: "Caisse",
            shortcut: "",
            icon: <Wallet size={20} />,
            locked: true,
          } as RailItem,
        ]),
  ];

  function renderItem(it: RailItem) {
    if (it.perm && !it.locked && !permissions[it.perm]) return null;
    if (it.module && !activeModules.includes(it.module)) return null;
    const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href + "/"));

    return (
      <Link
        key={it.href}
        href={it.href}
        title={it.locked ? `${it.label} — bientôt disponible` : `${it.label}${it.shortcut ? ` (${it.shortcut})` : ""}`}
        aria-label={it.label}
        className={`group relative shrink-0 w-full flex flex-col items-center justify-center gap-1 rounded-lg transition-colors md:px-1 md:py-2 px-0 py-2.5 ${
          active
            ? "bg-pos-accent text-white"
            : it.locked
              ? "text-pos-ink-3 opacity-60 hover:opacity-100 hover:bg-pos-border/40"
              : "text-pos-ink-2 hover:bg-pos-border/60 hover:text-pos-ink"
        }`}
      >
        <span className="relative flex items-center justify-center">
          {it.icon}
          {it.locked && (
            <span className="absolute -bottom-1 -right-1.5 rounded-full bg-pos-rail p-[1px]">
              <Lock size={11} className="text-pos-ink-3" />
            </span>
          )}
        </span>
        {/* Sur mobile le libelle est masque visuellement mais reste lisible
            par les lecteurs d'ecran ; le title couvre l'appui long. */}
        <span
          className={`text-[11px] leading-none font-medium text-center md:not-sr-only sr-only ${
            active ? "text-white" : it.locked ? "text-pos-ink-3" : "text-pos-ink-2 group-hover:text-pos-ink"
          }`}
        >
          {it.label}
        </span>
      </Link>
    );
  }

  const separator = (key: string) => (
    <div key={key} className="my-2 h-px w-8 shrink-0 bg-pos-border-strong" />
  );

  const groups = [groupCaisse, groupCatalogue, groupGestion, groupLocked]
    .map((g) => g.map(renderItem).filter(Boolean))
    .filter((g) => g.length > 0);

  return (
    <aside
      className="flex h-full shrink-0 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden border-r border-pos-border bg-pos-rail md:w-[80px] w-[56px] md:px-2 px-1 py-3"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      aria-label="Navigation principale"
    >
      {groups.map((g, i) => (
        <Fragment key={i}>
          {i > 0 && separator(`sep-${i}`)}
          {g}
        </Fragment>
      ))}
    </aside>
  );
}
