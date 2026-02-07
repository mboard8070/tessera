import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface ConclusionRow {
  id: number;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");

  let sql = "SELECT * FROM conclusions WHERE 1=1";
  const params: unknown[] = [];

  if (category && category !== "all") {
    sql += " AND category = ?";
    params.push(category);
  }

  sql += " ORDER BY updated_at DESC";

  const rows = db.prepare(sql).all(...params) as ConclusionRow[];

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      category: r.category,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  );
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { title, content, category } = body;

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const result = db.prepare(
    "INSERT INTO conclusions (title, content, category) VALUES (?, ?, ?)"
  ).run(title, content, category || "general");

  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}

export async function PUT(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { id, title, content, category } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  db.prepare(
    "UPDATE conclusions SET title = COALESCE(?, title), content = COALESCE(?, content), category = COALESCE(?, category), updated_at = datetime('now') WHERE id = ?"
  ).run(title || null, content || null, category || null, Number(id));

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  db.prepare("DELETE FROM conclusions WHERE id = ?").run(Number(id));
  return NextResponse.json({ success: true });
}
