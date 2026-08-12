import { redirect } from "next/navigation";

export default function ProviderBookingsRedirect() {
  redirect("/pos/calendar");
}
