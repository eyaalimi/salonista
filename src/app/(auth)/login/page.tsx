import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LoginClient from "./login-client";

const dashboardByRole: Record<string, string> = {
  PROVIDER: "/prestataire",
  INFLUENCER: "/influenceuse",
  CLIENT: "/cliente",
  ADMIN: "/admin",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);

  // If the user is already signed in, skip the login form and send them to
  // their dashboard (or to the requested callback URL).
  if (session?.user) {
    const params = await searchParams;
    const callback = params.callbackUrl;
    if (callback && callback.startsWith("/") && !callback.startsWith("//")) {
      redirect(callback);
    }
    const dest = dashboardByRole[session.user.role] || "/";
    redirect(dest);
  }

  return <LoginClient />;
}
