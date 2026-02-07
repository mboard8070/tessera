import type { SearchResult } from "@/lib/types";

const BASE_URL = "https://api.crossref.org/works";

interface CRWork {
  DOI: string;
  title: string[];
  author?: { given?: string; family?: string }[];
  abstract?: string;
  published?: { "date-parts": number[][] };
  "published-print"?: { "date-parts": number[][] };
  "published-online"?: { "date-parts": number[][] };
  "is-referenced-by-count"?: number;
  URL?: string;
}

export async function searchCrossRef(query: string, limit = 10, offset = 0): Promise<SearchResult[]> {
  const url = `${BASE_URL}?query=${encodeURIComponent(query)}&rows=${limit}&offset=${offset}&mailto=litreview@localhost`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LitReviewAgent/1.0 (mailto:litreview@localhost)" },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.message?.items || []).map(mapToResult);
}

export async function resolveDoi(doi: string): Promise<SearchResult | null> {
  const url = `${BASE_URL}/${encodeURIComponent(doi)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LitReviewAgent/1.0 (mailto:litreview@localhost)" },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return mapToResult(data.message);
}

function getYear(work: CRWork): number | null {
  const dateParts =
    work.published?.["date-parts"]?.[0] ||
    work["published-print"]?.["date-parts"]?.[0] ||
    work["published-online"]?.["date-parts"]?.[0];
  return dateParts?.[0] || null;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim();
}

function mapToResult(work: CRWork): SearchResult {
  const authors = (work.author || []).map((a) => {
    const parts = [a.given, a.family].filter(Boolean);
    return parts.join(" ");
  });

  return {
    title: (work.title?.[0] || "Untitled"),
    authors,
    abstract: work.abstract ? stripHtmlTags(work.abstract) : "",
    year: getYear(work),
    doi: work.DOI || null,
    arxivId: null,
    semanticScholarId: null,
    openalexId: null,
    source: "crossref",
    url: work.URL || (work.DOI ? `https://doi.org/${work.DOI}` : null),
    citationCount: work["is-referenced-by-count"] ?? null,
  };
}
