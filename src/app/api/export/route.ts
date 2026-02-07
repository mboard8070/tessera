import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const paperId = searchParams.get("paper_id");
  const collectionId = searchParams.get("collection_id");

  let rows: PaperRow[];

  if (paperId) {
    const row = db.prepare("SELECT * FROM papers WHERE id = ?").get(Number(paperId)) as PaperRow | undefined;
    rows = row ? [row] : [];
  } else if (collectionId) {
    rows = db.prepare(`
      SELECT p.* FROM papers p
      JOIN collection_papers cp ON cp.paper_id = p.id
      WHERE cp.collection_id = ?
      ORDER BY p.year DESC, p.title ASC
    `).all(Number(collectionId)) as PaperRow[];
  } else {
    rows = db.prepare("SELECT * FROM papers ORDER BY year DESC, title ASC").all() as PaperRow[];
  }

  if (rows.length === 0) {
    return new NextResponse("% No papers found\n", {
      headers: { "Content-Type": "application/x-bibtex; charset=utf-8" },
    });
  }

  const bibtex = rows.map((row) => paperToBibtex(row)).join("\n\n");

  return new NextResponse(bibtex, {
    headers: {
      "Content-Type": "application/x-bibtex; charset=utf-8",
      "Content-Disposition": `attachment; filename="references.bib"`,
    },
  });
}

function paperToBibtex(row: PaperRow): string {
  const authors: string[] = JSON.parse(row.authors || "[]");
  const key = generateCiteKey(authors, row.year, row.title);

  const fields: string[] = [];
  fields.push(`  title = {${escapeBibtex(row.title)}}`);

  if (authors.length > 0) {
    fields.push(`  author = {${authors.map(escapeBibtex).join(" and ")}}`);
  }
  if (row.year) {
    fields.push(`  year = {${row.year}}`);
  }
  if (row.doi) {
    fields.push(`  doi = {${escapeBibtex(row.doi)}}`);
  }
  if (row.url) {
    fields.push(`  url = {${row.url}}`);
  }
  if (row.abstract) {
    fields.push(`  abstract = {${escapeBibtex(row.abstract.slice(0, 2000))}}`);
  }
  if (row.arxiv_id) {
    fields.push(`  eprint = {${row.arxiv_id}}`);
    fields.push(`  archiveprefix = {arXiv}`);
  }

  return `@article{${key},\n${fields.join(",\n")}\n}`;
}

function generateCiteKey(authors: string[], year: number | null, title: string): string {
  let authorPart = "unknown";
  if (authors.length > 0) {
    const lastName = authors[0].split(/\s+/).pop() || authors[0];
    authorPart = lastName.toLowerCase().replace(/[^a-z]/g, "");
  }

  const yearPart = year ? String(year) : "nd";

  const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const titlePart = titleWords[0] || "paper";

  return `${authorPart}${yearPart}${titlePart}`;
}

function escapeBibtex(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/[{}]/g, (m) => `\\${m}`)
    .replace(/&/g, "\\&")
    .replace(/#/g, "\\#")
    .replace(/%/g, "\\%");
}
