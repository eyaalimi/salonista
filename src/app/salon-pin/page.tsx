import { Suspense } from "react";
import SalonPinClient from "./salon-pin-client";

export const metadata = {
  title: "Connexion salon — Salonista",
};

export default function SalonPinPage() {
  return (
    <Suspense fallback={null}>
      <SalonPinClient />
    </Suspense>
  );
}
