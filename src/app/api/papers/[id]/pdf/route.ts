import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PaperRow } from "@/lib/types";
import path from "path";
import fs from "fs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const paper = db.prepare("SELECT pdf_text, pdf_path FROM papers WHERE id = ?").get(Number(id)) as Pick<PaperRow, "pdf_text" | "pdf_path"> | undefined;

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  return NextResponse.json({
    pdfPath: paper.pdf_path,
    pdfText: paper.pdf_text,
    hasPdfText: !!paper.pdf_text,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const paper = db.prepare("SELECT id FROM papers WHERE id = ?").get(Number(id)) as { id: number } | undefined;
  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // Save PDF to disk
  const pdfDir = path.join(process.cwd(), "data", "pdfs");
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }

  const filename = `${id}_${Date.now()}.pdf`;
  const filepath = path.join(pdfDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  // Extract text using pdf-parse
  let pdfText = "";
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    pdfText = data.text || "";
  } catch (e) {
    console.error("PDF parse error:", e);
  }

  // Update paper record
  db.prepare(
    "UPDATE papers SET pdf_path = ?, pdf_text = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(filepath, pdfText, Number(id));

  return NextResponse.json({
    pdfPath: filepath,
    textLength: pdfText.length,
    success: true,
  });
}
