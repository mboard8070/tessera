"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, ExternalLink, Loader2, FileText, BookOpen, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SaveToCollectionDialog } from "@/components/save-to-collection-dialog";
import type { SearchResult } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  semantic_scholar: "S2",
  arxiv: "arXiv",
  openalex: "OpenAlex",
  crossref: "CrossRef",
  pubmed: "PubMed",
};

const SOURCE_COLORS: Record<string, string> = {
  semantic_scholar: "bg-blue-500/20 text-blue-400",
  arxiv: "bg-red-500/20 text-red-400",
  openalex: "bg-orange-500/20 text-orange-400",
  crossref: "bg-green-500/20 text-green-400",
  pubmed: "bg-cyan-500/20 text-cyan-400",
};

interface FullTextResult {
  paperId: number;
  title: string;
  authors: string[];
  year: number | null;
  hasPdfText: boolean;
  snippets: { text: string; source: string }[];
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [ftResults, setFtResults] = useState<FullTextResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [ftLoading, setFtLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [ftSearched, setFtSearched] = useState(false);
  const [savingResult, setSavingResult] = useState<SearchResult | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("external");
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchMode, setSearchMode] = useState<"general" | "author">("general");

  const handleExternalSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setSearchOffset(0);
    setHasMore(true);
    try {
      const modeParam = searchMode === "author" ? "&mode=author" : "";
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=50&offset=0${modeParam}`);
      const data = await res.json();
      setResults(data.results || []);
      setHasMore((data.results || []).length >= 20);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, searchMode]);

  const handleLoadMore = useCallback(async () => {
    if (!query.trim()) return;
    const newOffset = searchOffset + 50;
    setLoadingMore(true);
    try {
      const modeParam = searchMode === "author" ? "&mode=author" : "";
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=50&offset=${newOffset}${modeParam}`);
      const data = await res.json();
      const newResults = data.results || [];
      if (newResults.length === 0) {
        setHasMore(false);
      } else {
        setSearchOffset(newOffset);
        // Merge and deduplicate with existing results
        setResults((prev) => {
          const existing = new Set(prev.map((r: SearchResult) => r.doi || r.arxivId || r.title));
          const unique = newResults.filter((r: SearchResult) => !existing.has(r.doi || r.arxivId || r.title));
          return [...prev, ...unique];
        });
        setHasMore(newResults.length >= 20);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [query, searchOffset, searchMode]);

