"use client";

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
} from "lucide-react";

type Permission = string;

type RailItem = {
  href: string;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  perm?: Permission;
};

export function Rail({ permissions }: { permissions: Record<Permission, boolean> }) {
  const pathname = usePathname();

  const items: RailItem[] = [
    { href: "/pos", label: "Caisse", shortcut: "1", icon: <LayoutGrid size={20} />, perm: "pos.sell" },
    { href: "/pos/calendar", label: "RDV", shortcut: "B", icon: <Calendar size={20} />, perm: "bookings.view" },
    { href: "/pos/services", label: "Services", shortcut: "S", icon: <Scissors size={20} />, perm: "products.manage" },
    { href: "/pos/customers", label: "Clients", shortcut: "C", icon: <Users size={20} />, perm: "customers.view" },
    { href: "/pos/products", label: "Produits", shortcut: "P", icon: <Package size={20} />, perm: "inventory.view" },
  ];

  const items2: RailItem[] = [
    { href: "/pos/sales", label: "Ventes", shortcut: "V", icon: <Receipt size={20} />, perm: "pos.sell" },
    { href: "/pos/cash-drawer", label: "Tiroir", shortcut: "F", icon: <Wallet size={20} />, perm: "pos.cash_drawer" },
    { href: "/pos/loyalty", label: "Fidélité", shortcut: "L", icon: <Star size={20} />, perm: "rewards.adjust" },
    { href: "/pos/commissions", label: "Commissions", shortcut: "M", icon: <Coins size={20} />, perm: "employees.manage" },
    { href: "/pos/employees", label: "Équipe", shortcut: "E", icon: <UserCog size={20} />, perm: "employees.manage" },
    { href: "/pos/analytics", label: "Stats", shortcut: "A", icon: <BarChart3 size={20} />, perm: "analytics.view" },
  ];

  function renderItem(it: RailItem) {
    if (it.perm && !permissions[it.perm]) return null;
    const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href + "/"));
    return (
      <Link
        key={it.href}
        href={it.href}
        title={`${it.label} (${it.shortcut})`}
        className={`group relative shrink-0 md:w-16 w-[68px] px-1 py-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
          active
            ? "bg-pos-accent text-white"
            : "text-pos-ink-2 hover:bg-pos-border/60 hover:text-pos-ink"
        }`}
      >
        <span className="flex items-center justify-center">
          {it.icon}
        </span>
        <span
          className={`text-[11px] leading-none font-medium text-center ${
            active ? "text-white" : "text-pos-ink-2 group-hover:text-pos-ink"
          }`}
        >
          {it.label}
        </span>
      </Link>
    );
  }

  return (
    <aside
      className={
        // Desktop: vertical side rail. Mobile: horizontal bottom bar, scrollable.
        "bg-pos-rail flex md:flex-col flex-row items-center " +
        "md:w-[80px] w-full md:h-auto shrink-0 " +
        "md:border-r md:border-b-0 border-t border-pos-border " +
        "md:py-3 md:px-0 px-2 py-1.5 md:gap-1 gap-1 " +
        "md:overflow-y-auto overflow-x-auto overflow-y-hidden"
      }
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
    >
      {items.map(renderItem)}
      <div className="md:my-2 md:mx-0 mx-1 md:w-8 md:h-px w-px h-8 bg-pos-border-strong shrink-0" />
      {items2.map(renderItem)}
    </aside>
  );
}
