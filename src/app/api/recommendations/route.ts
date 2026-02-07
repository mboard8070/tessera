import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

const S2_BASE = "https://api.semanticscholar.org/graph/v1";
const S2_FIELDS = "paperId,title,abstract,year,authors,externalIds,url,citationCount";
const HEADERS = { "User-Agent": "LitReviewAgent/1.0" };

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const collectionId = searchParams.get("collection_id");
  const limit = Math.min(Number(searchParams.get("limit") || 20), 50);

  // Get seed papers from collection or all papers
  let papers: PaperRow[];
  if (collectionId) {
    papers = db.prepare(`
      SELECT p.* FROM papers p
      JOIN collection_papers cp ON cp.paper_id = p.id
      WHERE cp.collection_id = ?
      ORDER BY p.year DESC
      LIMIT 20
    `).all(Number(collectionId)) as PaperRow[];
  } else {
    papers = db.prepare("SELECT * FROM papers ORDER BY created_at DESC LIMIT 20").all() as PaperRow[];
  }

  if (papers.length === 0) {
    return NextResponse.json({ recommendations: [], seedCount: 0 });
  }

  // Collect S2 IDs for recommendation API
  const s2Ids = papers
    .filter((p) => p.semantic_scholar_id)
    .map((p) => p.semantic_scholar_id!)
    .slice(0, 5); // S2 recommends based on up to 5 seed papers

  // Existing paper identifiers to filter out
  const existingDois = new Set(
    db.prepare("SELECT doi FROM papers WHERE doi IS NOT NULL").all()
      .map((r: unknown) => (r as { doi: string }).doi.toLowerCase())
  );
  const existingS2Ids = new Set(
    db.prepare("SELECT semantic_scholar_id FROM papers WHERE semantic_scholar_id IS NOT NULL").all()
      .map((r: unknown) => (r as { semantic_scholar_id: string }).semantic_scholar_id)
  );

  const recommendations: Recommendation[] = [];

  // Strategy 1: S2 Recommendations API (if we have S2 IDs)
  if (s2Ids.length > 0) {
    try {
      const recs = await fetchS2Recommendations(s2Ids, limit);
      for (const rec of recs) {
        if (existingS2Ids.has(rec.paperId)) continue;
        if (rec.externalIds?.DOI && existingDois.has(rec.externalIds.DOI.toLowerCase())) continue;
        recommendations.push(mapS2Paper(rec, "recommendation"));
      }
    } catch { /* fall through to other strategies */ }
  }

  // Strategy 2: Use the most-cited papers' references as recommendations
  if (recommendations.length < limit) {
    const topPapers = papers
      .filter((p) => p.semantic_scholar_id)
      .slice(0, 3);

    for (const paper of topPapers) {
      if (recommendations.length >= limit) break;
      try {
        const refs = await fetchS2References(paper.semantic_scholar_id!, 20);
        for (const ref of refs) {
          if (recommendations.length >= limit) break;
          if (existingS2Ids.has(ref.paperId)) continue;
          if (ref.externalIds?.DOI && existingDois.has(ref.externalIds.DOI.toLowerCase())) continue;
          if (recommendations.find((r) => r.semanticScholarId === ref.paperId)) continue;
          recommendations.push(mapS2Paper(ref, "reference"));
        }
      } catch { /* continue */ }
    }
  }

  // Sort by citation count
  recommendations.sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));

  return NextResponse.json({
    recommendations: recommendations.slice(0, limit),
    seedCount: papers.length,
  });
}

interface S2Paper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  authors?: { name: string }[];
  externalIds?: { DOI?: string; ArXiv?: string };
  url?: string;
  citationCount?: number;
}

interface Recommendation {
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  doi: string | null;
  arxivId: string | null;
  semanticScholarId: string;
  url: string | null;
  citationCount: number | null;
  source: string;
}

async function fetchS2Recommendations(paperIds: string[], limit: number): Promise<S2Paper[]> {
  await rateLimit("semantic_scholar");
  const res = await fetch(`${S2_BASE}/paper/batch`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: paperIds }),
  });

  if (!res.ok) {
    // Fall back to single-paper recommendations
    const allRecs: S2Paper[] = [];
    for (const id of paperIds.slice(0, 3)) {
      try {
        await rateLimit("semantic_scholar");
        const recRes = await fetch(
          `${S2_BASE}/recommendations/v1/papers/forpaper/${id}?fields=${S2_FIELDS}&limit=${Math.ceil(limit / 3)}`,
          { headers: HEADERS }
        );
        if (recRes.ok) {
          const data = await recRes.json();
          allRecs.push(...(data.recommendedPapers || []));
        }
      } catch { /* continue */ }
    }
    return allRecs;
  }

  // Use the multi-paper recommendations endpoint
  try {
    await rateLimit("semantic_scholar");
    const recRes = await fetch(`${S2_BASE}/recommendations/v1/papers/`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        positivePaperIds: paperIds,
        fields: S2_FIELDS,
        limit,
      }),
    });
    if (recRes.ok) {
      const data = await recRes.json();
      return data.recommendedPapers || [];
    }
  } catch { /* fall back */ }

  // Single-paper fallback
  const allRecs: S2Paper[] = [];
  for (const id of paperIds.slice(0, 3)) {
    try {
      await rateLimit("semantic_scholar");
      const recRes = await fetch(
        `${S2_BASE}/recommendations/v1/papers/forpaper/${id}?fields=${S2_FIELDS}&limit=${Math.ceil(limit / 3)}`,
        { headers: HEADERS }
      );
      if (recRes.ok) {
        const data = await recRes.json();
        allRecs.push(...(data.recommendedPapers || []));
      }
    } catch { /* continue */ }
  }
  return allRecs;
}

async function fetchS2References(s2Id: string, limit: number): Promise<S2Paper[]> {
  try {
    await rateLimit("semantic_scholar");
    const res = await fetch(
      `${S2_BASE}/paper/${s2Id}/references?fields=${S2_FIELDS}&limit=${limit}`,
      { headers: HEADERS }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .map((r: { citedPaper: S2Paper }) => r.citedPaper)
      .filter((p: S2Paper) => p && p.paperId && p.title);
  } catch {
    return [];
  }
}

function mapS2Paper(paper: S2Paper, source: string): Recommendation {
  return {
    title: paper.title || "Untitled",
    authors: (paper.authors || []).map((a) => a.name),
    abstract: paper.abstract || "",
    year: paper.year || null,
    doi: paper.externalIds?.DOI || null,
    arxivId: paper.externalIds?.ArXiv || null,
    semanticScholarId: paper.paperId,
    url: paper.url || null,
    citationCount: paper.citationCount ?? null,
    source,
  };
}
