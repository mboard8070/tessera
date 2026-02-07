"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Lightbulb, Search, Trash2, Loader2, PenLine,
  Plus, Save, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import type { Knowledge, KnowledgeCategory } from "@/lib/types";

const categories: { value: KnowledgeCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "finding", label: "Findings" },
  { value: "method", label: "Methods" },
  { value: "gap", label: "Gaps" },
  { value: "contribution", label: "Contributions" },
  { value: "limitation", label: "Limitations" },
  { value: "future_work", label: "Future Work" },
];

const categoryColors: Record<string, string> = {
  finding: "bg-blue-500/20 text-blue-400",
  method: "bg-purple-500/20 text-purple-400",
  gap: "bg-red-500/20 text-red-400",
  contribution: "bg-emerald-500/20 text-emerald-400",
  limitation: "bg-yellow-500/20 text-yellow-400",
  future_work: "bg-orange-500/20 text-orange-400",
};

interface Conclusion {
  id: number;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgePage() {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [conclusions, setConclusions] = useState<Conclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showConclusions, setShowConclusions] = useState(true);

  const fetchKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("category", activeTab);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/knowledge?${params}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  const fetchConclusions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("category", activeTab);
      const res = await fetch(`/api/conclusions?${params}`);
      const data = await res.json();
      setConclusions(Array.isArray(data) ? data : []);
    } catch {
      setConclusions([]);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchKnowledge();
    fetchConclusions();
  }, [fetchKnowledge, fetchConclusions]);

  const handleDeleteKnowledge = async (id: number) => {
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    fetchKnowledge();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Knowledge Base</h2>
        <p className="text-muted-foreground mt-1">
          AI-extracted insights and your own conclusions
        </p>
      </div>

      {/* Conclusions Section */}
      <div>
        <button
          onClick={() => setShowConclusions(!showConclusions)}
          className="flex items-center gap-2 text-lg font-semibold hover:text-emerald-400 transition-colors"
        >
          <PenLine className="h-5 w-5" />
          My Conclusions
          {showConclusions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Badge variant="secondary" className="ml-1">{conclusions.length}</Badge>
        </button>

        {showConclusions && (
          <div className="mt-4 space-y-4">
            <ConclusionEditor
              activeCategory={activeTab}
              onSave={fetchConclusions}
            />
            {conclusions.map((c) => (
              <ConclusionCard
                key={c.id}
                conclusion={c}
                onDelete={async () => {
                  await fetch(`/api/conclusions?id=${c.id}`, { method: "DELETE" });
                  fetchConclusions();
                }}
                onUpdate={fetchConclusions}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Extracted Knowledge Section */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Extracted Knowledge
          <Badge variant="secondary" className="ml-1">{items.length}</Badge>
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Auto-extracted when papers are summarized, or added manually
        </p>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search knowledge entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" onClick={fetchKnowledge}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {categories.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((c) => (
          <TabsContent key={c.value} value={c.value}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No knowledge entries</h3>
                <p className="text-muted-foreground mt-1">
                  Generate a paper summary to auto-extract knowledge, or add entries manually
                </p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="pt-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className={categoryColors[item.category] || ""}>
                            {item.category.replace("_", " ")}
                          </Badge>
                          <Link
                            href={`/papers/${item.paperId}`}
                            className="text-xs text-emerald-400 hover:underline truncate"
                          >
                            {item.paperTitle}
                          </Link>
                        </div>
                        <p className="text-sm">{item.content}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteKnowledge(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ConclusionEditor({
  activeCategory,
  onSave,
}: {
  activeCategory: string;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/conclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category: activeCategory !== "all" ? activeCategory : "general",
        }),
      });
      setTitle("");
      setContent("");
      setOpen(false);
      onSave();
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full border-dashed">
        <Plus className="h-4 w-4" />
        Write a new conclusion
      </Button>
    );
  }

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">New Conclusion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Conclusion title (e.g. 'CRISPR shows promise for AMR but delivery remains unsolved')"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          placeholder="Write your conclusion, interpretation, or synthesis of what you've learned from the papers..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
        />
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setTitle(""); setContent(""); }}>
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConclusionCard({
  conclusion,
  onDelete,
  onUpdate,
}: {
  conclusion: Conclusion;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conclusion.title);
  const [content, setContent] = useState(conclusion.content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/conclusions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conclusion.id, title, content }),
      });
      setEditing(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-emerald-500/10 bg-emerald-500/[0.02]">
      <CardContent className="pt-4">
        {editing ? (
          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setTitle(conclusion.title); setContent(conclusion.content); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <PenLine className="h-3.5 w-3.5 text-emerald-400" />
                <h4 className="font-medium text-sm">{conclusion.title}</h4>
                {conclusion.category !== "general" && (
                  <Badge variant="secondary" className={categoryColors[conclusion.category] || "bg-zinc-500/20 text-zinc-400"}>
                    {conclusion.category.replace("_", " ")}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">{conclusion.content}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                {new Date(conclusion.updatedAt + "Z").toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                <PenLine className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
