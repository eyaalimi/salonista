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
    /**
     * Instant (ms) de la derniere validation TOTP d'un SUPERADMIN, recopie du
     * jeton. Absent pour tout autre role. Voir src/lib/superadmin-acces.ts.
     */
    totpValideeA?: number | null;
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
    /**
     * Instant (ms) de la derniere validation TOTP d'un SUPERADMIN.
     *
     * Porte dans le jeton plutot que dans `session.maxAge` : ce projet ne
     * configure aucun `maxAge`, donc les sessions durent 30 jours par defaut.
     * Le raccourcir imposerait une reconnexion quotidienne a TOUS les
     * utilisateurs, salons compris. La fraicheur du superadmin est donc
     * verifiee a part (voir src/lib/superadmin-acces.ts).
     *
     * Absent pour tout autre role — aucune autre connexion n'est touchee.
     */
    totpValideeA?: number | null;
  }
}
