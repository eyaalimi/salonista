import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { mergePermissions } from "./permissions";
import { verifierPinEmploye } from "./verify-employee-pin";
import { verifierLimite } from "./rate-limit";
import { LIMITE_CONNEXION, messageLimite } from "./rate-limit-decision";
import type { EmployeeSessionData } from "@/types/next-auth";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials, req) {
        // Rien ne ralentissait un essai de mots de passe en masse. Plus
        // permissif que les autres limites : un salon ou une famille derriere
        // une meme IP publique ne doit pas se bloquer en se trompant.
        const ip =
          req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
          req?.headers?.["x-real-ip"] ||
          "inconnue";
        const limite = await verifierLimite(
          `connexion:ip:${ip}`,
          LIMITE_CONNEXION,
        );
        if (!limite.ok) {
          throw new Error(messageLimite(limite.resetDansMs));
        }

        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email et mot de passe requis");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Email ou mot de passe incorrect");
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Email ou mot de passe incorrect");
        }

        if (!user.emailVerified && process.env.REQUIRE_EMAIL_VERIFICATION !== "false") {
          throw new Error("Veuillez vérifier votre email avant de vous connecter");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatar,
        };
      },
    }),
    CredentialsProvider({
      id: "salon-pin",
      name: "Salon PIN",
      credentials: {
        employeeId: { label: "Employé", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.employeeId || !credentials?.pin) {
          throw new Error("Identifiant employé et PIN requis");
        }

        // Verrouillage apres 5 echecs + limite de debit, tous deux persistes
        // en base. Jette « PIN incorrect » ou un message de verrouillage
        // annoncant le delai. Voir verify-employee-pin.ts.
        await verifierPinEmploye(credentials.employeeId, credentials.pin);

        const employee = await prisma.salonEmployee.findUnique({
          where: { id: credentials.employeeId },
          include: {
            provider: { select: { userId: true } },
            user: { select: { email: true } },
          },
        });

        // Defensif : verifierPinEmploye a deja valide son existence.
        if (!employee) {
          throw new Error("PIN incorrect");
        }

        await prisma.salonEmployee.update({
          where: { id: employee.id },
          data: { lastLoginAt: new Date() },
        });

        const permissions = mergePermissions(employee.role, employee.permissions);
        const employeeSession: EmployeeSessionData = {
          id: employee.id,
          providerId: employee.providerId,
          role: employee.role,
          displayName: employee.displayName,
          permissions,
        };

        return {
          id: employee.userId ?? `pin:${employee.id}`,
          email: employee.user?.email ?? employee.email ?? null,
          name: employee.displayName,
          role: "PROVIDER",
          employee: employeeSession,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For Google OAuth, create user if not exists
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              avatar: user.image,
              emailVerified: new Date(),
              role: "CLIENT", // Default role, can be changed later
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
        const maybeEmployee = (user as { employee?: EmployeeSessionData | null }).employee;
        if (maybeEmployee) {
          token.employee = maybeEmployee;
        }
      }
      // PIN-authenticated sessions keep their session role ("PROVIDER") and
      // their employee payload regardless of any underlying User row's role.
      // Without this guard, a cashier whose linked User happens to be a CLIENT
      // would lose PROVIDER access on the first token refresh.
      const isPinSession = !!token.employee || (typeof token.id === "string" && token.id.startsWith("pin:"));
      if (token.id && !isPinSession) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; role: string }).id = token.id as string;
        (session.user as { id: string; role: string }).role = token.role as string;
      }
      session.employee = token.employee ?? null;
      return session;
    },
  },
};
