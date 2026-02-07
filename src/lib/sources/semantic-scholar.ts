import type { SearchResult } from "@/lib/types";

const BASE_URL = "https://api.semanticscholar.org/graph/v1";

interface S2Paper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  authors?: { name: string }[];
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
  };
  url?: string;
  citationCount?: number;
  references?: { paperId: string }[];
  citations?: { paperId: string }[];
}

export async function searchSemanticScholar(query: string, limit = 10, offset = 0): Promise<SearchResult[]> {
  const fields = "paperId,title,abstract,year,authors,externalIds,url,citationCount";
  const url = `${BASE_URL}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&fields=${fields}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LitReviewAgent/1.0" },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.data || []).map(mapToResult);
}

export async function getSemanticScholarPaper(paperId: string): Promise<SearchResult | null> {
  const fields = "paperId,title,abstract,year,authors,externalIds,url,citationCount";
  const url = `${BASE_URL}/paper/${encodeURIComponent(paperId)}?fields=${fields}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LitReviewAgent/1.0" },
  });

  if (!res.ok) return null;

  const data: S2Paper = await res.json();
  return mapToResult(data);
}

export async function getCitations(paperId: string, limit = 100): Promise<string[]> {
  const url = `${BASE_URL}/paper/${encodeURIComponent(paperId)}/citations?fields=paperId&limit=${limit}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LitReviewAgent/1.0" },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.data || [])
    .map((c: { citingPaper: { paperId: string } }) => c.citingPaper?.paperId)
    .filter(Boolean);
}

export async function getReferences(paperId: string, limit = 100): Promise<string[]> {
  const url = `${BASE_URL}/paper/${encodeURIComponent(paperId)}/references?fields=paperId&limit=${limit}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LitReviewAgent/1.0" },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.data || [])
    .map((r: { citedPaper: { paperId: string } }) => r.citedPaper?.paperId)
    .filter(Boolean);
}

function mapToResult(paper: S2Paper): SearchResult {
  return {
    title: paper.title || "Untitled",
    authors: (paper.authors || []).map((a) => a.name),
    abstract: paper.abstract || "",
    year: paper.year || null,
    doi: paper.externalIds?.DOI || null,
    arxivId: paper.externalIds?.ArXiv || null,
    semanticScholarId: paper.paperId || null,
    openalexId: null,
    source: "semantic_scholar",
    url: paper.url || null,
    citationCount: paper.citationCount ?? null,
  };
}
