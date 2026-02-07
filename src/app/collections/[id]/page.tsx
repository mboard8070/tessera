"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, BookOpen, Share2, StickyNote, Loader2, Trash2, ExternalLink, FileDown, Upload } from "lucide-react";
import { WebsiteExportDialog } from "@/components/website-export-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Paper, Synthesis } from "@/lib/types";

interface CollectionData {
  id: number;
  name: string;
  description: string;
  paperCount: number;
  knowledgeCount?: number;
  papers: (Paper & { notes: string; addedAt: string })[];
  syntheses: Synthesis[];
}

export default function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthTaskId, setSynthTaskId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/collections/${id}`);
      if (!res.ok) return;
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for synthesis task completion
  useEffect(() => {
    if (!synthTaskId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/tasks/${synthTaskId}`);
      const task = await res.json();
      if (task.status === "completed" || task.status === "failed") {
        setSynthesizing(false);
        setSynthTaskId(null);
        fetchData();
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [synthTaskId, fetchData]);

  const handleRemovePaper = useCallback(
    async (paperId: number) => {
      await fetch(`/api/collections/${id}/papers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      fetchData();
    },
    [id, fetchData]
  );

  const handleSynthesize = useCallback(async () => {
    setSynthesizing(true);
    try {
      const res = await fetch(`/api/collections/${id}/synthesize`, { method: "POST" });
      const data = await res.json();
      if (data.taskId) {
        setSynthTaskId(data.taskId);
      } else {
        setSynthesizing(false);
        fetchData();
      }
    } catch {
      setSynthesizing(false);
    }
  }, [id, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Collection not found</h3>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/collections">Back to Collections</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/collections"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{data.name}</h2>
          {data.description && <p className="text-muted-foreground mt-1">{data.description}</p>}
        </div>
        <div className="flex gap-2">
          {data.papers.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/export?collection_id=${data.id}`} download={`${data.name}.bib`}>
                <FileDown className="h-4 w-4" /> BibTeX
              </a>
            </Button>
          )}
          {data.papers.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/collections/export?collection_id=${data.id}`} download={`${data.name}_bundle.json`}>
                <Upload className="h-4 w-4" /> Export Bundle
              </a>
            </Button>
          )}
          {data.papers.length > 0 && (
            <WebsiteExportDialog
              collectionId={data.id}
              collectionName={data.name}
              paperCount={data.papers.length}
              synthesisCount={data.syntheses.length}
              knowledgeCount={data.knowledgeCount ?? 0}
            />
          )}
        </div>
      </div>

      <Tabs defaultValue="papers">
        <TabsList>
          <TabsTrigger value="papers">
            <FileText className="h-4 w-4 mr-1" /> Papers ({data.papers.length})
          </TabsTrigger>
          <TabsTrigger value="synthesis">
            <BookOpen className="h-4 w-4 mr-1" /> Synthesis
          </TabsTrigger>
          <TabsTrigger value="graph">
            <Share2 className="h-4 w-4 mr-1" /> Citation Graph
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-4 w-4 mr-1" /> Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="papers">
          <PapersTab papers={data.papers} onRemove={handleRemovePaper} />
        </TabsContent>

        <TabsContent value="synthesis">
          <SynthesisTab
            syntheses={data.syntheses}
            paperCount={data.papers.length}
            synthesizing={synthesizing}
            onSynthesize={handleSynthesize}
          />
        </TabsContent>

        <TabsContent value="graph">
          <div className="text-center py-12 text-muted-foreground">
            <Share2 className="h-12 w-12 mx-auto mb-4" />
            <p>Citation graph visualization</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href={`/graph?collection=${id}`}>Open Full Graph</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab collectionId={Number(id)} papers={data.papers} onUpdate={fetchData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PapersTab({
  papers,
  onRemove,
}: {
  papers: (Paper & { notes: string; addedAt: string })[];
  onRemove: (id: number) => void;
}) {
  if (papers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4" />
        <p>No papers in this collection yet.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/search">Search & Add Papers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {papers.map((paper) => (
        <Card key={paper.id} className="hover:border-zinc-600 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <Link href={`/papers/${paper.id}`} className="flex-1 min-w-0">
                <CardTitle className="text-base leading-snug hover:text-emerald-400 transition-colors">
                  {paper.title}
                </CardTitle>
              </Link>
              <div className="flex gap-1 shrink-0">
                {paper.url && (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={paper.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onRemove(paper.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {paper.year && <span>{paper.year}</span>}
              <span>{paper.authors.slice(0, 3).join(", ")}</span>
              {paper.hasPdfText && <Badge variant="secondary" className="text-xs">PDF</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SynthesisTab({
  syntheses,
  paperCount,
  synthesizing,
  onSynthesize,
}: {
  syntheses: Synthesis[];
  paperCount: number;
  synthesizing: boolean;
  onSynthesize: () => void;
}) {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          AI-generated literature review across {paperCount} papers
        </p>
        <Button onClick={onSynthesize} disabled={synthesizing || paperCount === 0}>
          {synthesizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          {synthesizing ? "Synthesizing..." : "Generate Synthesis"}
        </Button>
      </div>

      {syntheses.length === 0 && !synthesizing ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4" />
          <p>No synthesis generated yet.</p>
          <p className="text-sm mt-1">Click &ldquo;Generate Synthesis&rdquo; to create a literature review.</p>
        </div>
      ) : (
        syntheses.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Generated on {new Date(s.createdAt + "Z").toLocaleDateString()} using {s.model} ({s.paperIds.length} papers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                {s.synthesis}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function NotesTab({
  collectionId,
  papers,
  onUpdate,
}: {
  collectionId: number;
  papers: (Paper & { notes: string })[];
  onUpdate: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  const handleSaveNote = async (paperId: number) => {
    await fetch(`/api/collections/${collectionId}/papers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId, notes: noteText }),
    });
    setEditingId(null);
    onUpdate();
  };

  return (
    <div className="space-y-3 mt-4">
      {papers.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">Add papers to this collection to take notes.</p>
      ) : (
        papers.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{p.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {editingId === p.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    placeholder="Write notes about this paper..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveNote(p.id)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => {
                    setEditingId(p.id);
                    setNoteText(p.notes || "");
                  }}
                >
                  {p.notes || "Click to add notes..."}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
