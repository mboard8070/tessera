import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const collectionId = searchParams.get("collection_id");

  let rows: PaperRow[];
  if (collectionId) {
    rows = db.prepare(`
      SELECT p.* FROM papers p
      JOIN collection_papers cp ON cp.paper_id = p.id
      WHERE cp.collection_id = ?
      ORDER BY p.created_at DESC
    `).all(Number(collectionId)) as PaperRow[];
  } else {
    rows = db.prepare("SELECT * FROM papers ORDER BY created_at DESC").all() as PaperRow[];
  }

  const papers = rows.map(rowToPaper);
  return NextResponse.json(papers);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();

  const {
    title, authors, abstract, year, doi, arxivId,
    semanticScholarId, openalexId, source, url,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Check for duplicate by DOI, arxiv ID, or title+year
  if (doi) {
    const existing = db.prepare("SELECT id FROM papers WHERE doi = ?").get(doi) as { id: number } | undefined;
    if (existing) return NextResponse.json({ id: existing.id, duplicate: true });
  }
  if (arxivId) {
    const existing = db.prepare("SELECT id FROM papers WHERE arxiv_id = ?").get(arxivId) as { id: number } | undefined;
    if (existing) return NextResponse.json({ id: existing.id, duplicate: true });
  }
  if (semanticScholarId) {
    const existing = db.prepare("SELECT id FROM papers WHERE semantic_scholar_id = ?").get(semanticScholarId) as { id: number } | undefined;
    if (existing) return NextResponse.json({ id: existing.id, duplicate: true });
  }
  // Fallback: title + year match for papers without external IDs
  if (title && year) {
    const existing = db.prepare("SELECT id FROM papers WHERE title = ? AND year = ?").get(title, year) as { id: number } | undefined;
    if (existing) return NextResponse.json({ id: existing.id, duplicate: true });
  }

  const result = db.prepare(`
    INSERT INTO papers (title, authors, abstract, year, doi, arxiv_id, semantic_scholar_id, openalex_id, source, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    JSON.stringify(authors || []),
    abstract || "",
    year || null,
    doi || null,
    arxivId || null,
    semanticScholarId || null,
    openalexId || null,
    source || "manual",
    url || null
  );

  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}

function rowToPaper(row: PaperRow) {
  return {
    id: row.id,
    title: row.title,
    authors: JSON.parse(row.authors),
    abstract: row.abstract,
    year: row.year,
    doi: row.doi,
    arxivId: row.arxiv_id,
    semanticScholarId: row.semantic_scholar_id,
    openalexId: row.openalex_id,
    source: row.source,
    url: row.url,
    pdfPath: row.pdf_path,
    hasPdfText: !!row.pdf_text,
    createdAt: row.created_at,
  };
}
