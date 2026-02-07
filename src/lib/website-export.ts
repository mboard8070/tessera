import { getDb } from "@/lib/db";
import type {
  CollectionRow,
  PaperRow,
  CollectionPaperRow,
  SynthesisRow,
  KnowledgeRow,
  CitationRow,
} from "@/lib/types";
import * as esbuild from "esbuild";
import path from "path";
import archiver from "archiver";
import { marked } from "marked";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportPaper {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  doi: string | null;
  url: string | null;
  summaries: string[];
  knowledge: { category: string; content: string }[];
}

interface ExportSynthesis {
  id: number;
  synthesis: string;
  model: string;
  paperIds: number[];
  createdAt: string;
}

interface GraphNode {
  id: string;
  paperId: number;
  title: string;
  year: number | null;
  authors: string[];
  citationCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: "citation" | "co_citation" | "bibliographic_coupling";
  relationship?: "supports" | "contradicts" | "mentions";
  strength?: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function generateWebsite(collectionId: number): Promise<Buffer> {
  const db = getDb();

  // 1. Fetch collection
  const collection = db
    .prepare(
      `SELECT c.*, COUNT(cp.paper_id) as paper_count
       FROM collections c
       LEFT JOIN collection_papers cp ON cp.collection_id = c.id
       WHERE c.id = ?
       GROUP BY c.id`
    )
    .get(collectionId) as (CollectionRow & { paper_count: number }) | undefined;

  if (!collection) {
    throw new Error("Collection not found");
  }

  // 2. Fetch papers with summaries and knowledge
  const paperRows = db
    .prepare(
      `SELECT p.*, cp.notes, cp.added_at
       FROM papers p
       JOIN collection_papers cp ON cp.paper_id = p.id
       WHERE cp.collection_id = ?
       ORDER BY cp.added_at DESC`
    )
    .all(collectionId) as (PaperRow &
    Pick<CollectionPaperRow, "notes" | "added_at">)[];

  const papers: ExportPaper[] = paperRows.map((row) => {
    const summaryRows = db
      .prepare(
        "SELECT summary FROM summaries WHERE paper_id = ? ORDER BY created_at DESC"
      )
      .all(row.id) as { summary: string }[];

    const knowledgeRows = db
      .prepare(
        "SELECT category, content FROM knowledge WHERE paper_id = ? ORDER BY category, created_at"
      )
      .all(row.id) as KnowledgeRow[];

    return {
      id: row.id,
      title: row.title,
      authors: JSON.parse(row.authors),
      abstract: row.abstract,
      year: row.year,
      doi: row.doi,
      url: row.url,
      summaries: summaryRows.map((s) => s.summary),
      knowledge: knowledgeRows.map((k) => ({
        category: k.category,
        content: k.content,
      })),
    };
  });

  // 3. Fetch syntheses
  const synthesisRows = db
    .prepare(
      "SELECT * FROM syntheses WHERE collection_id = ? ORDER BY created_at DESC"
    )
    .all(collectionId) as SynthesisRow[];

  const syntheses: ExportSynthesis[] = synthesisRows.map((s) => ({
    id: s.id,
    synthesis: s.synthesis,
    model: s.model,
    paperIds: JSON.parse(s.paper_ids),
    createdAt: s.created_at,
  }));

  // 4. Build citation graph data
  const paperIds = papers.map((p) => p.id);
  let graphNodes: GraphNode[] = [];
  let graphEdges: GraphEdge[] = [];

  if (paperIds.length > 0) {
    const placeholders = paperIds.map(() => "?").join(",");

    const citations = db
      .prepare(
        `SELECT * FROM citations
         WHERE citing_paper_id IN (${placeholders})
           AND cited_paper_id IN (${placeholders})`
      )
      .all(...paperIds, ...paperIds) as (CitationRow & {
      relationship_type?: string;
    })[];

    graphEdges = citations.map((c) => ({
      source: String(c.citing_paper_id),
      target: String(c.cited_paper_id),
      type: "citation" as const,
      relationship:
        (c.relationship_type as "supports" | "contradicts" | "mentions") ||
        "mentions",
    }));

    // Co-citation
    if (paperIds.length > 1) {
      const coCitations = db
        .prepare(
          `SELECT c1.cited_paper_id AS paper_a, c2.cited_paper_id AS paper_b, COUNT(*) AS strength
           FROM citations c1
           JOIN citations c2 ON c1.citing_paper_id = c2.citing_paper_id
             AND c1.cited_paper_id < c2.cited_paper_id
           WHERE c1.cited_paper_id IN (${placeholders})
             AND c2.cited_paper_id IN (${placeholders})
           GROUP BY c1.cited_paper_id, c2.cited_paper_id
           HAVING COUNT(*) >= 1`
        )
        .all(...paperIds, ...paperIds) as {
        paper_a: number;
        paper_b: number;
        strength: number;
      }[];

      for (const cc of coCitations) {
        graphEdges.push({
          source: String(cc.paper_a),
          target: String(cc.paper_b),
          type: "co_citation",
          strength: cc.strength,
        });
      }

      // Bibliographic coupling
      const bibCoupling = db
        .prepare(
          `SELECT c1.citing_paper_id AS paper_a, c2.citing_paper_id AS paper_b, COUNT(*) AS strength
           FROM citations c1
           JOIN citations c2 ON c1.cited_paper_id = c2.cited_paper_id
             AND c1.citing_paper_id < c2.citing_paper_id
           WHERE c1.citing_paper_id IN (${placeholders})
             AND c2.citing_paper_id IN (${placeholders})
           GROUP BY c1.citing_paper_id, c2.citing_paper_id
           HAVING COUNT(*) >= 1`
        )
        .all(...paperIds, ...paperIds) as {
        paper_a: number;
        paper_b: number;
        strength: number;
      }[];

      for (const bc of bibCoupling) {
        graphEdges.push({
          source: String(bc.paper_a),
          target: String(bc.paper_b),
          type: "bibliographic_coupling",
          strength: bc.strength,
        });
      }
    }

    graphNodes = papers.map((p) => ({
      id: String(p.id),
      paperId: p.id,
      title: p.title,
      year: p.year,
      authors: p.authors,
      citationCount: graphEdges.filter(
        (e) => e.type === "citation" && e.target === String(p.id)
      ).length,
    }));
  }

  // 5. Build graph bundle with esbuild
  const graphBundle = await buildGraphBundle();

  // 6. Render all pages
  const css = renderStylesheet();
  const graphJson = JSON.stringify({ nodes: graphNodes, edges: graphEdges });
  const indexHtml = renderIndex(collection, papers, syntheses);
  const knowledgeHtml = renderKnowledge(papers);
  const graphHtml = renderGraph(collection.name);
  const paperHtmlPages = papers.map((p) => ({
    id: p.id,
    html: renderPaper(p),
  }));

  // 7. Create zip
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    archive.append(indexHtml, { name: "research-site/index.html" });
    archive.append(knowledgeHtml, { name: "research-site/knowledge.html" });
    archive.append(graphHtml, { name: "research-site/graph.html" });
    archive.append(css, { name: "research-site/assets/style.css" });
    archive.append(graphBundle, {
      name: "research-site/assets/graph-bundle.js",
    });
    archive.append(graphJson, { name: "research-site/data/graph.json" });

    for (const page of paperHtmlPages) {
      archive.append(page.html, {
        name: `research-site/papers/${page.id}.html`,
      });
    }

    archive.finalize();
  });
}

