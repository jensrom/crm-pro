import { NextResponse } from "next/server";
import { hentSession } from "@/lib/auth";
import { ordrePdf } from "@/lib/ordre-pdf";

export const runtime = "nodejs";

/** Ordrebekræftelsen som PDF — genskabes altid ud fra den gemte ordre. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await hentSession();
  if (!session) return new NextResponse("Ikke logget ind", { status: 401 });
  const { id } = await params;
  const r = await ordrePdf(id);
  if (!r) return new NextResponse("Ordren findes ikke", { status: 404 });
  return new NextResponse(Buffer.from(r.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.navn)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
