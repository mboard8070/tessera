import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow, CitationRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const collectionId = searchParams.get("collection_id");
  const paperId = searchParams.get("paper_id");
  const includeInferred = searchParams.get("include_inferred") !== "false";

  let paperIds: number[];

  if (collectionId) {
    const rows = db.prepare(
      "SELECT paper_id FROM collection_papers WHERE collection_id = ?"
    ).all(Number(collectionId)) as { paper_id: number }[];
    paperIds = rows.map((r) => r.paper_id);
  } else if (paperId) {
    paperIds = [Number(paperId)];
    const citations = db.prepare(
      "SELECT citing_paper_id, cited_paper_id FROM citations WHERE citing_paper_id = ? OR cited_paper_id = ?"
    ).all(Number(paperId), Number(paperId)) as CitationRow[];
    for (const c of citations) {
      if (!paperIds.includes(c.citing_paper_id)) paperIds.push(c.citing_paper_id);
      if (!paperIds.includes(c.cited_paper_id)) paperIds.push(c.cited_paper_id);
    }
  } else {
    const citations = db.prepare("SELECT DISTINCT citing_paper_id, cited_paper_id FROM citations").all() as CitationRow[];
    const idSet = new Set<number>();
    for (const c of citations) {
      idSet.add(c.citing_paper_id);
      idSet.add(c.cited_paper_id);
    }
    paperIds = [...idSet];
  }

  if (paperIds.length === 0) {
    return NextResponse.json({ nodes: [], edges: [] });
  }

  const placeholders = paperIds.map(() => "?").join(",");
  const papers = db.prepare(
    `SELECT * FROM papers WHERE id IN (${placeholders})`
  ).all(...paperIds) as PaperRow[];

  const citations = db.prepare(
    `SELECT * FROM citations WHERE citing_paper_id IN (${placeholders}) AND cited_paper_id IN (${placeholders})`
  ).all(...paperIds, ...paperIds) as (CitationRow & { relationship_type?: string })[];

  // Build direct citation edges
  const edges: GraphEdge[] = citations.map((c) => ({
    source: String(c.citing_paper_id),
    target: String(c.cited_paper_id),
    type: "citation" as const,
    relationship: (c.relationship_type as "supports" | "contradicts" | "mentions") || "mentions",
  }));

  // Inferred edges: co-citation and bibliographic coupling
  if (includeInferred && paperIds.length > 1) {
    // Co-citation: papers A and B are co-cited if some paper C cites both A and B
    const coCitations = db.prepare(`
      SELECT c1.cited_paper_id AS paper_a, c2.cited_paper_id AS paper_b, COUNT(*) AS strength
      FROM citations c1
      JOIN citations c2 ON c1.citing_paper_id = c2.citing_paper_id
        AND c1.cited_paper_id < c2.cited_paper_id
      WHERE c1.cited_paper_id IN (${placeholders})
        AND c2.cited_paper_id IN (${placeholders})
      GROUP BY c1.cited_paper_id, c2.cited_paper_id
      HAVING COUNT(*) >= 1
    `).all(...paperIds, ...paperIds) as { paper_a: number; paper_b: number; strength: number }[];

    for (const cc of coCitations) {
      edges.push({
        source: String(cc.paper_a),
        target: String(cc.paper_b),
        type: "co_citation",
        strength: cc.strength,
      });
    }

    // Bibliographic coupling: papers A and B both cite the same paper C
    const bibCoupling = db.prepare(`
      SELECT c1.citing_paper_id AS paper_a, c2.citing_paper_id AS paper_b, COUNT(*) AS strength
      FROM citations c1
      JOIN citations c2 ON c1.cited_paper_id = c2.cited_paper_id
        AND c1.citing_paper_id < c2.citing_paper_id
      WHERE c1.citing_paper_id IN (${placeholders})
        AND c2.citing_paper_id IN (${placeholders})
      GROUP BY c1.citing_paper_id, c2.citing_paper_id
      HAVING COUNT(*) >= 1
    `).all(...paperIds, ...paperIds) as { paper_a: number; paper_b: number; strength: number }[];

    for (const bc of bibCoupling) {
      edges.push({
        source: String(bc.paper_a),
        target: String(bc.paper_b),
        type: "bibliographic_coupling",
        strength: bc.strength,
      });
    }
  }

  // Build nodes
  const nodes = papers.map((p) => ({
    id: String(p.id),
    paperId: p.id,
    title: p.title,
    year: p.year,
    authors: JSON.parse(p.authors),
    citationCount: citations.filter((c) => c.cited_paper_id === p.id).length,
  }));

  return NextResponse.json({ nodes, edges });
}

interface GraphEdge {
  source: string;
  target: string;
  type: "citation" | "co_citation" | "bibliographic_coupling";
  relationship?: "supports" | "contradicts" | "mentions";
  strength?: number;
}
