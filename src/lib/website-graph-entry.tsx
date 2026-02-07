import React, { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";

// Inline xyflow styles will be injected by esbuild css loader — we skip the import
// and rely on the bundled CSS or inline styles in the HTML shell.

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

const NODE_WIDTH = 250;
const NODE_HEIGHT = 80;

const EDGE_COLORS: Record<string, string> = {
  supports: "#4ade80",
  contradicts: "#f87171",
  mentions: "#6ee7b7",
  co_citation: "#818cf8",
  bibliographic_coupling: "#fbbf24",
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

  return {
    nodes: nodes.map((node) => {
      const pos = g.node(node.id);
      return {
        ...node,
        position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      };
    }),
    edges,
  };
}

function PaperNode({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string;
  const year = data.year as number | null;
  const authors = data.authors as string[];
  const citationCount = data.citationCount as number;
  const paperId = data.paperId as number;

  const handleStyle = {
    background: "transparent",
    border: "none",
    width: "8px",
    height: "2px",
    minWidth: 0,
    minHeight: 0,
  };

  return (
    <a
      href={`papers/${paperId}.html`}
      style={{
        display: "block",
        background: "#27272a",
        border: "1px solid #3f3f46",
        borderRadius: "8px",
        padding: "12px",
        width: "250px",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#10b981")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#3f3f46")}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <p
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "#f4f4f5",
          margin: 0,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          lineHeight: "1.4",
        }}
      >
        {title}
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "6px",
        }}
      >
        <span style={{ fontSize: "10px", color: "#a1a1aa" }}>
          {authors?.[0] || "Unknown"}
          {year ? `, ${year}` : ""}
        </span>
        {citationCount > 0 && (
          <span style={{ fontSize: "10px", color: "#34d399" }}>
            {citationCount} cited
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </a>
  );
}

const nodeTypes = { paper: PaperNode };

function GraphApp() {
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  useEffect(() => {
    fetch("data/graph.json")
      .then((r) => r.json())
      .then(setGraphData)
      .catch(() => setGraphData({ nodes: [], edges: [] }))
      .finally(() => setLoading(false));
  }, []);

  const buildFlowElements = useCallback(() => {
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
        markerEnd: isCitation
          ? { type: MarkerType.ArrowClosed, color }
          : undefined,
        style: {
          stroke: color,
          strokeWidth: isCitation
            ? 2
            : Math.min(1.5 + (e.strength || 1) * 0.5, 4),
          strokeDasharray: isCitation ? undefined : "6 3",
        },
        label: !isCitation
          ? e.type === "co_citation"
            ? "co-cited"
            : "shared refs"
          : e.relationship === "supports"
            ? "supports"
            : e.relationship === "contradicts"
              ? "contradicts"
              : undefined,
        labelStyle: { fill: color, fontSize: 9 },
        labelBgStyle: { fill: "#09090b", fillOpacity: 0.8 },
      };
    });

    if (flowNodes.length > 0 && flowEdges.length > 0) {
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
        flowNodes,
        flowEdges
      );
      setNodes(layouted);
      setEdges(layoutedEdges);
    } else {
      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [graphData, setNodes, setEdges]);

  useEffect(() => {
    buildFlowElements();
  }, [buildFlowElements]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#a1a1aa",
          fontSize: "14px",
        }}
      >
        Loading graph...
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#a1a1aa",
          gap: "8px",
        }}
      >
        <p>No citation data available.</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: "#09090b" }}
        minZoom={0.1}
        maxZoom={3}
      >
        <Background color="#27272a" gap={20} />
        <Controls
          style={{
            background: "#27272a",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
          }}
        />
        <MiniMap
          style={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
          }}
          nodeColor="#10b981"
          maskColor="rgba(0, 0, 0, 0.7)"
        />
      </ReactFlow>
      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "16px",
          background: "rgba(24, 24, 27, 0.9)",
          border: "1px solid #3f3f46",
          borderRadius: "8px",
          padding: "12px",
          fontSize: "12px",
        }}
      >
        {[
          { color: EDGE_COLORS.supports, label: "Supports" },
          { color: EDGE_COLORS.contradicts, label: "Contradicts" },
          { color: EDGE_COLORS.mentions, label: "Cites" },
          { color: EDGE_COLORS.co_citation, label: "Co-cited", dashed: true },
          {
            color: EDGE_COLORS.bibliographic_coupling,
            label: "Shared refs",
            dashed: true,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "2px",
                backgroundColor: item.color,
                borderStyle: item.dashed ? "dashed" : "solid",
              }}
            />
            <span style={{ color: "#d4d4d8" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mount the app
const container = document.getElementById("graph-root");
if (container) {
  createRoot(container).render(<GraphApp />);
}
