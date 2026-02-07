import { XMLParser } from "fast-xml-parser";
import type { SearchResult } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

const BASE_URL = "https://export.arxiv.org/api/query";

interface ArxivEntry {
  title: string;
  summary: string;
  published: string;
  id: string;
  author: { name: string } | { name: string }[];
  "arxiv:doi"?: { "#text": string };
  link: { "@_href": string; "@_type"?: string } | { "@_href": string; "@_type"?: string }[];
}

export async function searchArxiv(query: string, limit = 10, offset = 0): Promise<SearchResult[]> {
  const url = `${BASE_URL}?search_query=all:${encodeURIComponent(query)}&start=${offset}&max_results=${limit}`;

  await rateLimit("arxiv");
  const res = await fetch(url, {
    headers: { "User-Agent": "LitReviewAgent/1.0" },
  });

  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml);

  const entries = parsed?.feed?.entry;
  if (!entries) return [];

  const list = Array.isArray(entries) ? entries : [entries];
  return list.map(mapToResult);
}

function extractArxivId(idUrl: string): string {
  // Format: http://arxiv.org/abs/2301.12345v1
  const match = idUrl.match(/abs\/(.+?)(?:v\d+)?$/);
  return match ? match[1] : idUrl;
}

function mapToResult(entry: ArxivEntry): SearchResult {
  const authors = Array.isArray(entry.author)
    ? entry.author.map((a) => a.name)
    : entry.author
      ? [entry.author.name]
      : [];

  const year = entry.published ? new Date(entry.published).getFullYear() : null;
  const arxivId = extractArxivId(entry.id);

  const links = Array.isArray(entry.link) ? entry.link : [entry.link];
  const pdfLink = links.find((l) => l["@_type"] === "application/pdf");
  const absLink = links.find((l) => !l["@_type"] || l["@_type"] === "text/html");

  return {
    title: (entry.title || "Untitled").replace(/\s+/g, " ").trim(),
    authors,
    abstract: (entry.summary || "").replace(/\s+/g, " ").trim(),
    year,
    doi: entry["arxiv:doi"]?.["#text"] || null,
    arxivId,
    semanticScholarId: null,
    openalexId: null,
    source: "arxiv",
    url: pdfLink?.["@_href"] || absLink?.["@_href"] || `https://arxiv.org/abs/${arxivId}`,
    citationCount: null,
  };
}