  const handleFullTextSearch = useCallback(async () => {
    if (!query.trim()) return;
    setFtLoading(true);
    setFtSearched(true);
    try {
      const res = await fetch(`/api/fulltext-search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setFtResults(data.results || []);
    } catch {
      setFtResults([]);
    } finally {
      setFtLoading(false);
    }
  }, [query]);

  const handleSearch = useCallback(() => {
    if (activeTab === "external") {
      handleExternalSearch();
    } else {
      handleFullTextSearch();
    }
  }, [activeTab, handleExternalSearch, handleFullTextSearch]);

  const handleSavePaper = useCallback(async (result: SearchResult): Promise<number> => {
    const res = await fetch("/api/papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    const data = await res.json();
    const key = result.doi || result.arxivId || result.title;
    setSavedIds((prev) => new Set(prev).add(key));
    return data.id;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Search Papers</h2>
        <p className="text-muted-foreground mt-1">
          Search external databases or across your saved papers
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="external">
            <Search className="h-4 w-4 mr-1" /> External Search
          </TabsTrigger>
          <TabsTrigger value="fulltext">
            <FileText className="h-4 w-4 mr-1" /> Full-Text Search
          </TabsTrigger>
        </TabsList>

        <div className="flex gap-3 mt-4">
          <Input
            placeholder={activeTab === "external"
              ? (searchMode === "author" ? "Search by author name..." : "Search for papers, topics, or authors...")
              : "Search across all saved paper text, abstracts, and titles..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          {activeTab === "external" && (
            <Button
              variant={searchMode === "author" ? "default" : "outline"}
              size="icon"
              onClick={() => setSearchMode(searchMode === "author" ? "general" : "author")}
              title={searchMode === "author" ? "Author search active" : "Switch to author search"}
            >
              <User className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={handleSearch} disabled={(activeTab === "external" ? loading : ftLoading) || !query.trim()}>
            {(activeTab === "external" ? loading : ftLoading)
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />
            }
            Search
          </Button>
        </div>

        <TabsContent value="external">
          <ExternalResults
            results={results}
            loading={loading}
            searched={searched}
            savedIds={savedIds}
            onSave={setSavingResult}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />
        </TabsContent>

        <TabsContent value="fulltext">
          <FullTextResults
            results={ftResults}
            loading={ftLoading}
            searched={ftSearched}
            query={query}
          />
        </TabsContent>
      </Tabs>

      {savingResult && (
        <SaveToCollectionDialog
          open={!!savingResult}
          onOpenChange={(open) => !open && setSavingResult(null)}
          onSave={handleSavePaper}
          result={savingResult}
        />
      )}
    </div>
  );
}

function ExternalResults({
  results,
  loading,
  searched,
  savedIds,
  onSave,
  loadingMore,
  hasMore,
  onLoadMore,
}: {
  results: SearchResult[];
  loading: boolean;
  searched: boolean;
  savedIds: Set<string>;
  onSave: (result: SearchResult) => void;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (searched && results.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No results found. Try a different query.</div>;
  }

  if (results.length === 0) return null;

  // Count results per source
  const sourceCounts: Record<string, number> = {};
  for (const r of results) {
    sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
  }
  const sourceBreakdown = Object.entries(sourceCounts)
    .map(([s, n]) => `${SOURCE_LABELS[s] || s}: ${n}`)
    .join(", ");

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {results.length} unique results ({sourceBreakdown})
      </p>
      {results.map((result, i) => {
        const key = result.doi || result.arxivId || result.title;
        const isSaved = savedIds.has(key);
        return (
          <Card key={`${result.source}-${i}`} className="hover:border-zinc-600 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-snug">{result.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="secondary" className={SOURCE_COLORS[result.source] || ""}>
                      {SOURCE_LABELS[result.source] || result.source}
                    </Badge>
                    {result.year && <span className="text-xs text-muted-foreground">{result.year}</span>}
                    {result.citationCount !== null && (
                      <span className="text-xs text-muted-foreground">{result.citationCount} citations</span>
                    )}
                    {result.doi && (
                      <span className="text-xs text-muted-foreground font-mono">{result.doi}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {result.url && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant={isSaved ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => onSave(result)}
                    disabled={isSaved}
                  >
                    <Plus className="h-4 w-4" />
                    {isSaved ? "Saved" : "Save"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {result.authors.length > 0 && (
                <p className="text-sm text-muted-foreground mb-2">
                  {result.authors.slice(0, 5).join(", ")}
                  {result.authors.length > 5 && ` +${result.authors.length - 5} more`}
                </p>
              )}
              {result.abstract && (
                <p className="text-sm text-zinc-300 line-clamp-3">{result.abstract}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loadingMore ? "Loading more..." : `Load More Results (showing ${results.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

function FullTextResults({
  results,
  loading,
  searched,
  query,
}: {
  results: FullTextResult[];
  loading: boolean;
  searched: boolean;
  query: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!searched) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BookOpen className="h-12 w-12 mx-auto mb-4" />
        <p>Search across the full text of all your saved papers.</p>
        <p className="text-xs mt-1">Searches titles, abstracts, and extracted PDF text.</p>
      </div>
    );
  }

  if (results.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No matches found in your saved papers.</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Found in {results.length} paper{results.length !== 1 ? "s" : ""}
      </p>
      {results.map((result) => (
        <Card key={result.paperId} className="hover:border-zinc-600 transition-colors">
          <CardHeader className="pb-2">
            <Link href={`/papers/${result.paperId}`}>
              <CardTitle className="text-base leading-snug hover:text-emerald-400 transition-colors">
                {result.title}
              </CardTitle>
            </Link>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {result.year && <span className="text-xs text-muted-foreground">{result.year}</span>}
              <span className="text-xs text-muted-foreground">
                {result.authors?.slice(0, 3).join(", ")}
              </span>
              {result.hasPdfText && (
                <Badge variant="secondary" className="text-xs">PDF indexed</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.snippets.map((snippet, i) => (
                <div key={i} className="text-sm">
                  <Badge variant="outline" className="text-[10px] mr-2">
                    {snippet.source === "full_text" ? "full text" : snippet.source}
                  </Badge>
                  <span className="text-zinc-300">
                    <HighlightedText text={snippet.text} query={query} />
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-emerald-500/30 text-emerald-200 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
