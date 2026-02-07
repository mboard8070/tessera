import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface ImportPaper {
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  doi: string | null;
  arxivId: string | null;
  semanticScholarId: string | null;
  openalexId: string | null;
  source: string;
  url: string | null;
  notes?: string;
}

interface ImportBundle {
  name: string;
  description: string;
  papers: ImportPaper[];
  syntheses?: { synthesis: string; model: string; createdAt: string }[];
  knowledge?: { paperId: number; category: string; content: string }[];
  conclusions?: { title: string; content: string; category: string }[];
  exportedAt: string;
  version: number;
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const bundle: ImportBundle = await request.json();

  if (!bundle.name || !bundle.papers) {
    return NextResponse.json({ error: "Invalid bundle format" }, { status: 400 });
  }

  // Create collection
  const collResult = db.prepare(
    "INSERT INTO collections (name, description) VALUES (?, ?)"
  ).run(bundle.name + " (imported)", bundle.description || "");
  const collectionId = Number(collResult.lastInsertRowid);

  const paperIdMap = new Map<number, number>(); // old id -> new id
  let papersAdded = 0;

  for (let i = 0; i < bundle.papers.length; i++) {
    const p = bundle.papers[i];

    // Check for existing paper by DOI or title
    let existingId: number | null = null;
    if (p.doi) {
      const existing = db.prepare("SELECT id FROM papers WHERE doi = ?").get(p.doi) as { id: number } | undefined;
      if (existing) existingId = existing.id;
    }
    if (!existingId && p.arxivId) {
      const existing = db.prepare("SELECT id FROM papers WHERE arxiv_id = ?").get(p.arxivId) as { id: number } | undefined;
      if (existing) existingId = existing.id;
    }

    let paperId: number;
    if (existingId) {
      paperId = existingId;
    } else {
      const result = db.prepare(`
        INSERT INTO papers (title, authors, abstract, year, doi, arxiv_id, semantic_scholar_id, openalex_id, source, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        p.title,
        JSON.stringify(p.authors || []),
        p.abstract || "",
        p.year || null,
        p.doi || null,
        p.arxivId || null,
        p.semanticScholarId || null,
        p.openalexId || null,
        p.source || "import",
        p.url || null
      );
      paperId = Number(result.lastInsertRowid);
      papersAdded++;
    }

    paperIdMap.set(i, paperId);

    // Add to collection
    db.prepare(
      "INSERT OR IGNORE INTO collection_papers (collection_id, paper_id, notes) VALUES (?, ?, ?)"
    ).run(collectionId, paperId, p.notes || "");
  }

  // Import syntheses
  let synthesesAdded = 0;
  if (bundle.syntheses) {
    const paperIds = [...paperIdMap.values()];
    for (const s of bundle.syntheses) {
      db.prepare(
        "INSERT INTO syntheses (collection_id, synthesis, model, paper_ids) VALUES (?, ?, ?, ?)"
      ).run(collectionId, s.synthesis, s.model, JSON.stringify(paperIds));
      synthesesAdded++;
    }
  }

  // Import conclusions
  let conclusionsAdded = 0;
  if (bundle.conclusions) {
    for (const c of bundle.conclusions) {
      db.prepare(
        "INSERT INTO conclusions (title, content, category) VALUES (?, ?, ?)"
      ).run(c.title, c.content, c.category || "general");
      conclusionsAdded++;
    }
  }

  return NextResponse.json({
    collectionId,
    papersAdded,
    papersExisting: bundle.papers.length - papersAdded,
    synthesesAdded,
    conclusionsAdded,
  });
}
