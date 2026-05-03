"use client";

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  status: string;
  paymentStatus: string;
  totalPrice: string;
  createdAt: string;
  notes: string | null;
  qrCode: string | null;
  qrVerified: boolean;
  client: { name: string | null; email: string };
  items: { offer: { title: string }; slot: { startTime: string } }[];
  commission: { providerAmount: string; status: string } | null;
}

export default function ProviderReservationsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [scanCode, setScanCode] = useState("");
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; data?: Record<string, unknown> } | null>(null);
  const [scanning, setScanning] = useState(false);

  async function verifyQR() {
    if (!scanCode.trim()) return;
    setScanning(true);
    setScanResult(null);
    const res = await fetch("/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: scanCode.trim() }),
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      setScanResult({
        success: true,
        message: data.alreadyVerified ? "Deja verifie" : "Client verifie avec succes",
        data: data.booking,
      });
      await loadBookings();
    } else {
      setScanResult({ success: false, message: data.error || "Code invalide" });
    }
    setScanning(false);
  }

  async function loadBookings() {
    const res = await fetch("/api/provider/bookings");
    if (res.ok) setBookings(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/provider/bookings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadBookings();
  }

  const filtered = filter === "ALL" ? bookings : bookings.filter((b) => b.status === filter);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="luxury-badge mb-3">Gestion</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Reservations</h1>
      </div>

      {/* QR Scanner */}
      <div className="bg-white border border-brand-gold/20 p-6 mb-8">
        <p className="text-[10px] tracking-[0.15em] uppercase text-brand-bordeaux/40 mb-4">Verification QR code client</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            placeholder="Entrez le code QR (ex: BT-...)"
            className="flex-1 px-4 py-3 border border-brand-gold/20 bg-transparent text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/20 focus:outline-none focus:border-brand-gold transition-colors font-mono"
            onKeyDown={(e) => e.key === "Enter" && verifyQR()}
          />
          <button
            onClick={verifyQR}
            disabled={scanning || !scanCode.trim()}
            className="px-6 py-3 text-xs tracking-[0.15em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500 disabled:opacity-50"
          >
            {scanning ? "..." : "Verifier"}
          </button>
        </div>
        {scanResult && (
          <div className={`mt-4 p-4 border ${scanResult.success ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
            <p className={`text-xs tracking-wider font-medium ${scanResult.success ? "text-emerald-700" : "text-red-600"}`}>
              {scanResult.message}
            </p>
            {scanResult.data && (
              <div className="mt-2 text-xs text-brand-bordeaux/60 space-y-1">
                <p>Client : {String(scanResult.data.clientName || scanResult.data.clientEmail)}</p>
                <p>Service : {String(scanResult.data.offerTitle)}</p>
                <p>Montant : {Number(scanResult.data.totalPrice).toFixed(0)} DT</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {[
          { value: "ALL", label: "Toutes" },
          { value: "PENDING", label: "En attente" },
          { value: "CONFIRMED", label: "Confirmees" },
          { value: "COMPLETED", label: "Terminees" },
          { value: "CANCELLED", label: "Annulees" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors duration-500 ${
              filter === f.value
                ? "bg-brand-bordeaux text-white"
                : "border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-brand-gold/20 p-16 text-center">
          <p className="text-brand-bordeaux/40 text-sm">Aucune reservation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white border border-brand-gold/20 p-6 hover:border-brand-gold transition-colors duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="luxury-heading text-lg text-brand-bordeaux">{b.items.map((i) => i.offer.title).join(", ")}</h3>
                  <p className="text-sm text-brand-bordeaux/50 mt-1">
                    {b.client.name || b.client.email}
                    {b.items[0]?.slot && ` · ${new Date(b.items[0].slot.startTime).toLocaleDateString("fr-TN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}`}
                  </p>
                  {b.notes && <p className="text-xs text-brand-bordeaux/30 mt-2">Note : {b.notes}</p>}
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <span className="luxury-heading text-xl text-brand-bordeaux">{Number(b.totalPrice).toFixed(0)} DT</span>
                  {b.paymentStatus === "PAID" && (
                    <span className={`px-2 py-0.5 border text-[9px] tracking-[0.1em] uppercase font-medium ${
                      b.qrVerified ? "border-emerald-300 text-emerald-700" : "border-brand-gold text-brand-gold"
                    }`}>
                      {b.qrVerified ? "QR verifie" : "Paye en ligne"}
                    </span>
                  )}
                  {b.paymentStatus === "UNPAID" && b.status !== "CANCELLED" && (
                    <span className="px-2 py-0.5 border border-amber-300 text-[9px] tracking-[0.1em] uppercase font-medium text-amber-600">
                      Non paye
                    </span>
                  )}
                  <StatusBadge status={b.status} />
                </div>
              </div>
              {b.status === "PENDING" && (
                <div className="flex gap-3 mt-5 pt-5 border-t border-brand-gold/15">
                  <button
                    onClick={() => updateStatus(b.id, "CONFIRMED")}
                    className="px-6 py-2.5 text-xs tracking-[0.15em] uppercase bg-brand-bordeaux text-white hover:bg-brand-gold transition-colors duration-500"
                  >
                    Confirmer
                  </button>
                  <button
                    onClick={() => updateStatus(b.id, "CANCELLED")}
                    className="px-6 py-2.5 text-xs tracking-[0.15em] uppercase border border-red-300 text-red-600 hover:bg-red-50 transition-colors duration-500"
                  >
                    Annuler
                  </button>
                </div>
              )}
              {b.status === "CONFIRMED" && (
                <div className="flex gap-3 mt-5 pt-5 border-t border-brand-gold/15">
                  <button
                    onClick={() => updateStatus(b.id, "COMPLETED")}
                    className="px-6 py-2.5 text-xs tracking-[0.15em] uppercase bg-emerald-700 text-white hover:bg-emerald-800 transition-colors duration-500"
                  >
                    Marquer termine
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "border-amber-300 text-amber-700",
    CONFIRMED: "border-blue-300 text-blue-700",
    COMPLETED: "border-emerald-300 text-emerald-700",
    CANCELLED: "border-red-300 text-red-700",
  };
  const labels: Record<string, string> = {
    PENDING: "En attente",
    CONFIRMED: "Confirme",
    COMPLETED: "Termine",
    CANCELLED: "Annule",
  };
  return (
    <span className={`px-3 py-1 border text-[10px] tracking-[0.1em] uppercase font-medium ${styles[status] || "border-gray-300 text-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}
