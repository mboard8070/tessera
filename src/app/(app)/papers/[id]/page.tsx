"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, BookOpen, Lightbulb, Share2,
  Loader2, ExternalLink, Upload, Trash2, Download, FileDown, MessageSquare, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Summary, Knowledge, KnowledgeCategory } from "@/lib/types";

interface PaperData {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  doi: string | null;
  arxivId: string | null;
  source: string;
  url: string | null;
  pdfText: string | null;
  hasPdfText: boolean;
}

export default function PaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [paper, setPaper] = useState<PaperData | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [summTaskId, setSummTaskId] = useState<string | null>(null);

  const fetchPaper = useCallback(async () => {
    try {
      const res = await fetch(`/api/papers/${id}`);
      if (!res.ok) return;
      setPaper(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchSummaries = useCallback(async () => {
    const res = await fetch(`/api/papers/${id}/summarize`);
    if (res.ok) setSummaries(await res.json());
  }, [id]);

  const fetchKnowledge = useCallback(async () => {
    const res = await fetch(`/api/knowledge?paper_id=${id}`);
    if (res.ok) {
      const data = await res.json();
      setKnowledge(Array.isArray(data) ? data : data.items || []);
    }
  }, [id]);

  useEffect(() => {
    fetchPaper();
    fetchSummaries();
    fetchKnowledge();
  }, [fetchPaper, fetchSummaries, fetchKnowledge]);

  // Poll for summary task completion
  useEffect(() => {
    if (!summTaskId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/tasks/${summTaskId}`);
      const task = await res.json();
      if (task.status === "completed" || task.status === "failed") {
        setSummarizing(false);
        setSummTaskId(null);
        fetchSummaries();
        fetchKnowledge();
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [summTaskId, fetchSummaries, fetchKnowledge]);

  const handleSummarize = useCallback(async () => {
    setSummarizing(true);
    try {
      const res = await fetch(`/api/papers/${id}/summarize`, { method: "POST" });
      const data = await res.json();
      if (data.taskId) {
        setSummTaskId(data.taskId);
      } else {
        setSummarizing(false);
        fetchSummaries();
      }
    } catch {
      setSummarizing(false);
    }
  }, [id, fetchSummaries]);

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/papers/${id}/pdf`, { method: "POST", body: formData });
    fetchPaper();
  }, [id, fetchPaper]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Paper not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{paper.title}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {paper.year && <Badge variant="secondary">{paper.year}</Badge>}
            <Badge variant="outline">{paper.source}</Badge>
            {paper.doi && (
              <span className="text-xs text-muted-foreground font-mono">{paper.doi}</span>
            )}
            {paper.url && (
              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Open
              </a>
            )}
            <a href={`/api/export?paper_id=${paper.id}`} download="reference.bib" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <FileDown className="h-3 w-3" /> BibTeX
            </a>
          </div>
          {paper.authors.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">{paper.authors.join(", ")}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary"><BookOpen className="h-4 w-4 mr-1" /> Summary</TabsTrigger>
          <TabsTrigger value="fulltext"><FileText className="h-4 w-4 mr-1" /> Full Text</TabsTrigger>
          <TabsTrigger value="knowledge"><Lightbulb className="h-4 w-4 mr-1" /> Knowledge</TabsTrigger>
          <TabsTrigger value="annotations"><MessageSquare className="h-4 w-4 mr-1" /> Annotations</TabsTrigger>
          <TabsTrigger value="citations"><Share2 className="h-4 w-4 mr-1" /> Citations</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <SummaryTab
            paper={paper}
            summaries={summaries}
            summarizing={summarizing}
            onSummarize={handleSummarize}
          />
        </TabsContent>

        <TabsContent value="fulltext">
          <FullTextTab paper={paper} onUpload={handlePdfUpload} />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeTab
            paperId={paper.id}
            knowledge={knowledge}
            onUpdate={fetchKnowledge}
          />
        </TabsContent>

        <TabsContent value="annotations">
          <AnnotationsTab paperId={paper.id} />
        </TabsContent>

        <TabsContent value="citations">
          <CitationsTab paperId={paper.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTab({
  paper,
  summaries,
  summarizing,
  onSummarize,
}: {
  paper: PaperData;
  summaries: Summary[];
  summarizing: boolean;
  onSummarize: () => void;
}) {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">AI-generated summary</p>
        <Button onClick={onSummarize} disabled={summarizing}>
          {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          {summarizing ? "Summarizing..." : "Generate Summary"}
        </Button>
      </div>

      {paper.abstract && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Abstract</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-300">{paper.abstract}</p>
          </CardContent>
        </Card>
      )}

      {summaries.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Summary ({s.model}, {new Date(s.createdAt + "Z").toLocaleDateString()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
              {s.summary}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FullTextTab({
  paper,
  onUpload,
}: {
  paper: PaperData;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {paper.hasPdfText ? "Extracted text from PDF" : "No PDF uploaded yet"}
        </p>
        <label>
          <input type="file" accept=".pdf" className="hidden" onChange={onUpload} />
          <Button variant="outline" asChild>
            <span><Upload className="h-4 w-4" /> Upload PDF</span>
          </Button>
        </label>
      </div>

      {paper.pdfText ? (
        <Card>
          <CardContent className="pt-6">
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed max-h-[600px] overflow-y-auto">
              {paper.pdfText}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4" />
          <p>Upload a PDF to extract and view the full text.</p>
        </div>
      )}
    </div>
  );
}

function KnowledgeTab({
  paperId,
  knowledge,
  onUpdate,
}: {
  paperId: number;
  knowledge: Knowledge[];
  onUpdate: () => void;
}) {
  const [category, setCategory] = useState<KnowledgeCategory>("finding");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!content.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, category, content: content.trim() }),
      });
      setContent("");
      onUpdate();
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (knowledgeId: number) => {
    await fetch(`/api/knowledge?id=${knowledgeId}`, { method: "DELETE" });
    onUpdate();
  };

  const categories: KnowledgeCategory[] = ["finding", "method", "gap", "contribution", "limitation", "future_work"];

  const categoryColors: Record<string, string> = {
    finding: "bg-blue-500/20 text-blue-400",
    method: "bg-purple-500/20 text-purple-400",
    gap: "bg-red-500/20 text-red-400",
    contribution: "bg-emerald-500/20 text-emerald-400",
    limitation: "bg-yellow-500/20 text-yellow-400",
    future_work: "bg-orange-500/20 text-orange-400",
  };

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Add Knowledge</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={category} onValueChange={(v) => setCategory(v as KnowledgeCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter insight, finding, method, or gap..."
            rows={3}
          />
          <Button onClick={handleAdd} disabled={adding || !content.trim()} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
            Add
          </Button>
        </CardContent>
      </Card>

      {knowledge.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">No knowledge entries yet.</p>
      ) : (
        <div className="space-y-2">
          {knowledge.map((k) => (
            <Card key={k.id}>
              <CardContent className="pt-4 flex items-start justify-between gap-3">
                <div>
                  <Badge variant="secondary" className={categoryColors[k.category] || ""}>
                    {k.category.replace("_", " ")}
                  </Badge>
                  <p className="text-sm mt-2">{k.content}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface CitationPaper {
  id: number;
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
}

function CitationsTab({ paperId }: { paperId: number }) {
  const [references, setReferences] = useState<CitationPaper[]>([]);
  const [citedBy, setCitedBy] = useState<CitationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<{
    referencesFound: number;
    citationsFound: number;
    referencesAdded: number;
    citationsAdded: number;
  } | null>(null);

  const loadCitations = useCallback(async () => {
    try {
      const res = await fetch(`/api/papers/${paperId}/citations`);
      if (res.ok) {
        const data = await res.json();
        setReferences(data.references || []);
        setCitedBy(data.citedBy || []);
      }
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    loadCitations();
  }, [loadCitations]);

  const handleFetch = async () => {
    setFetching(true);
    setFetchResult(null);
    try {
      const res = await fetch(`/api/papers/${paperId}/citations`, { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        setFetchResult(result);
        loadCitations();
      }
    } finally {
      setFetching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasCitations = references.length > 0 || citedBy.length > 0;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {hasCitations
            ? `${references.length} references, ${citedBy.length} citing papers`
            : "No citation data yet"}
        </p>
        <div className="flex gap-2">
          <Button onClick={handleFetch} disabled={fetching} variant="outline">
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {fetching ? "Fetching..." : "Fetch Citations"}
          </Button>
          {hasCitations && (
            <Button asChild variant="outline">
              <Link href={`/graph?paper=${paperId}`}>
                <Share2 className="h-4 w-4" /> View Graph
              </Link>
            </Button>
          )}
        </div>
      </div>

      {fetchResult && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-emerald-400">
              Found {fetchResult.referencesFound} references and {fetchResult.citationsFound} citing papers
              from Semantic Scholar. Added {fetchResult.referencesAdded} new references
              and {fetchResult.citationsAdded} new citations.
            </p>
          </CardContent>
        </Card>
      )}

      {!hasCitations && !fetching && (
        <div className="text-center py-12 text-muted-foreground">
          <Share2 className="h-12 w-12 mx-auto mb-4" />
          <p>Click &ldquo;Fetch Citations&rdquo; to pull citation data from Semantic Scholar.</p>
          <p className="text-xs mt-1">This will find papers that cite this one and papers it references.</p>
        </div>
      )}

      {references.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
            References ({references.length})
          </h3>
          <div className="space-y-2">
            {references.map((p) => (
              <CitationCard key={p.id} paper={p} />
            ))}
          </div>
        </div>
      )}

      {citedBy.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
            Cited By ({citedBy.length})
          </h3>
          <div className="space-y-2">
            {citedBy.map((p) => (
              <CitationCard key={p.id} paper={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Annotation {
  id: number;
  page: number;
  highlight_text: string;
  note: string;
  color: string;
  created_at: string;
}

const ANNOTATION_COLORS = [
  { name: "Yellow", value: "yellow", class: "bg-yellow-500/20 border-yellow-500/40" },
  { name: "Green", value: "green", class: "bg-emerald-500/20 border-emerald-500/40" },
  { name: "Blue", value: "blue", class: "bg-blue-500/20 border-blue-500/40" },
  { name: "Red", value: "red", class: "bg-red-500/20 border-red-500/40" },
  { name: "Purple", value: "purple", class: "bg-purple-500/20 border-purple-500/40" },
];

function AnnotationsTab({ paperId }: { paperId: number }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newHighlight, setNewHighlight] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newColor, setNewColor] = useState("yellow");
  const [newPage, setNewPage] = useState("1");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState("");

  const fetchAnnotations = useCallback(async () => {
    try {
      const res = await fetch(`/api/annotations?paper_id=${paperId}`);
      if (res.ok) setAnnotations(await res.json());
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  const handleAdd = async () => {
    if (!newHighlight.trim() && !newNote.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId,
          page: Number(newPage) || 1,
          highlightText: newHighlight.trim(),
          note: newNote.trim(),
          color: newColor,
        }),
      });
      setNewHighlight("");
      setNewNote("");
      setNewPage("1");
      setShowAdd(false);
      fetchAnnotations();
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateNote = async (id: number) => {
    await fetch("/api/annotations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, note: editNote }),
    });
    setEditingId(null);
    fetchAnnotations();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/annotations?id=${id}`, { method: "DELETE" });
    fetchAnnotations();
  };

  const colorClass = (color: string) =>
    ANNOTATION_COLORS.find((c) => c.value === color)?.class || ANNOTATION_COLORS[0].class;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" /> Add Annotation
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-3">
              <Input
                placeholder="Page #"
                value={newPage}
                onChange={(e) => setNewPage(e.target.value)}
                className="w-20"
                type="number"
                min={1}
              />
              <div className="flex gap-1">
                {ANNOTATION_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    className={`w-6 h-6 rounded border-2 transition-all ${c.class} ${
                      newColor === c.value ? "ring-2 ring-white/50 scale-110" : ""
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
            <Textarea
              placeholder="Highlighted text or passage..."
              value={newHighlight}
              onChange={(e) => setNewHighlight(e.target.value)}
              rows={2}
            />
            <Textarea
              placeholder="Your note or comment..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={adding || (!newHighlight.trim() && !newNote.trim())}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {annotations.length === 0 && !showAdd ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4" />
          <p>No annotations yet.</p>
          <p className="text-xs mt-1">Add highlights and notes as you read the paper.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {annotations.map((ann) => (
            <Card key={ann.id} className={`border ${colorClass(ann.color)}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">p. {ann.page}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ann.created_at + "Z").toLocaleDateString()}
                      </span>
                    </div>
                    {ann.highlight_text && (
                      <p className="text-sm italic text-zinc-300 mb-2 border-l-2 border-zinc-600 pl-3">
                        &ldquo;{ann.highlight_text}&rdquo;
                      </p>
                    )}
                    {editingId === ann.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleUpdateNote(ann.id)}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="text-sm cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => { setEditingId(ann.id); setEditNote(ann.note); }}
                      >
                        {ann.note || "Click to add note..."}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(ann.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CitationCard({ paper }: { paper: CitationPaper }) {
  return (
    <Card className="hover:border-zinc-600 transition-colors">
      <CardContent className="pt-4 pb-3">
        <Link href={`/papers/${paper.id}`} className="hover:text-emerald-400 transition-colors">
          <p className="text-sm font-medium line-clamp-1">{paper.title}</p>
        </Link>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {paper.year && <span>{paper.year}</span>}
          <span>{paper.authors?.slice(0, 2).join(", ")}</span>
          {paper.doi && <span className="font-mono">{paper.doi}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
