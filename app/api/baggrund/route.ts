import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Det uploadede baggrundsbillede (Indstillinger → Udseende).
 * Ligger i databasen som data-URL og serveres herfra, så det ikke sendes med i
 * hver eneste side. Kræver login (middleware). URL'en bærer en version, så det
 * kan caches længe.
 */
export async function GET() {
  const s = await db.settings.findUnique({ where: { id: "singleton" }, select: { bgImage: true } });
  const m = s?.bgImage?.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return new NextResponse("Intet baggrundsbillede", { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
