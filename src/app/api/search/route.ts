import { NextRequest, NextResponse } from "next/server";
import { federatedSearch, type SourceName } from "@/lib/sources";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const sourcesParam = searchParams.get("sources");
  const limitParam = searchParams.get("limit");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const offsetParam = searchParams.get("offset");
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  const validSources: SourceName[] = ["semantic_scholar", "arxiv", "openalex", "crossref", "pubmed"];
  const sources: SourceName[] = sourcesParam
    ? (sourcesParam.split(",").filter((s) => validSources.includes(s as SourceName)) as SourceName[])
    : validSources;

  const results = await federatedSearch(query, sources, limit, offset);

  return NextResponse.json({ results, count: results.length, offset, limit });
}
