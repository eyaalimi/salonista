"use client";
import type { ReactNode } from "react";

/**
 * Shared 80mm thermal print container.
 *
 * Wraps children in a print-only frame and injects the @page + @media print
 * CSS once. Receipt, TestTicket, and ZReport all compose primitives below.
 *
 * The CSS hides everything except `.thermal-print-root` when printing,
 * forcing the browser to render only the receipt. The thermal printer
 * paper width is 80mm with no margins; the document grows downward.
 */
export function ThermalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          body > *:not(.thermal-print-root) {
            display: none !important;
          }
          .thermal-print-root {
            display: block !important;
          }
        }
        .thermal-print-root .thermal-doc {
          width: 80mm;
          padding: 5mm;
          font-family: ui-monospace, "Courier New", monospace;
          font-size: 11px;
          color: #000;
          background: #fff;
          line-height: 1.35;
        }
        .thermal-print-root .thermal-row {
          display: flex;
          justify-content: space-between;
        }
        .thermal-print-root hr.thermal-sep {
          border: none;
          border-top: 1px dashed #000;
          margin: 3mm 0;
        }
        .thermal-print-root .thermal-total {
          font-weight: bold;
          font-size: 13px;
        }
        .thermal-print-root .thermal-center {
          text-align: center;
        }
      `}</style>
      <div className="thermal-print-root">
        <div className="thermal-doc">{children}</div>
      </div>
    </>
  );
}

export function ThermalHeader({
  provider,
  title,
}: {
  provider: {
    salonName?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    matriculeFiscal?: string | null;
  } | null;
  title?: string;
}) {
  return (
    <div className="thermal-center">
      <div style={{ fontWeight: "bold", fontSize: 13 }}>
        {provider?.salonName ?? "Salonista"}
      </div>
      {provider?.address && <div>{provider.address}</div>}
      {provider?.city && <div>{provider.city}</div>}
      {provider?.phone && <div>Tél: {provider.phone}</div>}
      {provider?.matriculeFiscal && <div>MF: {provider.matriculeFiscal}</div>}
      {title && (
        <div style={{ marginTop: "2mm", fontWeight: "bold" }}>{title}</div>
      )}
    </div>
  );
}

export function ThermalSeparator() {
  return <hr className="thermal-sep" />;
}

export function ThermalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="thermal-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ThermalTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="thermal-row thermal-total">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ThermalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div style={{ fontWeight: "bold", marginTop: "2mm" }}>{title}</div>
      {children}
    </div>
  );
}

export function ThermalFooter({ text }: { text: string }) {
  return (
    <div className="thermal-center" style={{ marginTop: "3mm", fontSize: 9 }}>
      {text}
    </div>
  );
}
