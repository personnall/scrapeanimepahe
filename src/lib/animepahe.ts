import * as cheerio from "cheerio";

const ANIMEPAHE_BASE_URL = "https://animepahe.pw";

const COMMON_HEADERS = {
  Referer: ANIMEPAHE_BASE_URL,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
  Cookie: "__ddg1_=;__ddg2_=",
};

function buildImageUrl(value: unknown, folder: string): string {
  const image = typeof value === "string" ? value : "";
  if (!image) return "";
  if (image.startsWith("http")) return image;
  return `https://i.animepahe.pw/${folder}/${image}`;
}

async function fetchJson(path: string) {
  const response = await fetch(`${ANIMEPAHE_BASE_URL}${path}`, {
    headers: COMMON_HEADERS,
  });
  return await response.json().catch(() => null);
}

export async function searchAnime(query: string) {
  const json = await fetchJson(`/api?m=search&l=8&q=${encodeURIComponent(query)}`);
  return Array.isArray(json?.data) ? json.data : [];
}

export async function latestAnime() {
  const json = await fetchJson(`/api?m=airing&page=1`);
  return Array.isArray(json?.data) ? json.data : [];
}

export async function fetchEpisodes(id: string) {
  const json = await fetchJson(`/api?m=release&id=${id}&sort=episode_dsc&page=1`);
  return json;
}

export async function fetchInfo(id: string) {
  const response = await fetch(`${ANIMEPAHE_BASE_URL}/anime/${id}`, {
    headers: COMMON_HEADERS,
  });
  const html = await response.text();
  const $ = cheerio.load(html);

  const description =
    $(".anime-synopsis")
      .html()
      ?.replace(/<br\s*\/?\s*>/g, "\n")
      .trim() ?? "";

  const name = $('span[style="user-select:text"]').text().trim() || "";
  const poster = $("img[data-src$='.jpg']").attr("data-src")?.trim() || "";
  const backgroundSrc = $("div.anime-cover").attr("data-src")?.trim() || "";
  const background = backgroundSrc
    ? backgroundSrc.startsWith("http")
      ? backgroundSrc
      : `https:${backgroundSrc}`
    : null;

  let aired = "";
  let duration = "";
  $(".anime-info p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.startsWith("Aired:")) {
      aired = text.replace("Aired:", "").trim();
    } else if (text.startsWith("Duration:")) {
      duration = text.replace("Duration:", "").trim();
    }
  });

  const genres: string[] = [];
  $(".anime-genre li").each((_, el) => {
    genres.push($(el).text().trim());
  });

  const externalLinks: string[] = [];
  $(".external-links a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      externalLinks.push(new URL(href, ANIMEPAHE_BASE_URL).href);
    } catch {
      // ignore invalid URLs
    }
  });

  return {
    id,
    name,
    description,
    poster: poster || null,
    background,
    aired,
    duration,
    genres,
    externalLinks,
  };
}
