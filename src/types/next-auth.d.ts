import { DefaultSession } from "next-auth";
import type { Permission } from "@/lib/permissions";
import type { EmployeeRole } from "@/generated/prisma/enums";

export type EmployeeSessionData = {
  id: string;
  providerId: string;
  role: EmployeeRole;
  displayName: string;
  permissions: Record<Permission, boolean>;
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
    employee?: EmployeeSessionData | null;
  }

  interface User {
    role: string;
    employee?: EmployeeSessionData | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    employee?: EmployeeSessionData | null;
  }
}
