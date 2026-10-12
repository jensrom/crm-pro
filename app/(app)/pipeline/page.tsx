import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Pipeline hedder nu Opportunities (og leads har deres egen side). */
export default async function PipelineSide({ searchParams }: { searchParams: Promise<{ alle?: string }> }) {
  const { alle } = await searchParams;
  redirect(alle === "1" ? "/opportunities?alle=1" : "/opportunities");
}
