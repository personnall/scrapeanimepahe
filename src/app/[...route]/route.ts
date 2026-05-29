import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sanitizeHeaders(headers: Headers) {
  const sanitized = new Headers();
  const blocked = new Set([
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "upgrade",
  ]);

  headers.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) {
      sanitized.set(key, value);
    }
  });

  return sanitized;
}

export async function GET(request: Request, { params }: { params: Promise<{ route: string[] }> }) {
  const { route } = await params;
  if (!route || route.length === 0) {
    return NextResponse.json({ error: "Missing route" }, { status: 400 });
  }

  const routePath = route.map(encodeURIComponent).join("/");
  const url = new URL(request.url);

  if (route[0] === "info") {
    const apiUrl = new URL(request.url);
    apiUrl.pathname = "/api/animepahe";
    apiUrl.search = `path=info&${url.searchParams.toString()}`;

    const response = await fetch(apiUrl.toString(), {
      method: request.method,
      headers: {
        accept: "application/json",
        "content-type": request.headers.get("content-type") || "application/json",
      },
    });

    const body = await response.arrayBuffer();
    const headers = sanitizeHeaders(new Headers(response.headers));
    return new NextResponse(body, {
      status: response.status,
      headers,
    });
  }

  url.pathname = `/api/meta/anilist/${routePath}`;

  const response = await fetch(url.toString(), {
    method: request.method,
    headers: {
      accept: "application/json",
      "content-type": request.headers.get("content-type") || "application/json",
    },
  });

  const body = await response.arrayBuffer();
  const headers = sanitizeHeaders(new Headers(response.headers));
  return new NextResponse(body, {
    status: response.status,
    headers,
  });
}
