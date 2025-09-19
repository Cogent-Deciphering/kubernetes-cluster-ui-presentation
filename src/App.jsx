import React, { useMemo, useState, useCallback } from "react";
import ReactFlow, { Position, MarkerType, Handle } from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";

// ---------- Icons & colors ----------
const KIND_ICON = {
  Application: "📦",
  Ingress: "🔀",
  Service: "🗂️",
  Deployment: "🔄",
  ReplicaSet: "📚",
  StatefulSet: "💾",
  Pod: "🧫",
  ConfigMap: "🧬",
  Secret: "🔑",
  default: "📄",
};

const HEALTH_COLOR = {
  Healthy: "#10b981",
  Degraded: "#f59e0b",
  Missing: "#94a3b8",
  Progressing: "#0ea5e9",
  Unknown: "#94a3b8",
};

const SYNC_COLOR = {
  Synced: "#059669",
  OutOfSync: "#b45309",
  Unknown: "#64748b",
};

// ---------- Node card ----------
function NodeCard({ data }) {
  const icon = KIND_ICON[data.kind] || KIND_ICON.default;
  const healthColor = HEALTH_COLOR[data.health || "Unknown"];
  const syncColor = SYNC_COLOR[data.sync || "Unknown"];
  return (
    <div
      title={data.name}
      style={{
        width: 260,
        border: "1px solid #e2e8f0",
        background: "#fff",
        borderRadius: 12,
        padding: "6px 10px",
        boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ fontSize: 22 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b" }}>{data.kind}</div>
          <div style={{ fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.name}
          </div>
          <div style={{ marginTop: 2, fontSize: 11, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: healthColor }} />
            <span>{data.health || "Unknown"}</span>
            <span style={{ color: "#94a3b8" }}>•</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: syncColor }} />
            <span>{data.sync || "Unknown"}</span>
          </div>
        </div>
      </div>
      {data.badge && (
        <div style={{ marginTop: 4, fontSize: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 6px" }}>
          {data.badge}
        </div>
      )}
    </div>
  );
}

function RFNodeCard({ data }) {
  return (
    <div style={{ position: "relative" }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <NodeCard data={data} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
const nodeTypes = { kubenode: RFNodeCard };

// ---------- Dagre layout ----------
const NODE_W = 260;
const NODE_H = 90;
const EXT_MARGIN = 100; // padding top/left

function dagreLayout(rawNodes, rawEdges, dir = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, nodesep: 40, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  rawNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rawEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const nodes = rawNodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - NODE_W / 2 + EXT_MARGIN, y: p.y - NODE_H / 2 + EXT_MARGIN },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const edges = rawEdges.map((e) => ({
    ...e,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: e.type === "dashed"
      ? { strokeDasharray: "6 6", stroke: "#94a3b8", strokeWidth: 2 }
      : { stroke: "#94a3b8", strokeWidth: 2 },
  }));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + NODE_W);
    maxY = Math.max(maxY, n.position.y + NODE_H);
  }
  const width = maxX - minX + EXT_MARGIN * 2;
  const height = maxY - minY + EXT_MARGIN * 2;
  return { nodes, edges, size: { width, height } };
}

// ---------- Mock cluster ----------
const MOCK_NODES_RAW = [
  { id: "app", kind: "Application", name: "online-store", health: "Healthy", sync: "Synced" },

  { id: "frontend-deploy", kind: "Deployment", name: "frontend", health: "Healthy", sync: "Synced", image: "nginx:1.25", replicas: "3/3" },
  { id: "frontend-rs", kind: "ReplicaSet", name: "frontend-7f8d9c", health: "Healthy", sync: "Synced", badge: "3 pods" },
  { id: "frontend-pod1", kind: "Pod", name: "frontend-7f8d9c-1", node: "node-a", ready: "1/1" },
  { id: "frontend-pod2", kind: "Pod", name: "frontend-7f8d9c-2", node: "node-b", ready: "1/1" },
  { id: "frontend-pod3", kind: "Pod", name: "frontend-7f8d9c-3", node: "node-c", ready: "1/1" },
  { id: "frontend-svc", kind: "Service", name: "frontend-svc", type: "ClusterIP", clusterIP: "10.96.12.34", ports: ["80/TCP"] },

  { id: "backend-deploy", kind: "Deployment", name: "backend", health: "Healthy", sync: "Synced", image: "python:3.11", replicas: "2/2" },
  { id: "backend-rs", kind: "ReplicaSet", name: "backend-5d4c3b", badge: "2 pods" },
  { id: "backend-pod1", kind: "Pod", name: "backend-5d4c3b-1", node: "node-b", ready: "1/1" },
  { id: "backend-pod2", kind: "Pod", name: "backend-5d4c3b-2", node: "node-c", ready: "1/1" },
  { id: "backend-svc", kind: "Service", name: "backend-svc", type: "ClusterIP", clusterIP: "10.96.55.21", ports: ["8080/TCP"] },

  { id: "db-sts", kind: "StatefulSet", name: "postgres", replicas: "2/2", image: "postgres:15" },
  { id: "db-pod1", kind: "Pod", name: "postgres-0", node: "node-a", ready: "1/1" },
  { id: "db-pod2", kind: "Pod", name: "postgres-1", node: "node-b", ready: "1/1" },
  { id: "db-svc", kind: "Service", name: "postgres", type: "ClusterIP", clusterIP: "10.96.77.88", ports: ["5432/TCP"] },

  { id: "config", kind: "ConfigMap", name: "app-config", keys: ["APP_MODE", "API_URL"] },
  { id: "secret", kind: "Secret", name: "db-credentials", secretType: "Opaque", keys: ["username", "password"] },

  { id: "ingress", kind: "Ingress", name: "online-store.example.com", host: "online-store.example.com", paths: ["/ -> frontend-svc:80"] },
];

const MOCK_EDGES_RAW = [
  { id: "e1", source: "app", target: "frontend-deploy" },
  { id: "e2", source: "app", target: "backend-deploy" },
  { id: "e3", source: "app", target: "db-sts" },
  { id: "e4", source: "app", target: "config" },
  { id: "e5", source: "app", target: "secret" },
  { id: "e6", source: "app", target: "ingress" },

  { id: "e7", source: "frontend-deploy", target: "frontend-rs" },
  { id: "e8", source: "frontend-rs", target: "frontend-pod1" },
  { id: "e9", source: "frontend-rs", target: "frontend-pod2" },
  { id: "e10", source: "frontend-rs", target: "frontend-pod3" },
  { id: "e11", source: "frontend-deploy", target: "frontend-svc" },

  { id: "e12", source: "backend-deploy", target: "backend-rs" },
  { id: "e13", source: "backend-rs", target: "backend-pod1" },
  { id: "e14", source: "backend-rs", target: "backend-pod2" },
  { id: "e15", source: "backend-deploy", target: "backend-svc" },

  { id: "e16", source: "db-sts", target: "db-pod1" },
  { id: "e17", source: "db-sts", target: "db-pod2" },
  { id: "e18", source: "db-sts", target: "db-svc" },

  { id: "e19", source: "ingress", target: "frontend-svc", type: "dashed" }, // Ingress → frontend
  { id: "e20", source: "frontend-deploy", target: "backend-svc", type: "dashed" }, // FE pods call BE svc
  { id: "e21", source: "backend-deploy", target: "db-svc", type: "dashed" }, // BE pods call DB svc
  { id: "e22", source: "config", target: "frontend-deploy", type: "dashed" },
  { id: "e23", source: "config", target: "backend-deploy", type: "dashed" },
  { id: "e24", source: "secret", target: "backend-deploy", type: "dashed" },
  { id: "e25", source: "secret", target: "db-sts", type: "dashed" },
];

// ---------- Drawer extras ----------
function PodListPanel({ parentName, count }) {
  const pods = Array.from({ length: count }).map((_, i) => ({
    name: `${parentName}-${i + 1}`,
    status: "Healthy",
    node: `node-${i % 3}`,
    ready: "1/1",
  }));

  return (
    <div style={{ marginTop: 12 }}>
      <h4>Pods</h4>
      <ul style={{ paddingLeft: 16 }}>
        {pods.map((p) => (
          <li key={p.name}>
            🧫 {p.name} — {p.status}, {p.ready} ready on {p.node}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DrawerContent({ selected }) {
  if (!selected) return null;
  const d = selected;
  switch (d.kind) {
    case "Deployment":
      return (
        <>
          <div><b>Image:</b> {d.image}</div>
          <div><b>Replicas:</b> {d.replicas}</div>
        </>
      );
    case "ReplicaSet":
      return (
        <>
          <div><b>Pods:</b> {d.badge}</div>
          <PodListPanel parentName={d.name} count={parseInt(d.badge) || 3} />
        </>
      );
    case "Pod":
      return (
        <>
          <div><b>Node:</b> {d.node}</div>
          <div><b>Ready:</b> {d.ready}</div>
        </>
      );
    case "StatefulSet":
      return (
        <>
          <div><b>Image:</b> {d.image}</div>
          <div><b>Replicas:</b> {d.replicas}</div>
        </>
      );
    case "Service":
      return (
        <>
          <div><b>Type:</b> {d.type}</div>
          <div><b>ClusterIP:</b> {d.clusterIP}</div>
          <div><b>Ports:</b> {d.ports?.join(", ")}</div>
        </>
      );
    case "Ingress":
      return (
        <>
          <div><b>Host:</b> {d.host}</div>
          <div><b>Paths:</b>
            <ul>{d.paths?.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        </>
      );
    case "ConfigMap":
      return <div><b>Keys:</b> {d.keys?.join(", ")}</div>;
    case "Secret":
      return (
        <>
          <div><b>Type:</b> {d.secretType}</div>
          <div><b>Keys:</b> {d.keys?.join(", ")}</div>
        </>
      );
    default:
      return <div>No extra info</div>;
  }
}

// ---------- App ----------
export default function App() {
  const [selected, setSelected] = useState(null);
  const { nodes, edges, size } = useMemo(() => {
    const rfNodes = MOCK_NODES_RAW.map((d) => ({
      id: d.id,
      type: "kubenode",
      data: d,
      position: { x: 0, y: 0 },
    }));
    return dagreLayout(rfNodes, MOCK_EDGES_RAW, "LR");
  }, []);
  const onNodeClick = useCallback((_, node) => setSelected(node.data), []);
  const onPaneClick = useCallback(() => setSelected(null), []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 12, background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Kubernetes Graph Demo</h1>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: "1 1 auto", overflow: "auto", background: "#f8fafc" }}
             onWheelCapture={(e) => e.stopPropagation()}>
          <div style={{ width: size.width, height: size.height }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              zoomOnScroll={false}
              zoomOnPinch={false}
              panOnDrag={false}
              panOnScroll={false}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView={false}
              defaultEdgeOptions={{
                type: "smoothstep",
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: "#94a3b8", strokeWidth: 2 },
              }}
              proOptions={{ hideAttribution: true }}
            />
          </div>
        </div>

        <aside style={{
          width: selected ? 340 : 0,
          transition: "width .25s ease",
          overflow: "hidden",
          borderLeft: selected ? "1px solid #e2e8f0" : "0",
          background: "#fff",
        }}>
          {selected && (
            <div style={{ padding: "12px 14px", overflow: "auto", height: "100%" }}>
              <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
              <div><b>Kind:</b> {selected.kind}</div>
              {selected.health && <div><b>Health:</b> {selected.health}</div>}
              {selected.sync && <div><b>Sync:</b> {selected.sync}</div>}
              <DrawerContent selected={selected} />
            </div>
          )}
        </aside>
      </div>

      {/* Cursor fix */}
      <style>{`
        .react-flow__pane { cursor: default !important; }
        .react-flow__node, .react-flow__edge { cursor: pointer; }
      `}</style>
    </div>
  );
}
