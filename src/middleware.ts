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

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/prestataire/:path*", "/influenceuse/:path*", "/cliente/:path*", "/admin/:path*"],
};
