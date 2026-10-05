import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Role-based route protection
    if (pathname.startsWith("/prestataire") && token?.role !== "PROVIDER" && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/influenceuse") && token?.role !== "INFLUENCER" && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/cliente") && token?.role !== "CLIENT" && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    /*
     * SUPERADMIN n'est PAS un ADMIN superieur : un ADMIN est refuse ici, et
     * ce role n'ouvre rien sur /admin. Les comptes ADMIN existent depuis le
     * debut du projet ; les laisser entrer ferait de chacun d'eux un acces
     * fondateur.
     *
     * Cette garde est la PREMIERE des trois, pas la seule : chaque page et
     * chaque route de /superadmin rappelle `exigerSuperadmin()`, qui verifie
     * en plus la double authentification et sa fraicheur. Le `matcher`
     * ci-dessous est une liste blanche de prefixes — une route qui y
     * echapperait ne serait pas filtree ici du tout.
     */
    // `startsWith("/superadmin")` couvre AUSSI /superadmin-acces, la page
    // d'enrolement et de validation du code. Elle doit l'etre : elle expose
    // un QR de 2FA.
    if (pathname.startsWith("/superadmin") && token?.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/prestataire/:path*",
    "/influenceuse/:path*",
    "/cliente/:path*",
    "/admin/:path*",
    // `/superadmin` ET ses sous-routes : les deux entrees sont necessaires.
    // `/superadmin/:path*` seul ne couvrirait PAS `/superadmin` lui-meme.
    "/superadmin",
    "/superadmin/:path*",
    // La page d'enrolement / validation du code, hors du layout garde.
    "/superadmin-acces",
  ],
};
