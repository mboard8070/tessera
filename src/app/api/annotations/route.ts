import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const paperId = searchParams.get("paper_id");

  if (!paperId) {
    return NextResponse.json({ error: "paper_id is required" }, { status: 400 });
  }

  const annotations = db.prepare(
    "SELECT * FROM annotations WHERE paper_id = ? ORDER BY page ASC, created_at ASC"
  ).all(Number(paperId));

  return NextResponse.json(annotations);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { paperId, page, highlightText, note, color, positionJson } = body;

  if (!paperId || page === undefined) {
    return NextResponse.json({ error: "paperId and page are required" }, { status: 400 });
  }

  const result = db.prepare(`
    INSERT INTO annotations (paper_id, page, highlight_text, note, color, position_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    Number(paperId),
    Number(page),
    highlightText || "",
    note || "",
    color || "yellow",
    JSON.stringify(positionJson || {})
  );

  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}

export async function PUT(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { id, note, color } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (note !== undefined) {
    updates.push("note = ?");
    params.push(note);
  }
  if (color !== undefined) {
    updates.push("color = ?");
    params.push(color);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  params.push(Number(id));
  db.prepare(`UPDATE annotations SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  db.prepare("DELETE FROM annotations WHERE id = ?").run(Number(id));
  return NextResponse.json({ success: true });
}
