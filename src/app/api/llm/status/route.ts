import { NextResponse } from "next/server";
import { checkLlmHealth } from "@/lib/llm";

export async function GET() {
  const status = await checkLlmHealth();
  return NextResponse.json(status);
}
