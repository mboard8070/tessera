"use client";

import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Loader2 } from "lucide-react";

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

interface Props {
  collectionId?: number;
  paperId?: number;
  onNodeClick?: (paperId: number) => void;
}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 80;

const EDGE_COLORS: Record<string, string> = {
  supports: "#4ade80",      // green
  contradicts: "#f87171",   // red
  mentions: "#6ee7b7",      // emerald
  co_citation: "#818cf8",   // indigo
  bibliographic_coupling: "#fbbf24", // amber
};

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function PaperNode({ data }: { data: { title: string; year: number | null; authors: string[]; citationCount: number } }) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 w-[250px] shadow-lg hover:border-emerald-500 transition-colors cursor-pointer">
      <p className="text-xs font-medium text-zinc-100 line-clamp-2 leading-snug">{data.title}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-zinc-400">
          {data.authors?.[0] || "Unknown"}{data.year ? `, ${data.year}` : ""}
        </span>
        {data.citationCount > 0 && (
          <span className="text-[10px] text-emerald-400">{data.citationCount} cited</span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { paper: PaperNode };

export function CitationGraph({ collectionId, paperId, onNodeClick }: Props) {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  useEffect(() => {
    setLoading(true);
    setGraphData(null);

    const params = new URLSearchParams();
    if (collectionId) params.set("collection_id", String(collectionId));
    if (paperId) params.set("paper_id", String(paperId));

    fetch(`/api/citations?${params}`)
      .then((r) => r.json())
      .then(setGraphData)
      .catch(() => setGraphData({ nodes: [], edges: [] }))
      .finally(() => setLoading(false));
  }, [collectionId, paperId]);

  useEffect(() => {
    if (!graphData) return;

    const flowNodes: Node[] = graphData.nodes.map((n) => ({
      id: n.id,
      type: "paper",
      position: { x: 0, y: 0 },
      data: {
        title: n.title,
        year: n.year,
        authors: n.authors,
        citationCount: n.citationCount,
        paperId: n.paperId,
      },
    }));

    const flowEdges: Edge[] = graphData.edges.map((e, i) => {
      const isCitation = e.type === "citation";
      const color = isCitation
        ? EDGE_COLORS[e.relationship || "mentions"]
        : EDGE_COLORS[e.type];

      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        markerEnd: isCitation ? { type: MarkerType.ArrowClosed, color } : undefined,
        style: {
          stroke: color,
          strokeWidth: isCitation ? 1.5 : Math.min(1 + (e.strength || 1) * 0.5, 4),
          strokeDasharray: isCitation ? undefined : "6 3",
        },
        animated: isCitation,
        label: !isCitation
          ? (e.type === "co_citation" ? "co-cited" : "shared refs")
          : (e.relationship === "supports" ? "supports" : e.relationship === "contradicts" ? "contradicts" : undefined),
        labelStyle: { fill: color, fontSize: 9 },
        labelBgStyle: { fill: "#09090b", fillOpacity: 0.8 },
      };
    });

    if (flowNodes.length > 0 && flowEdges.length > 0) {
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
      setNodes(layouted);
      setEdges(layoutedEdges);
    } else {
      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [graphData, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    const pid = node.data?.paperId as number | undefined;
    if (pid && onNodeClick) onNodeClick(pid);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p>No citation data available.</p>
        <p className="text-xs">Use &ldquo;Fetch All Citations&rdquo; above to pull citation relationships from Semantic Scholar.</p>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-zinc-950"
        minZoom={0.1}
        maxZoom={3}
      >
        <Background color="#27272a" gap={20} />
        <Controls className="!bg-zinc-800 !border-zinc-700 !text-zinc-100 [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-100 [&>button:hover]:!bg-zinc-700" />
        <MiniMap
          className="!bg-zinc-900 !border-zinc-700"
          nodeColor="#10b981"
          maskColor="rgba(0, 0, 0, 0.7)"
        />
      </ReactFlow>
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 text-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ backgroundColor: EDGE_COLORS.supports }} />
          <span className="text-zinc-300">Supports</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ backgroundColor: EDGE_COLORS.contradicts }} />
          <span className="text-zinc-300">Contradicts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ backgroundColor: EDGE_COLORS.mentions }} />
          <span className="text-zinc-300">Cites</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t border-dashed" style={{ borderColor: EDGE_COLORS.co_citation }} />
          <span className="text-zinc-300">Co-cited</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t border-dashed" style={{ borderColor: EDGE_COLORS.bibliographic_coupling }} />
          <span className="text-zinc-300">Shared refs</span>
        </div>
      </div>
    </div>
  );
}
