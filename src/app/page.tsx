"use client";

import { useState } from "react";

type SearchResult = {
  id: string;
  title: string;
  type: string;
  episodes: number;
  status: string;
  year: number;
  score: number;
  poster: string;
  session: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter a search term first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/animepahe?path=search&query=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        throw new Error("Search failed.");
      }
      const json = await response.json();
      setResults(json.results || []);
    } catch (err) {
      setError(String(err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "2rem", fontFamily: "system-ui, sans-serif", background: "#0f172a", color: "#f8fafc" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "1rem", fontSize: "2rem" }}>AnimePahe Simple</h1>
        <p style={{ marginBottom: "1rem", color: "#94a3b8" }}>
          Search AnimePahe from Vercel with a lightweight API wrapper.
        </p>

        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search anime name, e.g. One Piece"
            style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #334155", background: "#020617", color: "#f8fafc" }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "none", background: "#2563eb", color: "white", cursor: "pointer" }}
          >
            {loading ? "Searching…" : "Search Anime"}
          </button>
          {error ? <div style={{ color: "#fb7185" }}>{error}</div> : null}
        </div>

        {results.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {results.map((item) => (
              <article key={item.id} style={{ padding: "1rem", borderRadius: "0.75rem", background: "#111827", border: "1px solid #334155" }}>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} width={96} height={136} style={{ borderRadius: "0.5rem", objectFit: "cover" }} />
                  ) : null}
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{item.title}</h2>
                    <p style={{ margin: "0.35rem 0", color: "#94a3b8" }}>
                      {item.type} • {item.episodes} eps • {item.status}
                    </p>
                    <p style={{ margin: 0, color: "#cbd5e1" }}>
                      Score: {item.score} • Year: {item.year}
                    </p>
                    <p style={{ marginTop: "0.5rem" }}><strong>Session:</strong> {item.session}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: "1rem", color: "#94a3b8" }}>
            No results yet. Search for anime to see results.
          </div>
        )}
      </div>
    </main>
  );
}
