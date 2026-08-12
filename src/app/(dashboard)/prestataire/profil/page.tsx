import { redirect } from "next/navigation";

export default function ProviderProfileRedirect() {
  redirect("/pos/settings");
}
