/**
 * Predefined service + product catalogs surfaced during onboarding.
 *
 * The salon picks a `salonType` (mapped to Category enum) at step 1; subsequent
 * steps filter their predefined lists to the matching catalog so a barber
 * never sees "manucure" and a nail bar never sees "shampooing".
 *
 * Each entry includes a sensible default price in TND (millimes precision).
 * The user can adjust per-line before saving.
 */

export type SalonType = {
  value: string; // Category enum value
  label: string;
  emoji: string;
};

export const SALON_TYPES: SalonType[] = [
  { value: "COIFFURE", label: "Coiffure", emoji: "💇" },
  { value: "ESTHETIQUE", label: "Esthétique", emoji: "💆" },
  { value: "ONGLERIE", label: "Onglerie", emoji: "💅" },
  { value: "MASSAGE", label: "Spa & Massage", emoji: "🧖" },
  { value: "PARFUMERIE", label: "Parfumerie", emoji: "🌸" },
  { value: "AUTRE", label: "Autre", emoji: "✨" },
];

export type ServicePreset = {
  title: string;
  durationMinutes: number;
  price: string; // DT
  taxRate?: string; // %, defaults to 19
};

export const SERVICE_PRESETS: Record<string, ServicePreset[]> = {
  COIFFURE: [
    { title: "Coupe femme", durationMinutes: 45, price: "35.000" },
    { title: "Coupe homme", durationMinutes: 20, price: "15.000" },
    { title: "Coupe enfant", durationMinutes: 20, price: "12.000" },
    { title: "Brushing", durationMinutes: 30, price: "25.000" },
    { title: "Coloration", durationMinutes: 90, price: "80.000" },
    { title: "Balayage / Mèches", durationMinutes: 120, price: "120.000" },
    { title: "Shampooing", durationMinutes: 15, price: "10.000" },
    { title: "Soin capillaire", durationMinutes: 45, price: "40.000" },
    { title: "Lissage", durationMinutes: 120, price: "150.000" },
    { title: "Chignon / Coiffure mariée", durationMinutes: 60, price: "80.000" },
    { title: "Barbe", durationMinutes: 15, price: "10.000" },
    { title: "Rasage traditionnel", durationMinutes: 25, price: "15.000" },
  ],
  ESTHETIQUE: [
    { title: "Soin visage", durationMinutes: 60, price: "60.000" },
    { title: "Nettoyage de peau", durationMinutes: 45, price: "45.000" },
    { title: "Épilation sourcils", durationMinutes: 15, price: "10.000" },
    { title: "Épilation lèvres", durationMinutes: 10, price: "8.000" },
    { title: "Épilation jambes complètes", durationMinutes: 45, price: "35.000" },
    { title: "Épilation maillot", durationMinutes: 20, price: "20.000" },
    { title: "Épilation aisselles", durationMinutes: 15, price: "10.000" },
    { title: "Maquillage soirée", durationMinutes: 45, price: "60.000" },
    { title: "Maquillage mariée", durationMinutes: 90, price: "150.000" },
    { title: "Pose de cils", durationMinutes: 60, price: "80.000" },
    { title: "Teinture cils/sourcils", durationMinutes: 20, price: "20.000" },
  ],
  ONGLERIE: [
    { title: "Manucure simple", durationMinutes: 30, price: "20.000" },
    { title: "Manucure semi-permanent", durationMinutes: 45, price: "40.000" },
    { title: "Pose vernis", durationMinutes: 15, price: "10.000" },
    { title: "Pédicure simple", durationMinutes: 45, price: "30.000" },
    { title: "Pédicure semi-permanent", durationMinutes: 60, price: "45.000" },
    { title: "Pose d'ongles en gel", durationMinutes: 90, price: "70.000" },
    { title: "Pose d'ongles en résine", durationMinutes: 90, price: "70.000" },
    { title: "Remplissage", durationMinutes: 60, price: "50.000" },
    { title: "Dépose", durationMinutes: 30, price: "20.000" },
    { title: "Nail art / Décor", durationMinutes: 20, price: "15.000" },
  ],
  MASSAGE: [
    { title: "Massage relaxant 30 min", durationMinutes: 30, price: "40.000" },
    { title: "Massage relaxant 60 min", durationMinutes: 60, price: "70.000" },
    { title: "Massage 90 min", durationMinutes: 90, price: "100.000" },
    { title: "Massage du dos", durationMinutes: 30, price: "40.000" },
    { title: "Massage pieds", durationMinutes: 30, price: "35.000" },
    { title: "Massage pierres chaudes", durationMinutes: 60, price: "90.000" },
    { title: "Gommage corps", durationMinutes: 45, price: "60.000" },
    { title: "Enveloppement", durationMinutes: 60, price: "80.000" },
    { title: "Hammam", durationMinutes: 60, price: "50.000" },
  ],
  PARFUMERIE: [
    { title: "Conseil personnalisé", durationMinutes: 20, price: "0.000" },
    { title: "Test olfactif", durationMinutes: 15, price: "0.000" },
    { title: "Emballage cadeau", durationMinutes: 10, price: "5.000" },
  ],
  AUTRE: [
    { title: "Prestation 30 min", durationMinutes: 30, price: "30.000" },
    { title: "Prestation 60 min", durationMinutes: 60, price: "50.000" },
  ],
};

