import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const collectionId = searchParams.get("collection_id");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const searchTerm = `%${query}%`;

  let sql: string;
  const params: unknown[] = [];

  if (collectionId) {
    sql = `
      SELECT p.id, p.title, p.authors, p.year, p.doi, p.abstract, p.pdf_text,
             cp.collection_id
      FROM papers p
      JOIN collection_papers cp ON cp.paper_id = p.id
      WHERE cp.collection_id = ?
        AND (p.pdf_text LIKE ? OR p.abstract LIKE ? OR p.title LIKE ?)
      ORDER BY p.year DESC
    `;
    params.push(Number(collectionId), searchTerm, searchTerm, searchTerm);
  } else {
    sql = `
      SELECT p.id, p.title, p.authors, p.year, p.doi, p.abstract, p.pdf_text
      FROM papers p
      WHERE p.pdf_text LIKE ? OR p.abstract LIKE ? OR p.title LIKE ?
      ORDER BY p.year DESC
    `;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const rows = db.prepare(sql).all(...params) as (PaperRow & { collection_id?: number })[];

  const results = rows.map((row) => {
    const snippets = extractSnippets(query, row.pdf_text, row.abstract, row.title);
    return {
      paperId: row.id,
      title: row.title,
      authors: JSON.parse(row.authors || "[]"),
      year: row.year,
      doi: row.doi,
      hasPdfText: !!row.pdf_text,
      snippets,
    };
  });

  return NextResponse.json({ results, count: results.length, query });
}

function extractSnippets(
  query: string,
  pdfText: string | null,
  abstract: string,
  title: string
): { text: string; source: string }[] {
  const snippets: { text: string; source: string }[] = [];
  const lowerQuery = query.toLowerCase();

  // Search in title
  if (title.toLowerCase().includes(lowerQuery)) {
    snippets.push({ text: title, source: "title" });
  }

  // Search in abstract
  if (abstract && abstract.toLowerCase().includes(lowerQuery)) {
    const snippet = getContextSnippet(abstract, lowerQuery);
    if (snippet) snippets.push({ text: snippet, source: "abstract" });
  }

  // Search in full text - find up to 3 occurrences
  if (pdfText) {
    const lowerText = pdfText.toLowerCase();
    let startPos = 0;
    let found = 0;

    while (found < 3) {
      const idx = lowerText.indexOf(lowerQuery, startPos);
      if (idx === -1) break;

      const snippet = getContextSnippet(pdfText, lowerQuery, idx);
      if (snippet) {
        snippets.push({ text: snippet, source: "full_text" });
        found++;
      }
      startPos = idx + lowerQuery.length;
    }
  }

  return snippets;
}

function getContextSnippet(
  text: string,
  lowerQuery: string,
  knownIdx?: number
): string | null {
  const idx = knownIdx ?? text.toLowerCase().indexOf(lowerQuery);
  if (idx === -1) return null;

  const contextChars = 120;
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + lowerQuery.length + contextChars);

  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}
