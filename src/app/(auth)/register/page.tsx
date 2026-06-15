import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import RegisterClient from "./register-client";

const dashboardByRole: Record<string, string> = {
  PROVIDER: "/prestataire",
  INFLUENCER: "/influenceuse",
  CLIENT: "/cliente",
  ADMIN: "/admin",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const params = await searchParams;
    const callback = params.callbackUrl;
    if (callback && callback.startsWith("/") && !callback.startsWith("//")) {
      redirect(callback);
    }
    const dest = dashboardByRole[session.user.role] || "/";
    redirect(dest);
  }

  return <RegisterClient />;
}
