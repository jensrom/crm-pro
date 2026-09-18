import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM-Pro — Idus Online DK & FO",
  description: "Lokalt CRM over danske og færøske Idus Online-kunder, deres pakker og potentiale.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
