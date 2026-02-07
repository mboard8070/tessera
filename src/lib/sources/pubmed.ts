import { XMLParser } from "fast-xml-parser";
import type { SearchResult } from "@/lib/types";

const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

const HEADERS = { "User-Agent": "LitReviewAgent/1.0" };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function searchPubMed(query: string, limit = 10, offset = 0): Promise<SearchResult[]> {
  try {
    // Step 1: esearch to get PMIDs
    const pmids = await searchPmids(query, limit, offset);
    if (pmids.length === 0) return [];

    // Step 2: efetch with XML to get full records including abstracts
    const records = await fetchRecords(pmids);
    return records;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Step 1 - ESearch: query -> PMIDs
// ---------------------------------------------------------------------------

async function searchPmids(query: string, limit: number, offset = 0): Promise<string[]> {
  const url = `${ESEARCH_URL}?db=pubmed&retmode=json&term=${encodeURIComponent(query)}&retmax=${limit}&retstart=${offset}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];

  const data = await res.json();
  const idList: string[] | undefined = data?.esearchresult?.idlist;
  return idList ?? [];
}

// ---------------------------------------------------------------------------
// Step 2 - EFetch: PMIDs -> full article records (XML)
// ---------------------------------------------------------------------------

async function fetchRecords(pmids: string[]): Promise<SearchResult[]> {
  const url = `${EFETCH_URL}?db=pubmed&id=${pmids.join(",")}&retmode=xml&rettype=abstract`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (tagName) => {
      // Ensure these are always treated as arrays even if there is only one
      const arrayTags = [
        "PubmedArticle",
        "Author",
        "AbstractText",
        "ArticleId",
      ];
      return arrayTags.includes(tagName);
    },
  });

  const parsed = parser.parse(xml);

  const articles =
    parsed?.PubmedArticleSet?.PubmedArticle;
  if (!articles) return [];

  const list = Array.isArray(articles) ? articles : [articles];
  return list.map(mapToResult).filter(Boolean) as SearchResult[];
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapToResult(pubmedArticle: Record<string, unknown>): SearchResult | null {
  try {
    const medlineCitation = pubmedArticle.MedlineCitation as Record<string, unknown> | undefined;
    const article = medlineCitation?.Article as Record<string, unknown> | undefined;
    const pubmedData = pubmedArticle.PubmedData as Record<string, unknown> | undefined;

    if (!article) return null;

    // PMID
    const pmidObj = medlineCitation?.PMID;
    const pmid: string =
      typeof pmidObj === "object" && pmidObj !== null
        ? String((pmidObj as Record<string, unknown>)["#text"] ?? "")
        : String(pmidObj ?? "");

    // Title
    const rawTitle = article.ArticleTitle;
    const title = flattenText(rawTitle) || "Untitled";

    // Authors
    const authorList = (article.AuthorList as Record<string, unknown>)?.Author;
    const authors = extractAuthors(authorList);

    // Abstract
    const abstractObj = article.Abstract as Record<string, unknown> | undefined;
    const abstractTexts = abstractObj?.AbstractText;
    const abstract = extractAbstract(abstractTexts);

    // Year
    const year = extractYear(article);

    // DOI from ArticleIdList
    const doi = extractDoi(pubmedData);

    // URL
    const url = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}` : null;

    return {
      title: cleanWhitespace(title),
      authors,
      abstract: cleanWhitespace(abstract),
      year,
      doi,
      arxivId: null,
      semanticScholarId: null,
      openalexId: null,
      source: "pubmed",
      url,
      citationCount: null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Field extraction helpers
// ---------------------------------------------------------------------------

function extractAuthors(authorList: unknown): string[] {
  if (!authorList) return [];
  const authors = Array.isArray(authorList) ? authorList : [authorList];

  return authors
    .map((a: Record<string, unknown>) => {
      const last = a.LastName ? String(a.LastName) : "";
      const fore = a.ForeName ? String(a.ForeName) : "";
      const initials = a.Initials ? String(a.Initials) : "";
      // Prefer "ForeName LastName", fall back to "Initials LastName"
      const first = fore || initials;
      return [first, last].filter(Boolean).join(" ");
    })
    .filter((name) => name.length > 0);
}

function extractAbstract(abstractTexts: unknown): string {
  if (!abstractTexts) return "";

  const parts = Array.isArray(abstractTexts) ? abstractTexts : [abstractTexts];

  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (typeof part === "number") return String(part);
      if (typeof part === "object" && part !== null) {
        const obj = part as Record<string, unknown>;
        // Structured abstract with Label attribute
        const label = obj["@_Label"] ? `${obj["@_Label"]}: ` : "";
        const text = flattenText(obj["#text"] ?? obj);
        return label + text;
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function extractYear(article: Record<string, unknown>): number | null {
  // Try Journal > JournalIssue > PubDate > Year
  const journal = article.Journal as Record<string, unknown> | undefined;
  const journalIssue = journal?.JournalIssue as Record<string, unknown> | undefined;
  const pubDate = journalIssue?.PubDate as Record<string, unknown> | undefined;

  if (pubDate?.Year) {
    const y = Number(pubDate.Year);
    if (!isNaN(y)) return y;
  }

  // Fallback: try MedlineDate which may contain "2023 Jan-Feb"
  if (pubDate?.MedlineDate) {
    const match = String(pubDate.MedlineDate).match(/(\d{4})/);
    if (match) return Number(match[1]);
  }

  // Fallback: ArticleDate
  const articleDate = article.ArticleDate as Record<string, unknown> | undefined;
  if (articleDate?.Year) {
    const y = Number(articleDate.Year);
    if (!isNaN(y)) return y;
  }

  return null;
}

function extractDoi(pubmedData: Record<string, unknown> | undefined): string | null {
  if (!pubmedData) return null;

  const articleIdList = pubmedData.ArticleIdList as Record<string, unknown> | undefined;
  const articleIds = articleIdList?.ArticleId;
  if (!articleIds) return null;

  const ids = Array.isArray(articleIds) ? articleIds : [articleIds];

  for (const id of ids) {
    if (typeof id === "object" && id !== null) {
      const obj = id as Record<string, unknown>;
      if (obj["@_IdType"] === "doi") {
        return String(obj["#text"] ?? "");
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

/**
 * Flatten a value that might be a plain string, a number, or an object with
 * #text (from XML mixed content) into a plain string.
 */
function flattenText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("#text" in obj) return String(obj["#text"]);
    // Last resort: concatenate all string values
    return Object.values(obj)
      .filter((v) => typeof v === "string" || typeof v === "number")
      .map(String)
      .join(" ");
  }
  return String(value);
}

function cleanWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