// ---------------------------------------------------------------------------
// esbuild: bundle the graph entry point into an IIFE
// ---------------------------------------------------------------------------

async function buildGraphBundle(): Promise<string> {
  const entryPoint = path.join(
    process.cwd(),
    "src",
    "lib",
    "website-graph-entry.tsx"
  );

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    write: false,
    jsx: "automatic",
    jsxImportSource: "react",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    external: [],
    loader: {
      ".tsx": "tsx",
      ".ts": "ts",
      ".css": "css",
    },
  });

  // Filter for JS output only (ignore CSS output files)
  const jsFile = result.outputFiles?.find((f) => f.path.endsWith(".js"));
  if (!jsFile) {
    throw new Error("esbuild produced no JS output");
  }

  return jsFile.text;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    finding: "Finding",
    method: "Method",
    gap: "Gap",
    contribution: "Contribution",
    limitation: "Limitation",
    future_work: "Future Work",
  };
  return labels[cat] || cat;
}

function categoryColor(cat: string): string {
  const colors: Record<string, string> = {
    finding: "#4ade80",
    method: "#60a5fa",
    gap: "#f87171",
    contribution: "#a78bfa",
    limitation: "#fb923c",
    future_work: "#22d3ee",
  };
  return colors[cat] || "#a1a1aa";
}

