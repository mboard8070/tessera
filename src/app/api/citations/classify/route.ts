import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chatCompletion, buildCitationClassificationPrompt } from "@/lib/llm";
import { createTask, runAsync } from "@/lib/tasks";
import type { PaperRow } from "@/lib/types";

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { collectionId, paperId } = body;

  interface CitRow { id: number; citing_paper_id: number; cited_paper_id: number; relationship_type?: string }

  // Get citations to classify
  let citations: CitRow[];

  if (paperId) {
    citations = db.prepare(
      "SELECT * FROM citations WHERE (citing_paper_id = ? OR cited_paper_id = ?) AND (relationship_type IS NULL OR relationship_type = 'mentions')"
    ).all(Number(paperId), Number(paperId)) as CitRow[];
  } else if (collectionId) {
    const paperIds = db.prepare(
      "SELECT paper_id FROM collection_papers WHERE collection_id = ?"
    ).all(Number(collectionId)).map((r: unknown) => (r as { paper_id: number }).paper_id);

    if (paperIds.length === 0) {
      return NextResponse.json({ error: "No papers in collection" }, { status: 400 });
    }

    const placeholders = paperIds.map(() => "?").join(",");
    citations = db.prepare(
      `SELECT * FROM citations
       WHERE (citing_paper_id IN (${placeholders}) OR cited_paper_id IN (${placeholders}))
         AND (relationship_type IS NULL OR relationship_type = 'mentions')`
    ).all(...paperIds, ...paperIds) as CitRow[];
  } else {
    return NextResponse.json({ error: "Provide collectionId or paperId" }, { status: 400 });
  }

  if (citations.length === 0) {
    return NextResponse.json({ message: "No unclassified citations found", classified: 0 });
  }

  const taskId = createTask("classify_citations", 0);

  runAsync(taskId, async () => {
    let classified = 0;

    for (const citation of citations) {
      try {
        const citingPaper = db.prepare("SELECT * FROM papers WHERE id = ?").get(citation.citing_paper_id) as PaperRow | undefined;
        const citedPaper = db.prepare("SELECT * FROM papers WHERE id = ?").get(citation.cited_paper_id) as PaperRow | undefined;

        if (!citingPaper || !citedPaper) continue;

        // Try to find citation context from full text
        let context = "";
        if (citingPaper.pdf_text) {
          const citedLastName = JSON.parse(citedPaper.authors || "[]")[0]?.split(/\s+/).pop() || "";
          if (citedLastName) {
            const idx = citingPaper.pdf_text.toLowerCase().indexOf(citedLastName.toLowerCase());
            if (idx >= 0) {
              const start = Math.max(0, idx - 200);
              const end = Math.min(citingPaper.pdf_text.length, idx + 300);
              context = citingPaper.pdf_text.slice(start, end).replace(/\s+/g, " ").trim();
            }
          }
        }

        // Fall back to abstract if no full text context
        if (!context) {
          context = citingPaper.abstract?.slice(0, 500) || citingPaper.title;
        }

        const messages = buildCitationClassificationPrompt(
          citingPaper.title,
          citedPaper.title,
          context
        );

        const result = await chatCompletion(messages, { maxTokens: 10, temperature: 0.1 });
        const classification = result.trim().toLowerCase();

        let relType = "mentions";
        if (classification.includes("support")) relType = "supports";
        else if (classification.includes("contradict")) relType = "contradicts";

        db.prepare(
          "UPDATE citations SET relationship_type = ?, context_text = ? WHERE id = ?"
        ).run(relType, context.slice(0, 500), citation.id);

        classified++;
      } catch {
        // Skip this citation on error
      }
    }

    return `Classified ${classified} of ${citations.length} citations`;
  });

  return NextResponse.json({ taskId, total: citations.length });
}
