"use client";
import { Discovery } from "@/components/discovery";
import { useLanding } from "@/components/landing-provider";
export function DiscoveryPage() { const { locale } = useLanding(); return <Discovery locale={locale} />; }
