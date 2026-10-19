import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM-Pro",
  description: "Salg og teknik i ét CRM — kunder, licenser, pipeline, ordrer og sager.",
  applicationName: "CRM-Pro",
  appleWebApp: { capable: true, title: "CRM-Pro", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// Mobil: fuld skærmbredde, ind under notch/hjem-linje (safe-area håndteres i layoutet),
// og en browserlinje der matcher baggrunden i både lys og mørk tilstand.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff0f1" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1c1e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
