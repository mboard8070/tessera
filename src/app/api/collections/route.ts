import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { CollectionRow } from "@/lib/types";

export async function GET() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.*, COUNT(cp.paper_id) as paper_count
    FROM collections c
    LEFT JOIN collection_papers cp ON cp.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `).all() as (CollectionRow & { paper_count: number })[];

  const collections = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    paperCount: row.paper_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json(collections);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { name, description } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = db.prepare(
    "INSERT INTO collections (name, description) VALUES (?, ?)"
  ).run(name, description || "");

  return NextResponse.json({
    id: Number(result.lastInsertRowid),
    name,
    description: description || "",
  });
}
