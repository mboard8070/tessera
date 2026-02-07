"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText, Library, BookOpen, Lightbulb,
  Search, Plus, Loader2, ArrowRight, Sparkles, ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Paper, Collection, DashboardStats } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [llmStatus, setLlmStatus] = useState<{ online: boolean; model?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/papers").then((r) => r.json()).catch(() => []),
      fetch("/api/collections").then((r) => r.json()).catch(() => []),
      fetch("/api/knowledge").then((r) => r.json()).catch(() => []),
      fetch("/api/llm/status").then((r) => r.json()).catch(() => ({ online: false })),
    ]).then(([papers, collections, knowledge, llm]) => {
      const paperList: Paper[] = Array.isArray(papers) ? papers : [];
      const collectionList: Collection[] = Array.isArray(collections) ? collections : [];
      const knowledgeList = Array.isArray(knowledge) ? knowledge : [];

      setStats({
        totalPapers: paperList.length,
        totalCollections: collectionList.length,
        totalSummaries: 0, // Summaries counted separately if needed
        totalKnowledge: knowledgeList.length,
        recentPapers: paperList.slice(0, 5),
        recentCollections: collectionList.slice(0, 5),
      });
      setLlmStatus(llm);
      setLoading(false);

      // Fetch recommendations if we have papers
      if (Array.isArray(papers) && papers.length > 0) {
        setRecsLoading(true);
        fetch("/api/recommendations?limit=6")
          .then((r) => r.json())
          .then((data) => setRecommendations(data.recommendations || []))
          .catch(() => setRecommendations([]))
          .finally(() => setRecsLoading(false));
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Your literature review workspace</p>
        </div>
        <Button asChild>
          <Link href="/search"><Search className="h-4 w-4" /> Search Papers</Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Papers" value={stats?.totalPapers || 0} href="/search" />
        <StatCard icon={Library} label="Collections" value={stats?.totalCollections || 0} href="/collections" />
        <StatCard icon={Lightbulb} label="Knowledge" value={stats?.totalKnowledge || 0} href="/knowledge" />
        <Card className="bg-zinc-900/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${llmStatus?.online ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              <div>
                <p className="text-2xl font-bold">{llmStatus?.online ? "Online" : "Offline"}</p>
                <p className="text-xs text-muted-foreground">{llmStatus?.model || "Nemotron 30B"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Papers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Papers</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/search">View all <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!stats?.recentPapers?.length ? (
              <EmptyState
                icon={FileText}
                message="No papers yet"
                action="Search & Add Papers"
                href="/search"
              />
            ) : (
              <div className="space-y-3">
                {stats.recentPapers.map((p) => (
                  <Link key={p.id} href={`/papers/${p.id}`} className="block group">
                    <p className="text-sm font-medium group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {p.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.authors?.slice(0, 2).join(", ")} {p.year ? `(${p.year})` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Collections */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Collections</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/collections">View all <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!stats?.recentCollections?.length ? (
              <EmptyState
                icon={Library}
                message="No collections yet"
                action="Create Collection"
                href="/collections"
              />
            ) : (
              <div className="space-y-3">
                {stats.recentCollections.map((c) => (
                  <Link key={c.id} href={`/collections/${c.id}`} className="block group">
                    <p className="text-sm font-medium group-hover:text-emerald-400 transition-colors">
                      {c.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.paperCount} papers
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            <Sparkles className="h-4 w-4 inline mr-2 text-amber-400" />
            Recommended Papers
          </CardTitle>
          <p className="text-xs text-muted-foreground">Based on your library</p>
        </CardHeader>
        <CardContent>
          {recsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              message="Save some papers to get recommendations"
              action="Search Papers"
              href="/search"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="border border-zinc-800 rounded-lg p-3 hover:border-zinc-600 transition-colors">
                  <p className="text-sm font-medium line-clamp-2 leading-snug">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {rec.authors.slice(0, 2).join(", ")} {rec.year ? `(${rec.year})` : ""}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {rec.citationCount !== null && (
                      <Badge variant="secondary" className="text-[10px]">{rec.citationCount} citations</Badge>
                    )}
                    {rec.url && (
                      <a href={rec.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface Recommendation {
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  doi: string | null;
  url: string | null;
  citationCount: number | null;
  source: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="bg-zinc-900/50 hover:border-zinc-600 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({
  icon: Icon,
  message,
  action,
  href,
}: {
  icon: React.ElementType;
  message: string;
  action: string;
  href: string;
}) {
  return (
    <div className="text-center py-6">
      <Icon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link href={href}><Plus className="h-4 w-4" /> {action}</Link>
      </Button>
    </div>
  );
}
