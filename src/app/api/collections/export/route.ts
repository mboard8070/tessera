import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const collectionId = searchParams.get("collection_id");

  if (!collectionId) {
    return NextResponse.json({ error: "collection_id is required" }, { status: 400 });
  }

  const collection = db.prepare(
    "SELECT * FROM collections WHERE id = ?"
  ).get(Number(collectionId)) as { id: number; name: string; description: string } | undefined;

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  // Get papers with notes
  const papers = db.prepare(`
    SELECT p.*, cp.notes FROM papers p
    JOIN collection_papers cp ON cp.paper_id = p.id
    WHERE cp.collection_id = ?
    ORDER BY p.year DESC
  `).all(Number(collectionId)) as (PaperRow & { notes: string })[];

  const paperData = papers.map((p) => ({
    title: p.title,
    authors: JSON.parse(p.authors || "[]"),
    abstract: p.abstract,
    year: p.year,
    doi: p.doi,
    arxivId: p.arxiv_id,
    semanticScholarId: p.semantic_scholar_id,
    openalexId: p.openalex_id,
    source: p.source,
    url: p.url,
    notes: p.notes || "",
  }));

  // Get syntheses
  const syntheses = db.prepare(
    "SELECT synthesis, model, created_at FROM syntheses WHERE collection_id = ? ORDER BY created_at DESC"
  ).all(Number(collectionId)) as { synthesis: string; model: string; created_at: string }[];

  // Get knowledge for papers in this collection
  const paperIds = papers.map((p) => p.id);
  let knowledge: { category: string; content: string }[] = [];
  if (paperIds.length > 0) {
    const placeholders = paperIds.map(() => "?").join(",");
    knowledge = db.prepare(
      `SELECT category, content FROM knowledge WHERE paper_id IN (${placeholders})`
    ).all(...paperIds) as { category: string; content: string }[];
  }

  // Get conclusions
  const conclusions = db.prepare(
    "SELECT title, content, category FROM conclusions ORDER BY created_at DESC"
  ).all() as { title: string; content: string; category: string }[];

  const bundle = {
    name: collection.name,
    description: collection.description,
    papers: paperData,
    syntheses: syntheses.map((s) => ({
      synthesis: s.synthesis,
      model: s.model,
      createdAt: s.created_at,
    })),
    knowledge,
    conclusions,
    exportedAt: new Date().toISOString(),
    version: 1,
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${collection.name.replace(/[^a-zA-Z0-9]/g, "_")}_bundle.json"`,
    },
  });
}
