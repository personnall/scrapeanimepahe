import { NextResponse } from "next/server";
import { fetchEpisodes, fetchInfo, latestAnime, searchAnime } from "../../../lib/animepahe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (path === "search") {
    const query = searchParams.get("query");
    if (!query) {
      return NextResponse.json({ error: "query parameter is required" }, { status: 400 });
    }
    const results = await searchAnime(query);
    return NextResponse.json({ results }, { status: 200 });
  }

  if (path === "latest") {
    const results = await latestAnime();
    return NextResponse.json({ results }, { status: 200 });
  }

  if (path === "info") {
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
    }
    const info = await fetchInfo(id);
    if (!info) {
      return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    }
    return NextResponse.json(info, { status: 200 });
  }

  if (path === "episodes") {
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
    }
    const episodes = await fetchEpisodes(id);
    return NextResponse.json({ results: episodes }, { status: 200 });
  }

  return NextResponse.json(
    { error: "Invalid path. Use: search, latest, info, or episodes" },
    { status: 400 },
  );
}
