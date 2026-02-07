import type { SearchResult } from "@/lib/types";
import { searchSemanticScholar } from "./semantic-scholar";
import { searchArxiv } from "./arxiv";
import { searchOpenAlex } from "./openalex";
import { searchCrossRef } from "./crossref";
import { searchPubMed } from "./pubmed";

export { searchSemanticScholar } from "./semantic-scholar";
export { searchArxiv } from "./arxiv";
export { searchOpenAlex } from "./openalex";
export { searchCrossRef } from "./crossref";
export { searchPubMed } from "./pubmed";
export { getSemanticScholarPaper, getCitations, getReferences } from "./semantic-scholar";
export { resolveDoi } from "./crossref";

export type SourceName = "semantic_scholar" | "arxiv" | "openalex" | "crossref" | "pubmed";

const sourceFns: Record<SourceName, (q: string, limit: number, offset: number) => Promise<SearchResult[]>> = {
  semantic_scholar: searchSemanticScholar,
  arxiv: searchArxiv,
  openalex: searchOpenAlex,
  crossref: searchCrossRef,
  pubmed: searchPubMed,
};

export async function federatedSearch(
  query: string,
  sources: SourceName[] = ["semantic_scholar", "arxiv", "openalex", "crossref", "pubmed"],
  limit = 10,
  offset = 0
): Promise<SearchResult[]> {
  const promises = sources.map((s) =>
    sourceFns[s](query, limit, offset).catch(() => [] as SearchResult[])
  );
  const results = await Promise.all(promises);
  const all = results.flat();
  const deduped = deduplicateResults(all);
  // Sort by citation count (highest first), then by year (newest first)
  deduped.sort((a, b) => {
    const ca = a.citationCount ?? -1;
    const cb = b.citationCount ?? -1;
    if (cb !== ca) return cb - ca;
    const ya = a.year ?? 0;
    const yb = b.year ?? 0;
    return yb - ya;
  });
  return deduped;
}

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Map<string, SearchResult>();
  const deduped: SearchResult[] = [];

  for (const r of results) {
    const key = dedupeKey(r);
    if (key && seen.has(key)) {
      // Merge: prefer the one with more metadata
      const existing = seen.get(key)!;
      mergeResult(existing, r);
    } else {
      if (key) seen.set(key, r);
      deduped.push(r);
    }
  }

  return deduped;
}

function dedupeKey(r: SearchResult): string | null {
  // Prefer DOI as primary dedup key
  if (r.doi) return `doi:${r.doi.toLowerCase()}`;
  if (r.arxivId) return `arxiv:${r.arxivId.toLowerCase()}`;
  // Fallback to normalized title
  const normalized = r.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length > 20) return `title:${normalized}`;
  return null;
}

function mergeResult(target: SearchResult, source: SearchResult) {
  if (!target.doi && source.doi) target.doi = source.doi;
  if (!target.arxivId && source.arxivId) target.arxivId = source.arxivId;
  if (!target.semanticScholarId && source.semanticScholarId) target.semanticScholarId = source.semanticScholarId;
  if (!target.openalexId && source.openalexId) target.openalexId = source.openalexId;
  if (!target.abstract && source.abstract) target.abstract = source.abstract;
  if (!target.url && source.url) target.url = source.url;
  if (target.citationCount === null && source.citationCount !== null) target.citationCount = source.citationCount;
  if (target.authors.length === 0 && source.authors.length > 0) target.authors = source.authors;
}
