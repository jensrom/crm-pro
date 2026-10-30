import type { MetadataRoute } from "next";

/** Gør det muligt at lægge CRM-Pro på hjemmeskærmen og åbne den som en app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRM-Pro",
    short_name: "CRM-Pro",
    description: "Kunder, licenser og salg i ét CRM.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#eff0f1",
    theme_color: "#eff0f1",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
