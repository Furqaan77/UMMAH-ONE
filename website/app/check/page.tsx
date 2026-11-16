import type { Metadata } from "next";
import GuideCheck from "@/components/GuideCheck";
import { cityGuides } from "@/lib/guide-check/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ummah One — help check the guide", robots: { index: false, follow: false } };

export default function CheckPage() {
  return <GuideCheck cities={cityGuides()} />;
}
