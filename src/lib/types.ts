// ============================================================
// Database row types (match SQLite schema exactly)
// ============================================================

export interface CollectionRow {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface PaperRow {
  id: number;
  title: string;
  authors: string; // JSON array
  abstract: string;
  year: number | null;
  doi: string | null;
  arxiv_id: string | null;
  semantic_scholar_id: string | null;
  openalex_id: string | null;
  source: string; // which API found it
  url: string | null;
  pdf_path: string | null;
  pdf_text: string | null;
  metadata: string | null; // JSON object
  created_at: string;
  updated_at: string;
}

export interface CollectionPaperRow {
  collection_id: number;
  paper_id: number;
  notes: string;
  added_at: string;
}

export interface CitationRow {
  id: number;
  citing_paper_id: number;
  cited_paper_id: number;
  source: string;
  relationship_type: string | null; // supports, contradicts, mentions
  context_text: string | null;
  created_at: string;
}

export interface SummaryRow {
  id: number;
  paper_id: number;
  summary: string;
  model: string;
  created_at: string;
}

export interface SynthesisRow {
  id: number;
  collection_id: number;
  synthesis: string;
  model: string;
  paper_ids: string; // JSON array of paper IDs included
  created_at: string;
}

export interface KnowledgeRow {
  id: number;
  paper_id: number;
  category: string; // finding, method, gap, contribution, limitation, future_work
  content: string;
  created_at: string;
}

export interface TaskRow {
  id: string;
  type: string; // summarize, synthesize
  status: string; // pending, running, completed, failed
  target_id: number;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// API / Frontend types
// ============================================================

export type KnowledgeCategory = "finding" | "method" | "gap" | "contribution" | "limitation" | "future_work";

export interface Paper {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  doi: string | null;
  arxivId: string | null;
  semanticScholarId: string | null;
  openalexId: string | null;
  source: string;
  url: string | null;
  pdfPath: string | null;
  hasPdfText: boolean;
  createdAt: string;
}

export interface Collection {
  id: number;
  name: string;
  description: string;
  paperCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionDetail extends Collection {
  papers: (Paper & { notes: string; addedAt: string })[];
}

export interface Summary {
  id: number;
  paperId: number;
  summary: string;
  model: string;
  createdAt: string;
}

export interface Synthesis {
  id: number;
  collectionId: number;
  synthesis: string;
  model: string;
  paperIds: number[];
  createdAt: string;
}

export interface Knowledge {
  id: number;
  paperId: number;
  paperTitle?: string;
  category: KnowledgeCategory;
  content: string;
  createdAt: string;
}

export interface TaskStatus {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  targetId: number;
  result: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// Search result from any source, normalized
export interface SearchResult {
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  doi: string | null;
  arxivId: string | null;
  semanticScholarId: string | null;
  openalexId: string | null;
  source: string;
  url: string | null;
  citationCount: number | null;
}

// Citation graph types for @xyflow/react
export interface GraphNode {
  id: string;
  paperId: number;
  title: string;
  year: number | null;
  authors: string[];
  citationCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type?: "citation" | "co_citation" | "bibliographic_coupling";
  relationship?: "supports" | "contradicts" | "mentions";
  strength?: number;
}

export interface CitationGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Dashboard stats
export interface DashboardStats {
  totalPapers: number;
  totalCollections: number;
  totalSummaries: number;
  totalKnowledge: number;
  recentPapers: Paper[];
  recentCollections: Collection[];
}
