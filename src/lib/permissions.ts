import type { SalonEmployee } from "@/generated/prisma/client";
import type { EmployeeRole } from "@/generated/prisma/enums";

export const PERMISSIONS = [
  "pos.sell",
  "pos.refund",
  "pos.discount",
  "pos.void",
  "pos.cash_drawer",
  "bookings.view",
  "bookings.create",
  "bookings.edit",
  "bookings.cancel",
  "customers.view",
  "customers.edit",
  "inventory.view",
  "inventory.edit",
  "products.manage",
  "analytics.view",
  "rewards.adjust",
  "rewards.settings",
  "employees.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

type PermissionMap = Record<Permission, boolean>;

function makeMap(allowed: Permission[]): PermissionMap {
  const map = {} as PermissionMap;
  for (const p of PERMISSIONS) {
    map[p] = false;
  }
  for (const p of allowed) {
    map[p] = true;
  }
  return map;
}

export const ROLE_DEFAULTS: Record<EmployeeRole, PermissionMap> = {
  OWNER: makeMap([
    "pos.sell",
    "pos.discount",
    "pos.refund",
    "pos.void",
    "pos.cash_drawer",
    "bookings.view",
    "bookings.create",
    "bookings.edit",
    "bookings.cancel",
    "customers.view",
    "customers.edit",
    "inventory.view",
    "inventory.edit",
    "products.manage",
    "analytics.view",
    "rewards.adjust",
    "rewards.settings",
    "employees.manage",
    "settings.manage",
  ]),
  MANAGER: makeMap([
    "pos.sell",
    "pos.discount",
    "pos.refund",
    "pos.void",
    "pos.cash_drawer",
    "bookings.view",
    "bookings.create",
    "bookings.edit",
    "bookings.cancel",
    "customers.view",
    "customers.edit",
    "inventory.view",
    "inventory.edit",
    "products.manage",
    "analytics.view",
    "rewards.adjust",
  ]),
  CASHIER: makeMap([
    "pos.sell",
    "pos.cash_drawer",
    "bookings.view",
    "bookings.create",
    "bookings.edit",
    "bookings.cancel",
    "customers.view",
    "customers.edit",
    "inventory.view",
  ]),
  STYLIST: makeMap([
    "pos.sell",
    "bookings.view",
    "customers.view",
  ]),
};

export function getRoleDefaults(role: EmployeeRole): PermissionMap {
  return { ...ROLE_DEFAULTS[role] };
}

export function mergePermissions(
  role: EmployeeRole,
  override: unknown,
): PermissionMap {
  const base = getRoleDefaults(role);
  if (override && typeof override === "object") {
    for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
      if (PERMISSIONS.includes(key as Permission) && typeof value === "boolean") {
        base[key as Permission] = value;
      }
    }
  }
  return base;
}

export function hasPermission(
  employee: Pick<SalonEmployee, "role" | "permissions">,
  permission: Permission,
): boolean {
  return mergePermissions(employee.role, employee.permissions)[permission] === true;
}
