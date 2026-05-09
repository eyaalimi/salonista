/**
 * Phase 2 Design 2 — central POS state via Zustand.
 *
 * Replaces a chunk of the old pos-client.tsx local state. Search, cart, and
 * customer state live here so every panel (topbar, results, cart, side) and
 * every keyboard shortcut can reach them without prop-drilling.
 */

import { create } from "zustand";

export type SearchResult = {
  kind: "SERVICE" | "PRODUCT";
  id: string;
  name: string;
  category: string | null;
  subtitle: string | null;
  code: string;
  salePrice: string;
  taxRate: string;
  duration?: number;
  stock?: { quantity: number; threshold: number; status: "ok" | "low" | "out" };
  photo?: string | null;
  score: number;
};

export type CartLine = {
  uid: string;
  kind: "SERVICE" | "PRODUCT";
  offerId?: string;
  productId?: string;
  nameSnapshot: string;
  priceSnapshot: string;
  taxRateSnapshot: string;
  quantity: number;
  discount?: { value: string; isPercent: boolean };
  assignedEmployeeId?: string;
};

export type CustomerLite = {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  wallet?: {
    walletId: string;
    balance: number;
    minPointsToRedeem: number;
    maxRedemptionPctPerSale: number;
    dinarPerPoint: string;
  };
};

export type FilterTab = "ALL" | "SERVICE" | "PRODUCT";
export type SortMode = "relevance" | "price_asc" | "price_desc" | "name_asc";

type State = {
  // Search
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  resultsLoading: boolean;
  filterTab: FilterTab;
  sortBy: SortMode;

  // Cart
  cart: CartLine[];
  saleDiscount: { value: string; isPercent: boolean } | null;
  tipTotal: string;
  cartNote: string;
  receiptNumberPreview: string | null;

  // Customer
  customer: CustomerLite | null;

  // Booking
  attachedBookingId: string | null;
  bookingPrefilledLineUids: string[]; // tracks which cart lines came from the booking

  // UI
  helpOverlayOpen: boolean;
  chargeOpen: boolean;
};

type Actions = {
  // Search
  setQuery: (q: string) => void;
  setResults: (r: SearchResult[]) => void;
  setSelectedIndex: (i: number) => void;
  moveSelection: (delta: number) => void;
  setResultsLoading: (b: boolean) => void;
  setFilterTab: (f: FilterTab) => void;
  cycleSortMode: () => void;

  // Cart
  addLine: (line: CartLine) => void;
  addResultToCart: (r: SearchResult, defaultEmployeeId?: string) => string;
  removeLine: (uid: string) => void;
  updateQty: (uid: string, qty: number) => void;
  setLineEmployee: (uid: string, employeeId?: string) => void;
  setLineDiscount: (uid: string, d?: { value: string; isPercent: boolean }) => void;
  setSaleDiscount: (d: { value: string; isPercent: boolean } | null) => void;
  setTipTotal: (t: string) => void;
  setCartNote: (n: string) => void;
  clearCart: () => void;
  setReceiptNumberPreview: (n: string | null) => void;

  // Customer
  setCustomer: (c: CustomerLite | null) => void;

  // Booking
  attachBooking: (bookingId: string, prefilledLineUids: string[]) => void;
  detachBooking: () => void;

  // UI
  openHelp: () => void;
  closeHelp: () => void;
  setChargeOpen: (b: boolean) => void;
};

