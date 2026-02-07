import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

const S2_BASE = "https://api.semanticscholar.org/graph/v1";
const S2_FIELDS = "paperId,title,abstract,year,authors,externalIds,url,citationCount";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  // Get papers this paper cites (references)
  const references = db.prepare(`
    SELECT p.id, p.title, p.authors, p.year, p.doi
    FROM citations c
    JOIN papers p ON p.id = c.cited_paper_id
    WHERE c.citing_paper_id = ?
  `).all(Number(id)) as PaperRow[];

  // Get papers that cite this paper
  const citedBy = db.prepare(`
    SELECT p.id, p.title, p.authors, p.year, p.doi
    FROM citations c
    JOIN papers p ON p.id = c.citing_paper_id
    WHERE c.cited_paper_id = ?
  `).all(Number(id)) as PaperRow[];

  const format = (rows: PaperRow[]) =>
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      authors: JSON.parse(r.authors),
      year: r.year,
      doi: r.doi,
    }));

  return NextResponse.json({
    references: format(references),
    citedBy: format(citedBy),
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const paper = db.prepare("SELECT * FROM papers WHERE id = ?").get(Number(id)) as PaperRow | undefined;
  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Resolve Semantic Scholar ID
  let s2Id = paper.semantic_scholar_id;
  if (!s2Id) {
    s2Id = await resolveS2Id(paper);
    if (s2Id) {
      db.prepare("UPDATE papers SET semantic_scholar_id = ? WHERE id = ?").run(s2Id, paper.id);
    }
  }

  if (!s2Id) {
    return NextResponse.json({ error: "Could not find paper on Semantic Scholar" }, { status: 404 });
  }

  // Fetch references and citations in parallel
  const [references, citations] = await Promise.all([
    fetchS2References(s2Id),
    fetchS2Citations(s2Id),
  ]);

  let refsAdded = 0;
  let citesAdded = 0;

  // Process references (papers this paper cites)
  for (const ref of references) {
    const refPaperId = ensurePaperExists(db, ref);
    if (refPaperId) {
      const existing = db.prepare(
        "SELECT id FROM citations WHERE citing_paper_id = ? AND cited_paper_id = ?"
      ).get(paper.id, refPaperId);
      if (!existing) {
        db.prepare(
          "INSERT INTO citations (citing_paper_id, cited_paper_id, source) VALUES (?, ?, 'semantic_scholar')"
        ).run(paper.id, refPaperId);
        refsAdded++;
      }
    }
  }

  // Process citations (papers that cite this paper)
  for (const cite of citations) {
    const citePaperId = ensurePaperExists(db, cite);
    if (citePaperId) {
      const existing = db.prepare(
        "SELECT id FROM citations WHERE citing_paper_id = ? AND cited_paper_id = ?"
      ).get(citePaperId, paper.id);
      if (!existing) {
        db.prepare(
          "INSERT INTO citations (citing_paper_id, cited_paper_id, source) VALUES (?, ?, 'semantic_scholar')"
        ).run(citePaperId, paper.id);
        citesAdded++;
      }
    }
  }

  return NextResponse.json({
    referencesFound: references.length,
    citationsFound: citations.length,
    referencesAdded: refsAdded,
    citationsAdded: citesAdded,
  });
}

async function resolveS2Id(paper: PaperRow): Promise<string | null> {
  // Try DOI first
  if (paper.doi) {
    try {
      await rateLimit("semantic_scholar");
      const res = await fetch(`${S2_BASE}/paper/DOI:${paper.doi}?fields=paperId`, {
        headers: { "User-Agent": "LitReviewAgent/1.0" },
      });
      if (res.ok) {
        const data = await res.json();
        return data.paperId || null;
      }
    } catch { /* continue */ }
  }

  // Try arXiv ID
  if (paper.arxiv_id) {
    try {
      await rateLimit("semantic_scholar");
      const res = await fetch(`${S2_BASE}/paper/ArXiv:${paper.arxiv_id}?fields=paperId`, {
        headers: { "User-Agent": "LitReviewAgent/1.0" },
      });
      if (res.ok) {
        const data = await res.json();
        return data.paperId || null;
      }
    } catch { /* continue */ }
  }

  // Fall back to title search
  try {
    await rateLimit("semantic_scholar");
    const res = await fetch(
      `${S2_BASE}/paper/search?query=${encodeURIComponent(paper.title)}&limit=1&fields=paperId`,
      { headers: { "User-Agent": "LitReviewAgent/1.0" } }
    );
    if (res.ok) {
      const data = await res.json();
      return data.data?.[0]?.paperId || null;
    }
  } catch { /* give up */ }

  return null;
}

async function fetchS2References(s2Id: string): Promise<S2Paper[]> {
  try {
    await rateLimit("semantic_scholar");
    const res = await fetch(
      `${S2_BASE}/paper/${s2Id}/references?fields=${S2_FIELDS}&limit=50`,
      { headers: { "User-Agent": "LitReviewAgent/1.0" } }
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

async function fetchS2Citations(s2Id: string): Promise<S2Paper[]> {
  try {
    await rateLimit("semantic_scholar");
    const res = await fetch(
      `${S2_BASE}/paper/${s2Id}/citations?fields=${S2_FIELDS}&limit=50`,
      { headers: { "User-Agent": "LitReviewAgent/1.0" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .map((r: { citingPaper: S2Paper }) => r.citingPaper)
      .filter((p: S2Paper) => p && p.paperId && p.title);
  } catch {
    return [];
  }
}

function ensurePaperExists(db: ReturnType<typeof getDb>, s2Paper: S2Paper): number | null {
  if (!s2Paper.paperId || !s2Paper.title) return null;

  // Check if already exists by S2 ID
  const existing = db.prepare(
    "SELECT id FROM papers WHERE semantic_scholar_id = ?"
  ).get(s2Paper.paperId) as { id: number } | undefined;
  if (existing) return existing.id;

  // Check by DOI
  if (s2Paper.externalIds?.DOI) {
    const byDoi = db.prepare(
      "SELECT id FROM papers WHERE doi = ?"
    ).get(s2Paper.externalIds.DOI) as { id: number } | undefined;
    if (byDoi) {
      // Update S2 ID on existing record
      db.prepare("UPDATE papers SET semantic_scholar_id = ? WHERE id = ?").run(s2Paper.paperId, byDoi.id);
      return byDoi.id;
    }
  }

  // Insert new paper
  const result = db.prepare(`
    INSERT INTO papers (title, authors, abstract, year, doi, arxiv_id, semantic_scholar_id, source, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'semantic_scholar', ?)
  `).run(
    s2Paper.title,
    JSON.stringify((s2Paper.authors || []).map((a) => a.name)),
    s2Paper.abstract || "",
    s2Paper.year || null,
    s2Paper.externalIds?.DOI || null,
    s2Paper.externalIds?.ArXiv || null,
    s2Paper.paperId,
    s2Paper.url || null
  );

  return Number(result.lastInsertRowid);
}
