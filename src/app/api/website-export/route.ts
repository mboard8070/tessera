import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateWebsite } from "@/lib/website-export";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const collectionId = body.collectionId;

    if (!collectionId || typeof collectionId !== "number") {
      return NextResponse.json(
        { error: "collectionId is required and must be a number" },
        { status: 400 }
      );
    }

    // Verify collection exists
    const db = getDb();
    const collection = db
      .prepare("SELECT id, name FROM collections WHERE id = ?")
      .get(collectionId) as { id: number; name: string } | undefined;

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const zipBuffer = await generateWebsite(collectionId);

    const safeName = collection.name
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .toLowerCase();

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}_research_site.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate website";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