export const usePosStore = create<State & Actions>()((set, get) => ({
  query: "",
  results: [],
  selectedIndex: 0,
  resultsLoading: false,
  filterTab: "ALL",
  sortBy: "relevance",

  cart: [],
  saleDiscount: null,
  tipTotal: "0.000",
  cartNote: "",
  receiptNumberPreview: null,

  customer: null,
  attachedBookingId: null,
  bookingPrefilledLineUids: [],

  helpOverlayOpen: false,
  chargeOpen: false,

  setQuery: (q) => set({ query: q, selectedIndex: 0 }),
  setResults: (results) => set({ results, selectedIndex: 0 }),
  setSelectedIndex: (i) => set({ selectedIndex: i }),
  moveSelection: (delta) => {
    const { selectedIndex, results } = get();
    if (results.length === 0) return;
    const next = (selectedIndex + delta + results.length) % results.length;
    set({ selectedIndex: next });
  },
  setResultsLoading: (b) => set({ resultsLoading: b }),
  setFilterTab: (f) => set({ filterTab: f }),
  cycleSortMode: () => {
    const order: SortMode[] = ["relevance", "price_asc", "price_desc", "name_asc"];
    const cur = get().sortBy;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    set({ sortBy: next });
  },

  addLine: (line) => set((s) => ({ cart: [...s.cart, line] })),
  addResultToCart: (r, defaultEmployeeId) => {
    const uid = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const line: CartLine = {
      uid,
      kind: r.kind,
      offerId: r.kind === "SERVICE" ? r.id : undefined,
      productId: r.kind === "PRODUCT" ? r.id : undefined,
      nameSnapshot: r.name,
      priceSnapshot: r.salePrice,
      taxRateSnapshot: r.taxRate,
      quantity: 1,
      assignedEmployeeId: r.kind === "SERVICE" ? defaultEmployeeId : undefined,
    };
    set((s) => ({ cart: [...s.cart, line] }));
    return uid;
  },
  removeLine: (uid) =>
    set((s) => ({
      cart: s.cart.filter((l) => l.uid !== uid),
      bookingPrefilledLineUids: s.bookingPrefilledLineUids.filter((u) => u !== uid),
    })),
  updateQty: (uid, qty) =>
    set((s) => ({
      cart: s.cart.map((l) => (l.uid === uid ? { ...l, quantity: Math.max(1, qty) } : l)),
    })),
  setLineEmployee: (uid, employeeId) =>
    set((s) => ({
      cart: s.cart.map((l) => (l.uid === uid ? { ...l, assignedEmployeeId: employeeId } : l)),
    })),
  setLineDiscount: (uid, d) =>
    set((s) => ({
      cart: s.cart.map((l) => (l.uid === uid ? { ...l, discount: d } : l)),
    })),
  setSaleDiscount: (d) => set({ saleDiscount: d }),
  setTipTotal: (t) => set({ tipTotal: t }),
  setCartNote: (n) => set({ cartNote: n }),
  clearCart: () =>
    set({
      cart: [],
      saleDiscount: null,
      tipTotal: "0.000",
      cartNote: "",
      attachedBookingId: null,
      bookingPrefilledLineUids: [],
      // Drop the customer too — keeping a stale customer on the next
      // sale risks debiting their loyalty wallet for someone else's
      // transaction. Cashiers re-pick the customer per sale.
      customer: null,
    }),
  setReceiptNumberPreview: (n) => set({ receiptNumberPreview: n }),

  setCustomer: (c) => set({ customer: c }),

  attachBooking: (bookingId, prefilledLineUids) =>
    set({ attachedBookingId: bookingId, bookingPrefilledLineUids: prefilledLineUids }),
  detachBooking: () => {
    set((s) => ({
      cart: s.cart.filter((l) => !s.bookingPrefilledLineUids.includes(l.uid)),
      attachedBookingId: null,
      bookingPrefilledLineUids: [],
    }));
  },

  openHelp: () => set({ helpOverlayOpen: true }),
  closeHelp: () => set({ helpOverlayOpen: false }),
  setChargeOpen: (b) => set({ chargeOpen: b }),
}));

// Intentionally NOT exporting a `selectComputedTotals` selector: any selector
// passed to `usePosStore(...)` must return a stable reference for snapshots
// where state is unchanged (React 18's useSyncExternalStore contract). A
// selector that calls `computeTotals(...)` returns a fresh object each time
// → infinite re-render (React error #185). Components subscribe to the raw
// cart fields and call `computeTotals` inside a `useMemo`.
