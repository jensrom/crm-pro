import { NextResponse, type NextRequest } from "next/server";

/**
 * Port foran hele appen. Alt kræver en gyldig, signeret login-cookie —
 * også server actions og /api-ruter — undtagen login og førstegangsopsætning.
 *
 * Kører i Edge-runtime, så signaturen tjekkes med Web Crypto. Selve brugeren
 * (aktiv/spærret, rolle) slås op i databasen af siderne og handlingerne bagefter.
 */
const COOKIE = "crmpro_session";
const AABNE = ["/login", "/opsaetning", "/ingen-adgang"];

async function gyldig(vaerdi: string | undefined) {
  if (!vaerdi) return false;
  const dele = vaerdi.split(".");
  if (dele.length !== 3) return false;
  const [krop, udloeb, signatur] = dele;
  if (!Number.isFinite(Number(udloeb)) || Number(udloeb) * 1000 < Date.now()) return false;

  const hemmelighed = process.env.AUTH_SECRET?.trim() || (process.env.NODE_ENV !== "production" ? "dev-hemmelighed-kun-til-lokal-udvikling-0000" : "");
  if (hemmelighed.length < 32) return false;

  const noegle = await crypto.subtle.importKey("raw", new TextEncoder().encode(hemmelighed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", noegle, new TextEncoder().encode(`${krop}.${udloeb}`));
  const forventet = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (forventet.length !== signatur.length) return false;
  let forskel = 0;
  for (let i = 0; i < forventet.length; i++) forskel |= forventet.charCodeAt(i) ^ signatur.charCodeAt(i);
  return forskel === 0;
}

export async function middleware(req: NextRequest) {
  const sti = req.nextUrl.pathname;
  if (AABNE.some((a) => sti === a || sti.startsWith(a + "/"))) return NextResponse.next();
  if (await gyldig(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (sti.startsWith("/api/")) return new NextResponse("Ikke logget ind", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Alt undtagen Next' egne filer og statiske filer i public/
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt)$).*)"],
};
