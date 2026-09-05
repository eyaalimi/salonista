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
      <head>
        {/* Bricolage Grotesque n'est pas au catalogue de next/font/google dans
            cette version de Next. Un @import dans globals.css ne survit PAS a
            la compilation — le bundler CSS de Next resout les @import au build
            et supprime les distants (verifie sur le CSS servi). D'ou ce <link>,
            que Next preserve, et qui precharge la police plus tot. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* La regle no-page-custom-font vise le Pages Router, ou un <link> dans
            une page ne vaut que pour elle. Ici on est dans le layout RACINE de
            l'App Router : la police est chargee sur toutes les pages. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap"
          rel="stylesheet"
        />
        {/* Instrument Serif porte les titres de la page d'accueil, Noto Kufi
            Arabic sa version arabe. Aucune des deux n'est au catalogue de
            next/font/google dans cette version de Next — meme raison que pour
            Bricolage ci-dessus. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Noto+Kufi+Arabic:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
