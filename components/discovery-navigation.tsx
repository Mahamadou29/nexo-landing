"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import type { Locale } from "@/lib/landing-api";
import "./discovery-navigation.css";

export function DiscoveryNavigation({ locale }: { locale: Locale }) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const links = [
    { href: "#possibilites", label: t("Le projet", "About Nexo") },
    { href: "#parcours", label: t("La suite", "What’s next") },
    { href: "#faq", label: "FAQ" },
    { href: "/experience", label: t("Essayer Nexo", "Try Nexo") },
    { href: "#inscription", label: t("M’inscrire", "Join the list") },
  ];
  const items = links.map(({ href, label }) => <Link key={href} href={href} data-signup-link={href === "#inscription" ? "" : undefined} onClick={event => {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }}>{label}</Link>);

  return <div data-discovery-navigation>
    <nav data-discovery-desktop aria-label={t("Navigation principale", "Main navigation")}>{items}</nav>
    <details data-discovery-menu onKeyDown={event => {
      if (event.key === "Escape" && event.currentTarget.open) {
        event.preventDefault();
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label={t("Menu de navigation", "Navigation menu")}><Menu aria-hidden="true" className="size-5" /></summary>
      <nav aria-label={t("Navigation principale", "Main navigation")}>{items}</nav>
    </details>
  </div>;
}
