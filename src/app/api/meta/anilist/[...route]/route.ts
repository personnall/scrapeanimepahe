import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const pendingRequests = new Map<string, Promise<any>>();

async function fetchWithCacheAndDedupe(cacheKey: string, fetchFn: () => Promise<any>): Promise<any> {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const promise = (async () => {
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 350;

    while (attempts < maxAttempts) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 350));
        const data = await fetchFn();
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  })();

  pendingRequests.set(cacheKey, promise);

  try {
    const data = await promise;
    return data;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

async function fetchAniList(query: string, variables: any) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AniList API returned ${res.status}: ${errText || res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`AniList GraphQL Error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

function mapMedia(media: any) {
  if (!media) return null;
  return {
    id: String(media.id),
    title: {
      romaji: media.title?.romaji || null,
      english: media.title?.english || null,
      native: media.title?.native || null,
      userPreferred: media.title?.userPreferred || null,
    },
    image: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null,
    imageHash: "default",
    cover: media.bannerImage || null,
    description: media.description || null,
    rating: media.averageScore || null,
    releaseDate: media.seasonYear || media.startDate?.year || null,
    status: media.status || null,
    genres: media.genres || [],
    type: media.format || null,
    totalEpisodes: media.episodes || null,
    currentEpisode: media.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : (media.episodes || null),
    nextAiringEpisode: media.nextAiringEpisode ? {
      airingAt: media.nextAiringEpisode.airingAt,
      timeUntilAiring: media.nextAiringEpisode.timeUntilAiring,
      episode: media.nextAiringEpisode.episode,
    } : null,
  };
}

const MEDIA_LIST_QUERY = `
  query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $format: MediaFormat, $season: MediaSeason, $seasonYear: Int, $genres: [String], $search: String, $id: Int, $countryOfOrigin: CountryCode, $isAdult: Boolean) {
    Page (page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media (sort: $sort, type: ANIME, status: $status, format: $format, season: $season, seasonYear: $seasonYear, genre_in: $genres, search: $search, id: $id, countryOfOrigin: $countryOfOrigin, isAdult: $isAdult) {
        id
        idMal
        title {
          romaji
          english
          native
          userPreferred
        }
        coverImage {
          extraLarge
          large
          medium
          color
        }
        bannerImage
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        description
        season
        seasonYear
        type
        format
        status
        episodes
        duration
        genres
        isAdult
        averageScore
        popularity
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
      }
    }
  }
`;

const AIRING_SCHEDULE_QUERY = `
  query ($page: Int, $perPage: Int, $airingAt_greater: Int, $airingAt_less: Int) {
    Page (page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      airingSchedules (airingAt_greater: $airingAt_greater, airingAt_less: $airingAt_less, sort: TIME_ASC) {
        id
        airingAt
        episode
        media {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          coverImage {
            extraLarge
            large
            medium
          }
          bannerImage
          description
          status
          format
          episodes
          averageScore
          genres
          seasonYear
          startDate {
            year
          }
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
        }
      }
    }
  }
`;

const RELATIONS_QUERY = `
  query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id
      relations {
        edges {
          relationType
          node {
            id
            idMal
            title {
              romaji
              english
              native
              userPreferred
            }
            coverImage {
              extraLarge
              large
              medium
            }
            bannerImage
            description
            status
            format
            episodes
            averageScore
            genres
            seasonYear
            startDate {
              year
            }
            nextAiringEpisode {
              airingAt
              timeUntilAiring
              episode
            }
          }
        }
      }
    }
  }
