import type { SearchResult } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

const BASE_URL = "https://api.openalex.org";

interface OAWork {
  id: string;
  title: string;
  display_name: string;
  publication_year: number;
  doi: string | null;
  authorships: { author: { display_name: string } }[];
  abstract_inverted_index?: Record<string, number[]>;
  cited_by_count: number;
  ids: {
    openalex?: string;
    doi?: string;
  };
  primary_location?: {
    landing_page_url?: string;
  };
}

export async function searchOpenAlex(query: string, limit = 10, offset = 0): Promise<SearchResult[]> {
  const page = Math.floor(offset / limit) + 1;
  const url = `${BASE_URL}/works?search=${encodeURIComponent(query)}&per_page=${limit}&page=${page}&mailto=litreview@localhost`;

  await rateLimit("openalex");
  const res = await fetch(url, {
    headers: { "User-Agent": "LitReviewAgent/1.0 (mailto:litreview@localhost)" },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.results || []).map(mapToResult);
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string {
  if (!invertedIndex) return "";

  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([pos, word]);
    }
  }
  words.sort((a, b) => a[0] - b[0]);
  return words.map(([, w]) => w).join(" ");
}

function extractOpenAlexId(fullId: string): string {
  // Format: https://openalex.org/W1234567890
  return fullId.replace("https://openalex.org/", "");
}

function cleanDoi(doi: string | null): string | null {
  if (!doi) return null;
  return doi.replace("https://doi.org/", "");
}

function mapToResult(work: OAWork): SearchResult {
  return {
    title: work.display_name || work.title || "Untitled",
    authors: (work.authorships || []).map((a) => a.author.display_name),
    abstract: reconstructAbstract(work.abstract_inverted_index),
    year: work.publication_year || null,
    doi: cleanDoi(work.doi || work.ids?.doi || null),
    arxivId: null,
    semanticScholarId: null,
    openalexId: extractOpenAlexId(work.id),
    source: "openalex",
    url: work.primary_location?.landing_page_url || null,
    citationCount: work.cited_by_count ?? null,
  };
}
