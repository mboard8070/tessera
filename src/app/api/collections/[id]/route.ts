import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { CollectionRow, PaperRow, CollectionPaperRow, SynthesisRow } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const collection = db.prepare(`
    SELECT c.*, COUNT(cp.paper_id) as paper_count
    FROM collections c
    LEFT JOIN collection_papers cp ON cp.collection_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(Number(id)) as (CollectionRow & { paper_count: number }) | undefined;

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const paperRows = db.prepare(`
    SELECT p.*, cp.notes, cp.added_at
    FROM papers p
    JOIN collection_papers cp ON cp.paper_id = p.id
    WHERE cp.collection_id = ?
    ORDER BY cp.added_at DESC
  `).all(Number(id)) as (PaperRow & Pick<CollectionPaperRow, "notes" | "added_at">)[];

  const syntheses = db.prepare(
    "SELECT * FROM syntheses WHERE collection_id = ? ORDER BY created_at DESC"
  ).all(Number(id)) as SynthesisRow[];

  // Count knowledge items across all papers in this collection
  const paperIdList = paperRows.map((r) => r.id);
  let knowledgeCount = 0;
  if (paperIdList.length > 0) {
    const kPlaceholders = paperIdList.map(() => "?").join(",");
    const kRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM knowledge WHERE paper_id IN (${kPlaceholders})`
    ).get(...paperIdList) as { cnt: number };
    knowledgeCount = kRow.cnt;
  }

  return NextResponse.json({
    id: collection.id,
    name: collection.name,
    description: collection.description,
    paperCount: collection.paper_count,
    knowledgeCount,
    createdAt: collection.created_at,
    updatedAt: collection.updated_at,
    papers: paperRows.map((row) => ({
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
      notes: row.notes,
      addedAt: row.added_at,
    })),
    syntheses: syntheses.map((s) => ({
      id: s.id,
      collectionId: s.collection_id,
      synthesis: s.synthesis,
      model: s.model,
      paperIds: JSON.parse(s.paper_ids),
      createdAt: s.created_at,
    })),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const existing = db.prepare("SELECT id FROM collections WHERE id = ?").get(Number(id));
  if (!existing) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const { name, description } = body;
  db.prepare(
    "UPDATE collections SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = datetime('now') WHERE id = ?"
  ).run(name || null, description ?? null, Number(id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM collections WHERE id = ?").run(Number(id));
  return NextResponse.json({ success: true });
}
