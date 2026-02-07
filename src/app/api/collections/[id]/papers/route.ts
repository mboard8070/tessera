import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { paperId, notes } = body;

  if (!paperId) {
    return NextResponse.json({ error: "paperId is required" }, { status: 400 });
  }

  // Verify both exist
  const collection = db.prepare("SELECT id FROM collections WHERE id = ?").get(Number(id));
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const paper = db.prepare("SELECT id FROM papers WHERE id = ?").get(Number(paperId));
  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Check if already in collection
  const existing = db.prepare(
    "SELECT 1 FROM collection_papers WHERE collection_id = ? AND paper_id = ?"
  ).get(Number(id), Number(paperId));

  if (existing) {
    // Update notes if provided, otherwise just report it already exists
    if (notes) {
      db.prepare(
        "UPDATE collection_papers SET notes = ? WHERE collection_id = ? AND paper_id = ?"
      ).run(notes, Number(id), Number(paperId));
    }
    return NextResponse.json({ success: true, alreadyExists: true });
  }

  db.prepare(
    "INSERT INTO collection_papers (collection_id, paper_id, notes) VALUES (?, ?, ?)"
  ).run(Number(id), Number(paperId), notes || "");

  db.prepare("UPDATE collections SET updated_at = datetime('now') WHERE id = ?").run(Number(id));

  return NextResponse.json({ success: true, alreadyExists: false });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { paperId } = body;

  if (!paperId) {
    return NextResponse.json({ error: "paperId is required" }, { status: 400 });
  }

  db.prepare(
    "DELETE FROM collection_papers WHERE collection_id = ? AND paper_id = ?"
  ).run(Number(id), Number(paperId));

  db.prepare("UPDATE collections SET updated_at = datetime('now') WHERE id = ?").run(Number(id));

  return NextResponse.json({ success: true });
}
