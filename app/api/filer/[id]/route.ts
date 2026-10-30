import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { kanLaese } from "@/lib/roller";

export const runtime = "nodejs";

/**
 * Henter en fil fra kundens filboks.
 *
 * Kun PDF og almindelige billeder vises direkte i browseren. Alt andet hentes
 * som download, og browseren må ikke gætte filtypen (nosniff) — ellers kunne
 * en uploadet HTML-fil køre som en side i appen.
 */
const VIS_DIREKTE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await hentSession();
  if (!session) return new NextResponse("Ikke logget ind", { status: 401 });
  const r = session.ret;
  if (!kanLaese(r.kunder) && !kanLaese(r.salg)) return new NextResponse("Ingen adgang", { status: 403 });

  const { id } = await params;
  const fil = await db.attachment.findUnique({ where: { id } });
  if (!fil) return new NextResponse("Filen findes ikke", { status: 404 });

  const direkte = VIS_DIREKTE.has(fil.mimeType);
  return new NextResponse(Buffer.from(fil.data), {
    headers: {
      "Content-Type": direkte ? fil.mimeType : "application/octet-stream",
      "Content-Length": String(fil.sizeBytes),
      "Content-Disposition": `${direkte ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fil.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
