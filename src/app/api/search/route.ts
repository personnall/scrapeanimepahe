import { NextResponse } from "next/server";
import { searchAnime } from "../../../lib/animepahe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "q parameter is required" }, { status: 400 });
  }

  const results = await searchAnime(query);
  return NextResponse.json({ results }, { status: 200 });
}
