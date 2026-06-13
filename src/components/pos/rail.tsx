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
    { href: "/pos", label: "Caisse", shortcut: "1", icon: <LayoutGrid size={16} />, perm: "pos.sell" },
    { href: "/pos/calendar", label: "RDV du jour", shortcut: "B", icon: <Calendar size={16} />, perm: "bookings.view" },
    { href: "/pos/services", label: "Services", shortcut: "S", icon: <Scissors size={16} />, perm: "products.manage" },
    { href: "/pos/customers", label: "Clients", shortcut: "C", icon: <Users size={16} />, perm: "customers.view" },
    { href: "/pos/products", label: "Produits", shortcut: "P", icon: <Package size={16} />, perm: "inventory.view" },
  ];

  const items2: RailItem[] = [
    { href: "/pos/sales", label: "Ventes", shortcut: "V", icon: <Receipt size={16} />, perm: "pos.sell" },
    { href: "/pos/cash-drawer", label: "Caisse-fond", shortcut: "F", icon: <Wallet size={16} />, perm: "pos.cash_drawer" },
    { href: "/pos/analytics", label: "Analytique", shortcut: "A", icon: <BarChart3 size={16} />, perm: "analytics.view" },
  ];

  function renderItem(it: RailItem) {
    if (it.perm && !permissions[it.perm]) return null;
    const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href + "/"));
    return (
      <Link
        key={it.href}
        href={it.href}
        title={it.label}
        className={`relative w-11 h-11 rounded-md flex items-center justify-center transition-colors ${
          active
            ? "bg-pos-ink text-pos-bg"
            : "text-pos-ink-2 hover:bg-pos-border/60 hover:text-pos-ink"
        }`}
      >
        {it.icon}
        <span className="absolute bottom-0.5 right-1 text-[8px] text-pos-ink-4 leading-none">
          {it.shortcut}
        </span>
      </Link>
    );
  }

  return (
    <aside className="bg-pos-rail border-r border-pos-border flex flex-col items-center py-3 gap-1 w-[60px]">
      {items.map(renderItem)}
      <div className="my-2 w-6 h-px bg-pos-border-strong" />
      {items2.map(renderItem)}
    </aside>
  );
}
