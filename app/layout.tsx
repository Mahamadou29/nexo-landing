import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LandingProvider } from "@/components/landing-provider";

const lexend = localFont({
  src: "../public/fonts/Lexend-Variable.ttf",
  variable: "--font-lexend",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Nexo — Un peu d’espace pour toi",
  description: "Découvrir Nexo ou prendre un instant pour soi. Deux portes, une expérience à ton rythme, et une liste d’attente facultative.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${lexend.variable} antialiased`}>
      <body className="flex min-h-svh flex-col font-sans"><LandingProvider>{children}</LandingProvider></body>
    </html>
  );
}
