"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CitationGraph } from "@/components/citation-graph";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Download, Sparkles } from "lucide-react";
import type { Collection } from "@/lib/types";

function GraphPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCollection = searchParams.get("collection");
  const initialPaper = searchParams.get("paper");

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>(initialCollection || "all");
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [classifying, setClassifying] = useState(false);
  const [classifyStatus, setClassifyStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then(setCollections)
      .catch(() => setCollections([]));
  }, []);

  const handleCollectionChange = useCallback((value: string) => {
    setSelectedCollection(value);
    setFetchStatus(null);
    setGraphKey((k) => k + 1);
  }, []);

  const handleNodeClick = useCallback((paperId: number) => {
    router.push(`/papers/${paperId}`);
  }, [router]);

  const handleFetchAllCitations = useCallback(async () => {
    setFetchingAll(true);
    setFetchStatus("Finding papers...");

    try {
      // Get papers for the current scope
      const papersUrl = selectedCollection !== "all"
        ? `/api/papers?collection_id=${selectedCollection}`
        : "/api/papers";
      const papersRes = await fetch(papersUrl);
      const papers: { id: number; title: string }[] = await papersRes.json();

      if (papers.length === 0) {
        setFetchStatus("No papers to fetch citations for.");
        setFetchingAll(false);
        return;
      }

      let totalRefs = 0;
      let totalCites = 0;

      for (let i = 0; i < papers.length; i++) {
        setFetchStatus(`Fetching citations for paper ${i + 1}/${papers.length}...`);
        try {
          const res = await fetch(`/api/papers/${papers[i].id}/citations`, { method: "POST" });
          if (res.ok) {
            const result = await res.json();
            totalRefs += result.referencesAdded || 0;
            totalCites += result.citationsAdded || 0;
          }
        } catch {
          // Continue with next paper
        }
      }

      setFetchStatus(`Done! Added ${totalRefs} references and ${totalCites} citations across ${papers.length} papers.`);
      setGraphKey((k) => k + 1);
    } catch {
      setFetchStatus("Failed to fetch citations.");
    } finally {
      setFetchingAll(false);
    }
  }, [selectedCollection]);

  const handleClassifyCitations = useCallback(async () => {
    setClassifying(true);
    setClassifyStatus("Starting classification...");
    try {
      const body = selectedCollection !== "all"
        ? { collectionId: Number(selectedCollection) }
        : { collectionId: undefined, paperId: undefined };
      const res = await fetch("/api/citations/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.taskId) {
        setClassifyStatus(`Classifying ${data.total} citations via LLM...`);
        // Poll for completion
        const interval = setInterval(async () => {
          const taskRes = await fetch(`/api/tasks/${data.taskId}`);
          const task = await taskRes.json();
          if (task.status === "completed" || task.status === "failed") {
            clearInterval(interval);
            setClassifying(false);
            setClassifyStatus(task.status === "completed" ? `Done! ${task.result}` : "Classification failed.");
            setGraphKey((k) => k + 1);
          }
        }, 3000);
      } else {
        setClassifyStatus(data.message || "No citations to classify.");
        setClassifying(false);
      }
    } catch {
      setClassifyStatus("Classification failed.");
      setClassifying(false);
    }
  }, [selectedCollection]);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Citation Graph</h2>
          <p className="text-muted-foreground mt-1">
            Visualize citation relationships between papers
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!initialPaper && (
            <Button
              onClick={handleClassifyCitations}
              disabled={classifying || fetchingAll}
              variant="outline"
            >
              {classifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {classifying ? "Classifying..." : "Classify Citations"}
            </Button>
          )}
          {!initialPaper && (
            <Button
              onClick={handleFetchAllCitations}
              disabled={fetchingAll || classifying}
              variant="outline"
            >
              {fetchingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {fetchingAll ? "Fetching..." : "Fetch All Citations"}
            </Button>
          )}
          {!initialPaper && (
            <Select value={selectedCollection} onValueChange={handleCollectionChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select collection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All papers</SelectItem>
                {collections.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} ({c.paperCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {(fetchStatus || classifyStatus) && (
        <Card className="mb-4">
          <CardContent className="pt-4 pb-3 space-y-1">
            {fetchStatus && (
              <p className={`text-sm ${fetchingAll ? "text-muted-foreground" : "text-emerald-400"}`}>
                {fetchStatus}
              </p>
            )}
            {classifyStatus && (
              <p className={`text-sm ${classifying ? "text-muted-foreground" : "text-emerald-400"}`}>
                {classifyStatus}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex-1 rounded-lg border border-zinc-800 overflow-hidden">
        <CitationGraph
          key={graphKey}
          collectionId={
            initialPaper
              ? undefined
              : selectedCollection !== "all"
                ? Number(selectedCollection)
                : undefined
          }
          paperId={initialPaper ? Number(initialPaper) : undefined}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <GraphPageInner />
    </Suspense>
  );
}