export type ProductPreset = {
  name: string;
  category: string;
  defaultStock: number;
  salePrice: string;
};

export const PRODUCT_PRESETS: Record<string, ProductPreset[]> = {
  COIFFURE: [
    { name: "Shampooing professionnel", category: "Capillaire", defaultStock: 12, salePrice: "45.000" },
    { name: "Après-shampooing", category: "Capillaire", defaultStock: 10, salePrice: "40.000" },
    { name: "Masque capillaire", category: "Capillaire", defaultStock: 8, salePrice: "55.000" },
    { name: "Huile d'argan", category: "Capillaire", defaultStock: 10, salePrice: "60.000" },
    { name: "Sérum lissant", category: "Capillaire", defaultStock: 6, salePrice: "70.000" },
    { name: "Spray protecteur de chaleur", category: "Capillaire", defaultStock: 6, salePrice: "50.000" },
    { name: "Laque", category: "Capillaire", defaultStock: 8, salePrice: "35.000" },
    { name: "Cire coiffante", category: "Capillaire", defaultStock: 6, salePrice: "40.000" },
  ],
  ESTHETIQUE: [
    { name: "Crème hydratante visage", category: "Visage", defaultStock: 10, salePrice: "65.000" },
    { name: "Sérum anti-âge", category: "Visage", defaultStock: 6, salePrice: "120.000" },
    { name: "Lotion tonique", category: "Visage", defaultStock: 8, salePrice: "45.000" },
    { name: "Gommage visage", category: "Visage", defaultStock: 6, salePrice: "50.000" },
    { name: "Masque purifiant", category: "Visage", defaultStock: 8, salePrice: "55.000" },
    { name: "Crème solaire SPF 50", category: "Protection", defaultStock: 10, salePrice: "70.000" },
    { name: "Lait corporel", category: "Corps", defaultStock: 8, salePrice: "55.000" },
  ],
  ONGLERIE: [
    { name: "Vernis classique", category: "Vernis", defaultStock: 30, salePrice: "15.000" },
    { name: "Vernis semi-permanent", category: "Vernis", defaultStock: 25, salePrice: "25.000" },
    { name: "Base coat", category: "Vernis", defaultStock: 8, salePrice: "20.000" },
    { name: "Top coat", category: "Vernis", defaultStock: 8, salePrice: "20.000" },
    { name: "Dissolvant", category: "Soin", defaultStock: 10, salePrice: "15.000" },
    { name: "Huile pour cuticules", category: "Soin", defaultStock: 6, salePrice: "25.000" },
    { name: "Crème mains", category: "Soin", defaultStock: 8, salePrice: "30.000" },
  ],
  MASSAGE: [
    { name: "Huile de massage", category: "Massage", defaultStock: 8, salePrice: "55.000" },
    { name: "Bougie de massage", category: "Massage", defaultStock: 6, salePrice: "65.000" },
    { name: "Sel de bain", category: "Bien-être", defaultStock: 10, salePrice: "30.000" },
    { name: "Huile essentielle (lavande)", category: "Bien-être", defaultStock: 6, salePrice: "40.000" },
  ],
  PARFUMERIE: [
    { name: "Eau de parfum 50ml", category: "Parfum", defaultStock: 5, salePrice: "250.000" },
    { name: "Eau de toilette 100ml", category: "Parfum", defaultStock: 5, salePrice: "180.000" },
    { name: "Coffret cadeau", category: "Parfum", defaultStock: 3, salePrice: "300.000" },
  ],
  AUTRE: [],
};
