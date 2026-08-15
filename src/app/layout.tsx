import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Playfair_Display } from "next/font/google";
import { Archivo } from "next/font/google";
import { Providers } from "@/components/providers";
import { BottomNav } from "@/components/bottom-nav";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "https://salonista.tn"),
  title: {
    default: "Salonista",
    template: "%s — Salonista",
  },
  description:
    "Réservez vos soins beauté en ligne. Coiffure, esthétique, onglerie, massage — partout en Tunisie.",
  keywords: [
    "salonista", "beauté tunisie", "salon de beauté", "coiffure tunis",
    "esthétique tunisie", "offres beauté", "réservation salon", "onglerie",
    "massage tunisie", "soins beauté",
  ],
  authors: [{ name: "Salonista" }],
  openGraph: {
    type: "website",
    locale: "fr_TN",
    siteName: "Salonista",
    title: "Salonista",
    description:
      "Réservez vos soins beauté en ligne, partout en Tunisie.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Salonista",
    description:
      "Réservez vos soins beauté en ligne, partout en Tunisie.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Salonista POS",
  },
  icons: {
    // Google n'accepte PAS les favicons SVG pour les resultats de recherche :
    // sans variante matricielle, il affiche un globe gris a la place du logo.
    // Les PNG carres de la PWA font l'affaire, ils sont deja servis.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/pwa-180-apple.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1F1A1C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${playfair.variable} ${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-brand-cream text-brand-ink">
        <Providers>
          <main className="flex-1 pb-[76px] md:pb-0">{children}</main>
          <BottomNav />
          <SwRegister />
        </Providers>
      </body>
    </html>
  );
}
