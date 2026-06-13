"use client";
import { useEffect } from "react";
import { ThermalLayout } from "./thermal-layout";
import { TestTicketContent } from "./test-ticket-content";

export function TestTicketPrintFrame({
  provider,
  employeeName,
}: {
  provider: {
    salonName: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    matriculeFiscal: string | null;
  } | null;
  employeeName: string;
}) {
  useEffect(() => {
    const id = setTimeout(() => {
      window.print();
    }, 200);
    return () => clearTimeout(id);
  }, []);

  return (
    <ThermalLayout>
      <TestTicketContent provider={provider} employeeName={employeeName} />
    </ThermalLayout>
  );
}
