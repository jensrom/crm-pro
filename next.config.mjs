/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },

  // Filboksen uploader via en almindelig server action. Vercel-funktioner tager
  // højst 4,5 MB pr. request, så grænsen sættes lidt under (se lib/filer.ts).
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
