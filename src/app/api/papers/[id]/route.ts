import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM papers WHERE id = ?").get(Number(id)) as PaperRow | undefined;

  if (!row) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  return NextResponse.json({
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
    pdfText: row.pdf_text,
    hasPdfText: !!row.pdf_text,
    createdAt: row.created_at,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const existing = db.prepare("SELECT id FROM papers WHERE id = ?").get(Number(id));
  if (!existing) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(body)) {
    const col = key === "arxivId" ? "arxiv_id"
      : key === "semanticScholarId" ? "semantic_scholar_id"
      : key === "openalexId" ? "openalex_id"
      : key === "pdfPath" ? "pdf_path"
      : key === "pdfText" ? "pdf_text"
      : key === "authors" ? "authors"
      : key;

    if (col === "authors") {
      fields.push("authors = ?");
      values.push(JSON.stringify(value));
    } else if (["title", "abstract", "year", "doi", "arxiv_id", "semantic_scholar_id", "openalex_id", "source", "url", "pdf_path", "pdf_text"].includes(col)) {
      fields.push(`${col} = ?`);
      values.push(value);
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(Number(id));
    db.prepare(`UPDATE papers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM papers WHERE id = ?").run(Number(id));
  return NextResponse.json({ success: true });
}
