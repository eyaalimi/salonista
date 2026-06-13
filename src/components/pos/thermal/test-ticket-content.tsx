"use client";
import {
  ThermalHeader,
  ThermalSeparator,
  ThermalRow,
  ThermalTotal,
  ThermalFooter,
} from "./thermal-layout";

export function TestTicketContent({
  provider,
  employeeName,
}: {
  provider: {
    salonName?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    matriculeFiscal?: string | null;
  } | null;
  employeeName: string;
}) {
  return (
    <>
      <div
        style={{
          border: "2px solid #000",
          padding: "2mm",
          textAlign: "center",
          marginBottom: "3mm",
          fontSize: 14,
          fontWeight: "bold",
        }}
      >
        TICKET TEST — sans valeur
      </div>
      <ThermalHeader provider={provider} />
      <ThermalSeparator />
      <div>Reçu N° TEST</div>
      <div>{new Date().toLocaleString("fr-FR")}</div>
      <div>Caissier·ère : {employeeName}</div>
      <ThermalSeparator />
      <ThermalRow label="1× Brushing" value="25.000" />
      <ThermalRow label="1× Coupe homme" value="15.000" />
      <ThermalSeparator />
      <ThermalTotal label="TOTAL" value="40.000" />
      <ThermalSeparator />
      <ThermalRow label="Espèces" value="40.000" />
      <ThermalFooter text="Si vous voyez ce ticket, votre imprimante est prête." />
    </>
  );
}
