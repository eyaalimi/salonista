"use client";
import type { ReactNode } from "react";

/**
 * Shared 80mm thermal print container.
 *
 * The thermal-print-root is hidden off-screen at screen media. At print media,
 * we hide every other element in the DOM tree (using `* { display: none }`
 * on `body` then walking the ancestor chain back up to thermal-print-root)
 * and only the thermal content remains visible at the page origin.
 */
export function ThermalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media screen {
          .thermal-print-root {
            position: fixed;
            inset: 0;
            width: 0;
            height: 0;
            overflow: hidden;
            visibility: hidden;
            pointer-events: none;
            z-index: -1;
          }
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 80mm !important;
          }
          /* Hide every direct descendant of body... */
          body > * {
            display: none !important;
          }
          /* ...but show the ancestor chain that contains the receipt.
             Next.js wraps in several divs, so we target any ancestor that
             contains a .thermal-print-root descendant. */
          body:has(.thermal-print-root) > * {
            display: none !important;
          }
          /* Force the receipt itself to render at the top of the page. */
          .thermal-print-root,
          .thermal-print-root * {
            visibility: visible !important;
          }
          .thermal-print-root {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: auto !important;
            bottom: auto !important;
            width: 80mm !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            z-index: 999999 !important;
            background: #fff !important;
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
