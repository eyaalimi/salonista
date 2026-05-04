import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-brand-cream text-brand-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
