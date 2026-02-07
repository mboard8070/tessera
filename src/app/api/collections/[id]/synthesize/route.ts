import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chatCompletion, buildSynthesisPrompt, MODEL_NAME } from "@/lib/llm";
import { createTask, runAsync } from "@/lib/tasks";
import type { CollectionRow, PaperRow } from "@/lib/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const collection = db.prepare("SELECT * FROM collections WHERE id = ?").get(Number(id)) as CollectionRow | undefined;
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const papers = db.prepare(`
    SELECT p.* FROM papers p
    JOIN collection_papers cp ON cp.paper_id = p.id
    WHERE cp.collection_id = ?
    ORDER BY p.year DESC
  `).all(Number(id)) as PaperRow[];

  if (papers.length === 0) {
    return NextResponse.json({ error: "No papers in collection" }, { status: 400 });
  }

  const taskId = createTask("synthesize", collection.id);

  runAsync(taskId, async () => {
    const paperInputs = papers.map((p) => ({
      title: p.title,
      abstract: p.abstract,
      year: p.year,
    }));

    const messages = buildSynthesisPrompt(collection.name, paperInputs);
    const synthesis = await chatCompletion(messages, { maxTokens: 8192 });

    const paperIds = papers.map((p) => p.id);
    db.prepare(
      "INSERT INTO syntheses (collection_id, synthesis, model, paper_ids) VALUES (?, ?, ?, ?)"
    ).run(collection.id, synthesis, MODEL_NAME, JSON.stringify(paperIds));

    return synthesis;
  });

  return NextResponse.json({ taskId });
}