`;

function corsResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ route: string[] }> },
) {
  try {
    const { route } = await params;
    if (!route || route.length === 0) {
      return corsResponse({ error: "Missing route action" }, 400);
    }

    const action = route[0];
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const perPage = parseInt(searchParams.get("perPage") || "20", 10) || 20;
    const cacheKey = `${action}:${request.url}`;

    if (action === "trending") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, sort: ["TRENDING_DESC", "POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "popular") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, sort: ["POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "search") {
      const q = searchParams.get("q") || searchParams.get("search");
      if (!q) {
        return corsResponse({ error: "Query parameter 'q' or 'search' is required" }, 400);
      }
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, search: q, sort: ["SEARCH_MATCH", "POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "advanced-search") {
      const search = searchParams.get("search") || searchParams.get("q") || undefined;
      const genresParam = searchParams.get("genres");
      const genres = genresParam ? genresParam.split(",").map((g) => g.trim()) : undefined;
      const format = (searchParams.get("format") || undefined) as any;
      const season = (searchParams.get("season") || undefined) as any;
      const seasonYearParam = searchParams.get("seasonYear");
      const seasonYear = seasonYearParam ? parseInt(seasonYearParam, 10) : undefined;
      const sortParam = searchParams.get("sort");
      const sort = sortParam ? sortParam.split(",").map((s) => s.trim()) : ["POPULARITY_DESC"];
      const adultParam = searchParams.get("adult");
      const isAdult = adultParam ? adultParam === "true" : undefined;

      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, {
          page,
          perPage,
          search,
          genres,
          format,
          season,
          seasonYear,
          sort,
          isAdult,
        }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "ongoing") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, status: "RELEASING", sort: ["POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "recent") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, sort: ["UPDATED_AT_DESC", "TRENDING_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "updates") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, status: "NOT_YET_RELEASED", sort: ["POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "new-releases") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, status: "RELEASING", sort: ["START_DATE_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "completed") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, status: "FINISHED", sort: ["POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "spotlight") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page: 1, perPage: 10, sort: ["TRENDING_DESC", "POPULARITY_DESC"] }),
      );
      return corsResponse({
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "schedule") {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const airingAt_greater = currentTimestamp - 3 * 24 * 60 * 60;
      const airingAt_less = currentTimestamp + 4 * 24 * 60 * 60;

      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(AIRING_SCHEDULE_QUERY, {
          page,
          perPage,
          airingAt_greater,
          airingAt_less,
        }),
      );

      const mappedSchedules = (data?.Page?.airingSchedules || [])
        .map((sched: any) => {
          if (!sched?.media) return null;
          return {
            id: String(sched.id),
            airingAt: sched.airingAt,
            episode: sched.episode,
            ...mapMedia(sched.media),
          };
        })
        .filter(Boolean);

      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: mappedSchedules,
      });
    }

    if (action === "country") {
      const country = searchParams.get("country") || searchParams.get("countryOfOrigin") || "JP";
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, countryOfOrigin: country, sort: ["POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "releasing") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, status: "RELEASING", sort: ["POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (["tv", "movie", "ona", "ova"].includes(action)) {
      const formatMap: Record<string, string> = {
        tv: "TV",
        movie: "MOVIE",
        ona: "ONA",
        ova: "OVA",
      };
      const format = formatMap[action];
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, format, sort: ["POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "trending-range") {
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page, perPage, sort: ["TRENDING_DESC", "POPULARITY_DESC"] }),
      );
      return corsResponse({
        currentPage: data?.Page?.pageInfo?.currentPage || page,
        hasNextPage: data?.Page?.pageInfo?.hasNextPage || false,
        results: (data?.Page?.media || []).map(mapMedia).filter(Boolean),
      });
    }

    if (action === "fetchNameid") {
      const name = route[1] ? decodeURIComponent(route[1]) : null;
      if (!name) {
        return corsResponse({ error: "Anime name path parameter is required" }, 400);
      }
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page: 1, perPage: 1, search: name, sort: ["SEARCH_MATCH", "POPULARITY_DESC"] }),
      );
      const media = data?.Page?.media?.[0];
      if (!media) {
        return corsResponse({ error: "Anime not found" }, 404);
      }
      return corsResponse(mapMedia(media));
    }

    if (action === "random-anime") {
      const randomPage = Math.floor(Math.random() * 50) + 1;
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(MEDIA_LIST_QUERY, { page: randomPage, perPage: 1, sort: ["POPULARITY_DESC"] }),
      );
      let media = data?.Page?.media?.[0];
      if (!media) {
        const fallbackData = await fetchWithCacheAndDedupe(`fallback:random-anime`, () =>
          fetchAniList(MEDIA_LIST_QUERY, { page: 1, perPage: 1, sort: ["POPULARITY_DESC"] }),
        );
        media = fallbackData?.Page?.media?.[0];
      }
      return corsResponse(mapMedia(media));
    }

    if (action === "seasons") {
      const idParam = searchParams.get("id");
      if (!idParam) {
        return corsResponse({ error: "Query parameter 'id' is required" }, 400);
      }
      const animeId = parseInt(idParam, 10);
      const data = await fetchWithCacheAndDedupe(cacheKey, () =>
        fetchAniList(RELATIONS_QUERY, { id: animeId }),
      );
      const relations = data?.Media?.relations?.edges || [];
      const results = relations
        .map((edge: any) => {
          if (!edge?.node || edge.node.type === "MANGA") return null;
          return {
            relationType: edge.relationType,
            ...mapMedia(edge.node),
          };
        })
        .filter(Boolean);
      return corsResponse(results);
    }

    return corsResponse({ error: `Action '${action}' is not supported.` }, 400);
  } catch (error: any) {
    console.error("Error in AniList API catch-all route:", error);
    return corsResponse({ error: error.message || "Internal Server Error" }, 500);
  }
}
