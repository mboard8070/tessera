import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, institution, role, message } = body;

  if (!name || !email || !institution) {
    return NextResponse.json(
      { error: "Name, email, and institution are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  db.prepare(
    "INSERT INTO demo_requests (name, email, institution, role, message) VALUES (?, ?, ?, ?, ?)"
  ).run(name, email, institution, role || "", message || "");

  return NextResponse.json({ success: true });
}
