/** @type {import('next').NextConfig} */
const standalone = process.env.CRMPRO_STANDALONE === "1";

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },

  // Filboksen uploader via en almindelig server action (<form action={...}>).
  // Standardgraensen er 1 MB -- alt for lille til kontrakter og mødereferater.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },

  // Standalone-udgaven bruges kun når appen pakkes til en exe. Den almindelige
  // "npm run app" er uændret, så den daglige brug ikke afhænger af pakningen.
  ...(standalone ? { output: "standalone" } : {}),

  // Den genererede Prisma-klient og motoren er binære filer som Next ikke selv
  // opdager. Selve @prisma/client finder sporingen fint — den skal ikke tvinges
  // med, for så følger 70 MB runtime-varianter til platforme vi ikke bruger.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/client/**",
      "./prisma/schema.prisma",
      "./prisma/init.sql",
      "./data/kunder.json",
    ],
  },

  // Ting der aldrig bliver brugt i den pakkede app.
  outputFileTracingExcludes: {
    "**/*": [
      "node_modules/typescript/**/*",
      "node_modules/@img/**/*",
      "node_modules/sharp/**/*",
      "node_modules/caniuse-lite/**/*",
      "node_modules/@prisma/engines/**/*",
      "node_modules/@prisma/client/runtime/*react-native*",
      "node_modules/@prisma/client/runtime/*wasm*",
    ],
  },
};

export default nextConfig;
