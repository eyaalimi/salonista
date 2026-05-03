import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const dashboardByRole: Record<string, string> = {
  PROVIDER: "/prestataire",
  INFLUENCER: "/influenceuse",
  CLIENT: "/cliente",
  ADMIN: "/admin",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));
  }
  const dest = dashboardByRole[session.user.role] || "/";
  return NextResponse.redirect(new URL(dest, process.env.NEXTAUTH_URL));
}
