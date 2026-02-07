import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chatCompletion, buildSummarizePrompt, buildKnowledgeExtractionPrompt, MODEL_NAME } from "@/lib/llm";
import { createTask, runAsync } from "@/lib/tasks";
import type { PaperRow, SummaryRow } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM summaries WHERE paper_id = ? ORDER BY created_at DESC"
  ).all(Number(id)) as SummaryRow[];

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      paperId: r.paper_id,
      summary: r.summary,
      model: r.model,
      createdAt: r.created_at,
    }))
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const paper = db.prepare("SELECT * FROM papers WHERE id = ?").get(Number(id)) as PaperRow | undefined;
  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const taskId = createTask("summarize", paper.id);

  runAsync(taskId, async () => {
    // Step 1: Generate summary
    const messages = buildSummarizePrompt(paper.title, paper.abstract, paper.pdf_text);
    const summary = await chatCompletion(messages, { maxTokens: 4096 });

    db.prepare(
      "INSERT INTO summaries (paper_id, summary, model) VALUES (?, ?, ?)"
    ).run(paper.id, summary, MODEL_NAME);

    // Step 2: Auto-extract knowledge entries
    try {
      const knowledgeMessages = buildKnowledgeExtractionPrompt(paper.title, paper.abstract, paper.pdf_text);
      const knowledgeRaw = await chatCompletion(knowledgeMessages, { maxTokens: 2048, temperature: 0.2 });

      // Parse the JSON response — handle markdown code fences if present
      let cleaned = knowledgeRaw.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const entries = JSON.parse(cleaned);
      const validCategories = ["finding", "method", "gap", "contribution", "limitation", "future_work"];

      const insertKnowledge = db.prepare(
        "INSERT INTO knowledge (paper_id, category, content) VALUES (?, ?, ?)"
      );

      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (
            entry.category &&
            entry.content &&
            validCategories.includes(entry.category) &&
            typeof entry.content === "string"
          ) {
            insertKnowledge.run(paper.id, entry.category, entry.content.trim());
          }
        }
      }
    } catch (e) {
      // Knowledge extraction is best-effort — don't fail the whole task
      console.error("Knowledge extraction failed:", e);
    }

    return summary;
  });

  return NextResponse.json({ taskId });
}