function htmlShell(
  title: string,
  content: string,
  options: { cssPath?: string; extraHead?: string } = {}
): string {
  const cssHref = options.cssPath || "assets/style.css";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${cssHref}">
  ${options.extraHead || ""}
</head>
<body>
  ${content}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------

function renderIndex(
  collection: CollectionRow & { paper_count: number },
  papers: ExportPaper[],
  syntheses: ExportSynthesis[]
): string {
  const synthesisHtml =
    syntheses.length > 0
      ? syntheses
          .map(
            (s) => `
      <div class="card synthesis-card">
        <div class="card-meta">Generated on ${new Date(s.createdAt + "Z").toLocaleDateString()} using ${escapeHtml(s.model)} (${s.paperIds.length} papers)</div>
        <div class="prose">${renderMarkdown(s.synthesis)}</div>
      </div>`
          )
          .join("\n")
      : '<p class="empty-state">No synthesis has been generated for this collection.</p>';

  const paperListHtml = papers
    .map(
      (p) => `
    <a href="papers/${p.id}.html" class="paper-card">
      <h3>${escapeHtml(p.title)}</h3>
      <div class="paper-meta">
        ${p.year ? `<span>${p.year}</span>` : ""}
        <span>${escapeHtml(p.authors.slice(0, 3).join(", "))}${p.authors.length > 3 ? " et al." : ""}</span>
      </div>
      ${p.knowledge.length > 0 ? `<div class="knowledge-badges">${p.knowledge.slice(0, 4).map((k) => `<span class="badge" style="border-color:${categoryColor(k.category)};color:${categoryColor(k.category)}">${categoryLabel(k.category)}</span>`).join("")}</div>` : ""}
    </a>`
    )
    .join("\n");

  const nav = `
  <nav class="site-nav">
    <a href="index.html" class="nav-link active">Overview</a>
    <a href="knowledge.html" class="nav-link">Knowledge</a>
    <a href="graph.html" class="nav-link">Citation Graph</a>
  </nav>`;

  const content = `
  <div class="container">
    ${nav}
    <header class="site-header">
      <h1>${escapeHtml(collection.name)}</h1>
      ${collection.description ? `<p class="site-description">${escapeHtml(collection.description)}</p>` : ""}
      <div class="stats">
        <span class="stat">${papers.length} papers</span>
        <span class="stat">${syntheses.length} syntheses</span>
        <span class="stat">${papers.reduce((n, p) => n + p.knowledge.length, 0)} knowledge items</span>
      </div>
    </header>

    ${syntheses.length > 0 ? `<section class="section"><h2>Literature Synthesis</h2>${synthesisHtml}</section>` : ""}

    <section class="section">
      <h2>Papers</h2>
      <div class="paper-grid">
        ${paperListHtml}
      </div>
    </section>
  </div>`;

  return htmlShell(`${collection.name} — Research Site`, content);
}

function renderPaper(paper: ExportPaper): string {
  const summaryHtml =
    paper.summaries.length > 0
      ? paper.summaries
          .map(
            (s) =>
              `<div class="card"><div class="prose">${renderMarkdown(s)}</div></div>`
          )
          .join("\n")
      : '<p class="empty-state">No summary available.</p>';

  const knowledgeHtml =
    paper.knowledge.length > 0
      ? paper.knowledge
          .map(
            (k) => `
      <div class="knowledge-item">
        <span class="badge" style="border-color:${categoryColor(k.category)};color:${categoryColor(k.category)}">${categoryLabel(k.category)}</span>
        <span>${escapeHtml(k.content)}</span>
      </div>`
          )
          .join("\n")
      : "";

  const nav = `
  <nav class="site-nav">
    <a href="../index.html" class="nav-link">Overview</a>
    <a href="../knowledge.html" class="nav-link">Knowledge</a>
    <a href="../graph.html" class="nav-link">Citation Graph</a>
  </nav>`;

  const content = `
  <div class="container">
    ${nav}
    <a href="../index.html" class="back-link">&larr; Back to collection</a>
    <header class="paper-header">
      <h1>${escapeHtml(paper.title)}</h1>
      <div class="paper-meta">
        ${paper.year ? `<span>${paper.year}</span>` : ""}
        <span>${escapeHtml(paper.authors.join(", "))}</span>
        ${paper.doi ? `<a href="https://doi.org/${escapeHtml(paper.doi)}" target="_blank" rel="noopener" class="doi-link">DOI: ${escapeHtml(paper.doi)}</a>` : ""}
        ${paper.url ? `<a href="${escapeHtml(paper.url)}" target="_blank" rel="noopener" class="external-link">View original</a>` : ""}
      </div>
    </header>

    ${paper.abstract ? `<section class="section"><h2>Abstract</h2><div class="card"><p>${escapeHtml(paper.abstract)}</p></div></section>` : ""}

    <section class="section">
      <h2>Summary</h2>
      ${summaryHtml}
    </section>

    ${knowledgeHtml ? `<section class="section"><h2>Extracted Knowledge</h2>${knowledgeHtml}</section>` : ""}
  </div>`;

  return htmlShell(`${paper.title} — Research Site`, content, {
    cssPath: "../assets/style.css",
  });
}

function renderKnowledge(papers: ExportPaper[]): string {
  // Group all knowledge by category across all papers
  const byCategory: Record<
    string,
    { content: string; paperId: number; paperTitle: string }[]
  > = {};

  for (const p of papers) {
    for (const k of p.knowledge) {
      if (!byCategory[k.category]) byCategory[k.category] = [];
      byCategory[k.category].push({
        content: k.content,
        paperId: p.id,
        paperTitle: p.title,
      });
    }
  }

  const categoryOrder = [
    "finding",
    "contribution",
    "method",
    "gap",
    "limitation",
    "future_work",
  ];
  const sortedCategories = Object.keys(byCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  const totalItems = papers.reduce((n, p) => n + p.knowledge.length, 0);

  const categorySections =
    sortedCategories.length > 0
      ? sortedCategories
          .map(
            (cat) => `
    <section class="section">
      <h2 style="color:${categoryColor(cat)}">${categoryLabel(cat)} <span class="count">(${byCategory[cat].length})</span></h2>
      <div class="knowledge-list">
        ${byCategory[cat]
          .map(
            (item) => `
          <div class="knowledge-item-card">
            <p>${escapeHtml(item.content)}</p>
            <a href="papers/${item.paperId}.html" class="knowledge-source">${escapeHtml(item.paperTitle)}</a>
          </div>`
          )
          .join("\n")}
      </div>
    </section>`
          )
          .join("\n")
      : '<p class="empty-state">No knowledge items have been extracted yet.</p>';

  const nav = `
  <nav class="site-nav">
    <a href="index.html" class="nav-link">Overview</a>
    <a href="knowledge.html" class="nav-link active">Knowledge</a>
    <a href="graph.html" class="nav-link">Citation Graph</a>
  </nav>`;

  const content = `
  <div class="container">
    ${nav}
    <header class="site-header">
      <h1>Extracted Knowledge</h1>
      <p class="site-description">${totalItems} items across ${papers.length} papers</p>
    </header>
    ${categorySections}
  </div>`;

  return htmlShell("Knowledge — Research Site", content);
}

function renderGraph(collectionName: string): string {
  // The graph page loads the esbuild IIFE bundle and graph.json
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Citation Graph — ${escapeHtml(collectionName)}</title>
  <link rel="stylesheet" href="assets/style.css">
  <style>
    body { margin: 0; overflow: hidden; background: #09090b; }
    #graph-root { width: 100vw; height: 100vh; }
    .graph-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      display: flex; align-items: center; gap: 16px;
      padding: 12px 24px;
      background: rgba(9, 9, 11, 0.85);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #27272a;
    }
    .graph-nav a {
      color: #a1a1aa; text-decoration: none; font-size: 13px;
      transition: color 0.2s;
    }
    .graph-nav a:hover { color: #f4f4f5; }
    .graph-nav .title { color: #f4f4f5; font-weight: 600; font-size: 14px; }
    /* xyflow overrides for dark theme */
    .react-flow__controls button {
      background: #27272a !important;
      border-color: #3f3f46 !important;
      color: #f4f4f5 !important;
      fill: #f4f4f5 !important;
    }
    .react-flow__controls button:hover {
      background: #3f3f46 !important;
    }
    .react-flow__controls button svg {
      fill: #f4f4f5 !important;
    }
    .react-flow__attribution { display: none; }
  </style>
</head>
<body>
  <div class="graph-nav">
    <a href="index.html">&larr; Overview</a>
    <span class="title">Citation Graph</span>
    <a href="knowledge.html">Knowledge</a>
  </div>
  <div id="graph-root"></div>
  <script src="assets/graph-bundle.js"></script>
</body>
</html>`;
}

function renderStylesheet(): string {
  return `/* Research Site — Dark Theme (zinc/emerald) */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --bg: #09090b;
  --bg-card: #18181b;
  --bg-card-hover: #1e1e22;
  --border: #27272a;
  --border-hover: #3f3f46;
  --text: #f4f4f5;
  --text-muted: #a1a1aa;
  --text-dim: #71717a;
  --accent: #10b981;
  --accent-light: #34d399;
  --accent-dim: #065f46;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

html { font-size: 16px; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}

a { color: var(--accent-light); text-decoration: none; transition: color 0.2s; }
a:hover { color: var(--accent); }

/* Layout */
.container { max-width: 960px; margin: 0 auto; padding: 24px 20px 64px; }

/* Navigation */
.site-nav {
  display: flex; gap: 4px; margin-bottom: 32px;
  padding: 4px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: 10px;
  width: fit-content;
}
.nav-link {
  padding: 8px 16px; border-radius: 7px; font-size: 13px; font-weight: 500;
  color: var(--text-muted); transition: all 0.2s;
}
.nav-link:hover { color: var(--text); background: rgba(255,255,255,0.05); }
.nav-link.active { color: var(--text); background: var(--border); }

/* Header */
.site-header { margin-bottom: 40px; }
.site-header h1 { font-size: 2rem; font-weight: 700; margin-bottom: 8px; }
.site-description { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 12px; }
.stats { display: flex; gap: 16px; flex-wrap: wrap; }
.stat {
  font-size: 0.8rem; color: var(--text-dim);
  padding: 4px 10px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: 6px;
}

/* Sections */
.section { margin-bottom: 40px; }
.section h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; }
.count { font-weight: 400; color: var(--text-dim); font-size: 0.85rem; }

/* Cards */
.card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 10px; padding: 20px; margin-bottom: 16px;
}
.card-meta { font-size: 0.8rem; color: var(--text-dim); margin-bottom: 12px; }

/* Paper cards (link cards in index) */
.paper-grid { display: grid; gap: 12px; }
.paper-card {
  display: block; padding: 16px 20px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 10px; transition: all 0.2s; color: var(--text);
}
.paper-card:hover { border-color: var(--accent); background: var(--bg-card-hover); color: var(--text); }
.paper-card h3 { font-size: 0.95rem; font-weight: 500; line-height: 1.4; margin-bottom: 6px; }
.paper-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; }

/* Knowledge badges */
.knowledge-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.badge {
  font-size: 0.7rem; padding: 2px 8px;
  border: 1px solid; border-radius: 99px;
  font-weight: 500;
}

/* Paper detail */
.back-link { display: inline-block; margin-bottom: 20px; font-size: 0.85rem; color: var(--text-muted); }
.back-link:hover { color: var(--accent-light); }
.paper-header { margin-bottom: 32px; }
.paper-header h1 { font-size: 1.5rem; font-weight: 700; line-height: 1.35; margin-bottom: 12px; }
.doi-link, .external-link {
  font-size: 0.8rem; padding: 3px 10px;
  background: var(--accent-dim); border-radius: 6px; color: var(--accent-light);
}

/* Knowledge items (paper page) */
.knowledge-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 16px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: 8px;
  margin-bottom: 8px; font-size: 0.9rem; line-height: 1.5;
}
.knowledge-item .badge { flex-shrink: 0; margin-top: 2px; }

/* Knowledge page cards */
.knowledge-list { display: grid; gap: 10px; }
.knowledge-item-card {
  padding: 14px 18px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: 8px;
}
.knowledge-item-card p { font-size: 0.9rem; line-height: 1.5; margin-bottom: 8px; }
.knowledge-source { font-size: 0.75rem; color: var(--text-dim); }
.knowledge-source:hover { color: var(--accent-light); }

/* Prose (rendered markdown) */
.prose {
  font-size: 0.9rem; line-height: 1.75; color: var(--text);
}
.prose h1,.prose h2,.prose h3,.prose h4 {
  font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em;
}
.prose h1 { font-size: 1.4rem; }
.prose h2 { font-size: 1.2rem; }
.prose h3 { font-size: 1.05rem; }
.prose p { margin-bottom: 1em; }
.prose ul, .prose ol { margin-bottom: 1em; padding-left: 1.5em; }
.prose li { margin-bottom: 0.25em; }
.prose code {
  font-family: "SFMono-Regular", Consolas, monospace;
  background: rgba(255,255,255,0.08); padding: 2px 6px;
  border-radius: 4px; font-size: 0.85em;
}
.prose pre {
  background: rgba(0,0,0,0.4); border: 1px solid var(--border);
  border-radius: 8px; padding: 16px; overflow-x: auto; margin-bottom: 1em;
}
.prose pre code { background: none; padding: 0; }
.prose blockquote {
  border-left: 3px solid var(--accent); padding-left: 16px;
  color: var(--text-muted); margin-bottom: 1em;
}
.prose a { color: var(--accent-light); text-decoration: underline; }
.prose table {
  width: 100%; border-collapse: collapse; margin-bottom: 1em;
}
.prose th, .prose td {
  padding: 8px 12px; border: 1px solid var(--border); text-align: left;
}
.prose th { background: var(--bg-card); font-weight: 600; }

/* Empty state */
.empty-state { color: var(--text-dim); font-size: 0.9rem; font-style: italic; padding: 32px 0; text-align: center; }

/* Responsive */
@media (max-width: 640px) {
  .container { padding: 16px 12px 48px; }
  .site-header h1 { font-size: 1.5rem; }
  .paper-header h1 { font-size: 1.2rem; }
  .paper-meta { flex-direction: column; gap: 4px; }
}
`;
}
