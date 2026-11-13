import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ummah One — city ratings (team)", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
