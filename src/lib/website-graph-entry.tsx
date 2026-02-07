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

const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;

const EDGE_COLORS: Record<string, string> = {
  supports: "#4ade80",
  contradicts: "#f87171",
  mentions: "#52525b",
};

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 200, marginx: 40, marginy: 40 });

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
    width: "2px",
    height: "8px",
    minWidth: 0,
    minHeight: 0,
  };

  return (
    <a
      href={`papers/${paperId}.html`}
      style={{
        display: "block",
        background: "rgba(39, 39, 42, 0.9)",
        border: "1px solid rgba(63, 63, 70, 0.8)",
        borderRadius: "8px",
        padding: "10px 12px",
        width: "220px",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.7)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(63, 63, 70, 0.8)")}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
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
          marginTop: "4px",
        }}
      >
        <span style={{ fontSize: "9px", color: "#71717a" }}>
          {authors?.[0] || "Unknown"}
          {year ? ` · ${year}` : ""}
        </span>
        {citationCount > 0 && (
          <span style={{ fontSize: "9px", color: "rgba(16, 185, 129, 0.8)" }}>
            {citationCount} cited
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
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

    // Only show direct citation edges
    const citationEdges = graphData.edges.filter((e) => e.type === "citation");

    const flowEdges: Edge[] = citationEdges.map((e, i) => {
      const color = EDGE_COLORS[e.relationship || "mentions"];

      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        style: {
          stroke: color,
          strokeWidth: 2,
        },
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
        fitViewOptions={{ padding: 0.3 }}
        style={{ background: "#09090b" }}
        minZoom={0.1}
        maxZoom={3}
      >
        <Background color="#1c1c1e" gap={24} size={1} />
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
          border: "1px solid #27272a",
          borderRadius: "8px",
          padding: "10px 12px",
          fontSize: "11px",
        }}
      >
        {[
          { color: EDGE_COLORS.supports, label: "Supports" },
          { color: EDGE_COLORS.contradicts, label: "Contradicts" },
          { color: EDGE_COLORS.mentions, label: "Cites" },
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
                width: "20px",
                height: "2px",
                backgroundColor: item.color,
                borderRadius: "1px",
              }}
            />
            <span style={{ color: "#a1a1aa" }}>{item.label}</span>
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
