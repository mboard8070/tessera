import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { KnowledgeRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const paperId = searchParams.get("paper_id");
  const category = searchParams.get("category");
  const search = searchParams.get("q");

  let sql = `
    SELECT k.*, p.title as paper_title
    FROM knowledge k
    JOIN papers p ON p.id = k.paper_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (paperId) {
    sql += " AND k.paper_id = ?";
    params.push(Number(paperId));
  }
  if (category) {
    sql += " AND k.category = ?";
    params.push(category);
  }
  if (search) {
    sql += " AND k.content LIKE ?";
    params.push(`%${search}%`);
  }

  sql += " ORDER BY k.created_at DESC";

  const rows = db.prepare(sql).all(...params) as (KnowledgeRow & { paper_title: string })[];

  const items = rows.map((r) => ({
    id: r.id,
    paperId: r.paper_id,
    paperTitle: r.paper_title,
    category: r.category,
    content: r.content,
    createdAt: r.created_at,
  }));

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { paperId, category, content } = body;

  if (!paperId || !category || !content) {
    return NextResponse.json({ error: "paperId, category, and content are required" }, { status: 400 });
  }

  const valid = ["finding", "method", "gap", "contribution", "limitation", "future_work"];
  if (!valid.includes(category)) {
    return NextResponse.json({ error: `Invalid category. Must be one of: ${valid.join(", ")}` }, { status: 400 });
  }

  const result = db.prepare(
    "INSERT INTO knowledge (paper_id, category, content) VALUES (?, ?, ?)"
  ).run(Number(paperId), category, content);

  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}

export async function DELETE(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  db.prepare("DELETE FROM knowledge WHERE id = ?").run(Number(id));
  return NextResponse.json({ success: true });
}
