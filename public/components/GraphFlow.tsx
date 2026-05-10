'use client';

import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Background as _Background,
  Controls as _Controls,
  MiniMap as _MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
// npm install dagre @types/dagre
import dagre from 'dagre';

const Background = _Background as any;
const Controls = _Controls as any;
const MiniMap = _MiniMap as any;

// ─────────────────────────────────────────────
// Types & Theme
// ─────────────────────────────────────────────

type NodeKind = 'abstract' | 'concrete' | 'interface' | 'mixin';
type EdgeKind = 'extends' | 'implements' | 'mixin';
type LayoutDir = 'TB' | 'LR' | 'radial';

interface ClassData {
  label: string;
  kind: NodeKind;
  methods: string[];
  properties?: string[];
}

const KIND_THEME: Record<NodeKind, {
  border: string; badge: string; badgeText: string; glow: string; icon: string;
}> = {
  abstract:  { border: '#00e5ff', badge: '#00e5ff22', badgeText: '#00e5ff', glow: '0 0 24px rgba(0,229,255,0.35)', icon: '⬡' },
  concrete:  { border: '#3b82f6', badge: '#3b82f622', badgeText: '#93c5fd', glow: '0 0 16px rgba(59,130,246,0.25)', icon: '⬢' },
  interface: { border: '#a855f7', badge: '#a855f722', badgeText: '#d8b4fe', glow: '0 0 16px rgba(168,85,247,0.25)', icon: '⟨⟩' },
  mixin:     { border: '#f59e0b', badge: '#f59e0b22', badgeText: '#fcd34d', glow: '0 0 16px rgba(245,158,11,0.25)', icon: '⊕' },
};

// ─────────────────────────────────────────────
// ClassNode
// ─────────────────────────────────────────────

interface ClassNodeData extends ClassData {
  dimmed?: boolean;
  highlighted?: boolean;
}

function ClassNode({ data, selected }: NodeProps<ClassNodeData>) {
  const theme = KIND_THEME[data.kind];
  const opacity = data.dimmed ? 0.18 : 1;
  const scale = data.highlighted ? 1.04 : 1;

  return (
    <div
      style={{
        background: selected ? '#0f1420' : '#0b0d14',
        border: `1.5px solid ${selected || data.highlighted ? theme.border : theme.border + '55'}`,
        borderRadius: 14,
        minWidth: 190,
        boxShadow: selected || data.highlighted ? theme.glow : 'none',
        transition: 'all 0.18s ease',
        opacity,
        transform: `scale(${scale})`,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}
    >
      <Handle type="target" position={Position.Top}
        style={{ background: theme.border, border: 'none', width: 8, height: 8 }} />

      <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${theme.border}22` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            background: theme.badge, color: theme.badgeText,
            padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase',
          }}>
            {theme.icon} {data.kind}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e8eaf0', letterSpacing: '-0.01em' }}>
          {data.label}
        </div>
      </div>

      {data.properties && data.properties.length > 0 && (
        <div style={{ padding: '7px 14px 4px', borderBottom: '1px solid #ffffff08' }}>
          {data.properties.map((p) => (
            <div key={p} style={{ fontSize: 10, color: '#6b7280', lineHeight: '1.7' }}>
              <span style={{ color: '#4ade80' }}>+</span> {p}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '7px 14px 10px' }}>
        {data.methods.map((m) => (
          <div key={m} style={{ fontSize: 10, color: '#94a3b8', lineHeight: '1.7' }}>
            <span style={{ color: theme.badgeText, opacity: 0.7 }}>ƒ</span> {m}
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ background: theme.border, border: 'none', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { classNode: ClassNode };

// ─────────────────────────────────────────────
// Raw graph data
// ─────────────────────────────────────────────

const RAW_NODES: Node<ClassData>[] = [
  {
    id: 'animal', type: 'classNode', position: { x: 340, y: 20 },
    data: { label: 'Animal', kind: 'abstract', properties: ['name: string', 'age: number'], methods: ['speak(): void', 'move(): void', 'toString(): string'] },
  },
  {
    id: 'flyable', type: 'classNode', position: { x: 700, y: 20 },
    data: { label: 'IFlyable', kind: 'interface', methods: ['fly(): void', 'land(): void'] },
  },
  {
    id: 'swimmable', type: 'classNode', position: { x: -40, y: 20 },
    data: { label: 'Swimmable', kind: 'mixin', methods: ['swim(): void', 'dive(depth): void'] },
  },
  {
    id: 'mammal', type: 'classNode', position: { x: 160, y: 220 },
    data: { label: 'Mammal', kind: 'abstract', properties: ['furColor: string'], methods: ['breathe(): void', 'nurse(): void'] },
  },
  {
    id: 'bird', type: 'classNode', position: { x: 520, y: 220 },
    data: { label: 'Bird', kind: 'abstract', properties: ['wingspan: number'], methods: ['layEgg(): void', 'speak(): void'] },
  },
  {
    id: 'dog', type: 'classNode', position: { x: 30, y: 430 },
    data: { label: 'Dog', kind: 'concrete', properties: ['breed: string'], methods: ['speak(): void', 'fetch(): void'] },
  },
  {
    id: 'dolphin', type: 'classNode', position: { x: 270, y: 430 },
    data: { label: 'Dolphin', kind: 'concrete', properties: ['podSize: number'], methods: ['speak(): void', 'swim(): void', 'echolocate(): void'] },
  },
  {
    id: 'eagle', type: 'classNode', position: { x: 470, y: 430 },
    data: { label: 'Eagle', kind: 'concrete', properties: ['territory: string'], methods: ['fly(): void', 'hunt(): void', 'land(): void'] },
  },
  {
    id: 'penguin', type: 'classNode', position: { x: 680, y: 430 },
    data: { label: 'Penguin', kind: 'concrete', properties: ['colony: string'], methods: ['speak(): void', 'swim(): void', 'waddle(): void'] },
  },
];

const edgeBase = {
  style: { stroke: '#00e5ff44', strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#00e5ff88', width: 14, height: 14 },
};
const implementsEdge = {
  style: { stroke: '#a855f766', strokeWidth: 1.5, strokeDasharray: '5 4' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7aa', width: 14, height: 14 },
};
const mixinEdge = {
  style: { stroke: '#f59e0b66', strokeWidth: 1.5, strokeDasharray: '3 3' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0baa', width: 14, height: 14 },
};

const RAW_EDGES: Edge[] = [
  { id: 'a-m',    source: 'animal',    target: 'mammal',   label: 'extends',    data: { kind: 'extends' },    ...edgeBase },
  { id: 'a-b',    source: 'animal',    target: 'bird',     label: 'extends',    data: { kind: 'extends' },    ...edgeBase },
  { id: 'm-dog',  source: 'mammal',    target: 'dog',      label: 'extends',    data: { kind: 'extends' },    ...edgeBase },
  { id: 'm-dol',  source: 'mammal',    target: 'dolphin',  label: 'extends',    data: { kind: 'extends' },    ...edgeBase },
  { id: 'b-eag',  source: 'bird',      target: 'eagle',    label: 'extends',    data: { kind: 'extends' },    ...edgeBase },
  { id: 'b-pen',  source: 'bird',      target: 'penguin',  label: 'extends',    data: { kind: 'extends' },    ...edgeBase },
  { id: 'fly-eag', source: 'flyable', target: 'eagle',    label: 'implements', data: { kind: 'implements' }, ...implementsEdge },
  { id: 'fly-bird', source: 'flyable', target: 'bird',    label: 'implements', data: { kind: 'implements' }, ...implementsEdge },
  { id: 'swim-dol', source: 'swimmable', target: 'dolphin', label: 'mixin',   data: { kind: 'mixin' },      ...mixinEdge },
  { id: 'swim-pen', source: 'swimmable', target: 'penguin', label: 'mixin',   data: { kind: 'mixin' },      ...mixinEdge },
];

// ─────────────────────────────────────────────
// ① Hover Focus: collect neighbors
// ─────────────────────────────────────────────

function getNeighborIds(nodeId: string, edges: Edge[]): Set<string> {
  const ids = new Set<string>();
  edges.forEach((e) => {
    if (e.source === nodeId) ids.add(e.target);
    if (e.target === nodeId) ids.add(e.source);
  });
  return ids;
}

// ─────────────────────────────────────────────
// ③ Path tracing: DFS ancestors + descendants
// ─────────────────────────────────────────────

function getConnectedPath(nodeId: string, edges: Edge[]): Set<string> {
  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift()!;
    edges.forEach((e) => {
      if (e.source === cur && !visited.has(e.target)) { visited.add(e.target); queue.push(e.target); }
      if (e.target === cur && !visited.has(e.source)) { visited.add(e.source); queue.push(e.source); }
    });
  }
  return visited;
}

// ─────────────────────────────────────────────
// ④ Dagre layout
// ─────────────────────────────────────────────

const NODE_W = 210;
const NODE_H = 160;

function applyDagreLayout(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR'): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    return { ...n, position: { x: x - NODE_W / 2, y: y - NODE_H / 2 } };
  });
}

function applyRadialLayout(nodes: Node[], edges: Edge[]): Node[] {
  // Simple radial: BFS from highest in-degree node as root
  const inDegree: Record<string, number> = {};
  nodes.forEach((n) => { inDegree[n.id] = 0; });
  edges.forEach((e) => { inDegree[e.target] = (inDegree[e.target] || 0) + 1; });
  const root = nodes.reduce((a, b) => (inDegree[a.id] <= inDegree[b.id] ? a : b)).id;

  const adj: Record<string, string[]> = {};
  nodes.forEach((n) => { adj[n.id] = []; });
  edges.forEach((e) => { adj[e.source].push(e.target); adj[e.target].push(e.source); });

  const levels: Record<string, number> = { [root]: 0 };
  const bfsQueue = [root];
  const order: string[] = [];
  while (bfsQueue.length) {
    const cur = bfsQueue.shift()!;
    order.push(cur);
    (adj[cur] || []).forEach((nb) => {
      if (levels[nb] === undefined) { levels[nb] = levels[cur] + 1; bfsQueue.push(nb); }
    });
  }

  const levelGroups: Record<number, string[]> = {};
  order.forEach((id) => {
    const lv = levels[id] ?? 0;
    if (!levelGroups[lv]) levelGroups[lv] = [];
    levelGroups[lv].push(id);
  });

  const CX = 450, CY = 300;
  const RADIUS_STEP = 200;
  const positioned: Record<string, { x: number; y: number }> = {};

  Object.entries(levelGroups).forEach(([lvStr, ids]) => {
    const lv = Number(lvStr);
    if (lv === 0) { positioned[ids[0]] = { x: CX, y: CY }; return; }
    const r = lv * RADIUS_STEP;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
      positioned[id] = { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
    });
  });

  return nodes.map((n) => ({
    ...n,
    position: positioned[n.id] ?? n.position,
  }));
}

// ─────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────

function Legend({
  activeEdgeKinds,
  onToggleEdge,
}: {
  activeEdgeKinds: Set<EdgeKind>;
  onToggleEdge: (k: EdgeKind) => void;
}) {
  const nodeItems: { kind: NodeKind; label: string }[] = [
    { kind: 'abstract', label: 'Abstract Class' },
    { kind: 'concrete', label: 'Concrete Class' },
    { kind: 'interface', label: 'Interface' },
    { kind: 'mixin', label: 'Mixin' },
  ];
  const edgeItems: { kind: EdgeKind; dash: string; color: string }[] = [
    { kind: 'extends',    dash: 'none', color: '#00e5ff88' },
    { kind: 'implements', dash: '5 4',  color: '#a855f7aa' },
    { kind: 'mixin',      dash: '3 3',  color: '#f59e0baa' },
  ];

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 10,
      background: '#0b0d14ee', border: '1px solid #ffffff10',
      borderRadius: 12, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
      backdropFilter: 'blur(8px)',
      fontFamily: '"JetBrains Mono", monospace',
      userSelect: 'none',
    }}>
      {nodeItems.map(({ kind, label }) => {
        const t = KIND_THEME[kind];
        return (
          <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: t.badge, border: `1.5px solid ${t.border}` }} />
            <span style={{ fontSize: 10, color: t.badgeText }}>{label}</span>
          </div>
        );
      })}

      <div style={{ borderTop: '1px solid #ffffff10', marginTop: 4, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 9, color: '#4b5563', letterSpacing: '0.1em', marginBottom: 2 }}>
          EDGE FILTER — click to toggle
        </div>
        {edgeItems.map(({ kind, dash, color }) => {
          const active = activeEdgeKinds.has(kind);
          return (
            <div
              key={kind}
              onClick={() => onToggleEdge(kind)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', opacity: active ? 1 : 0.35,
                transition: 'opacity 0.15s',
                padding: '2px 4px', borderRadius: 4,
              }}
            >
              <svg width="24" height="10">
                <line x1="0" y1="5" x2="24" y2="5"
                  stroke={color} strokeWidth="1.5"
                  strokeDasharray={dash === 'none' ? undefined : dash} />
              </svg>
              <span style={{ fontSize: 10, color: active ? '#9ca3af' : '#4b5563' }}>{kind}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DetailPanel
// ─────────────────────────────────────────────

function DetailPanel({ node }: { node: Node<ClassData> | null }) {
  if (!node) return null;
  const { label, kind, methods, properties } = node.data;
  const t = KIND_THEME[kind];
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 10,
      background: '#0b0d14ee', border: `1px solid ${t.border}33`,
      borderRadius: 14, padding: '14px 18px', minWidth: 200, maxWidth: 240,
      backdropFilter: 'blur(12px)',
      fontFamily: '"JetBrains Mono", monospace',
      boxShadow: t.glow,
      transition: 'all 0.2s ease',
    }}>
      <div style={{ fontSize: 9, color: t.badgeText, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>
        {t.icon} {kind}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0', marginBottom: 10 }}>{label}</div>
      {properties && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#4b5563', marginBottom: 4, letterSpacing: '0.1em' }}>PROPERTIES</div>
          {properties.map(p => (
            <div key={p} style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.8 }}>
              <span style={{ color: '#4ade80' }}>+</span> {p}
            </div>
          ))}
        </div>
      )}
      <div>
        <div style={{ fontSize: 9, color: '#4b5563', marginBottom: 4, letterSpacing: '0.1em' }}>METHODS</div>
        {methods.map(m => (
          <div key={m} style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.8 }}>
            <span style={{ color: t.badgeText, opacity: 0.7 }}>ƒ</span> {m}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Toolbar (search + layout)
// ─────────────────────────────────────────────

function Toolbar({
  query,
  onQuery,
  layout,
  onLayout,
  matchCount,
}: {
  query: string;
  onQuery: (q: string) => void;
  layout: LayoutDir;
  onLayout: (l: LayoutDir) => void;
  matchCount: number;
}) {
  const layouts: { id: LayoutDir; label: string; icon: string }[] = [
    { id: 'TB',     label: 'Top–Down', icon: '⬇' },
    { id: 'LR',     label: 'Left–Right', icon: '➡' },
    { id: 'radial', label: 'Radial',    icon: '◎' },
  ];

  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', alignItems: 'center', gap: 8,
      background: '#0b0d14ee', border: '1px solid #ffffff10',
      borderRadius: 12, padding: '8px 12px',
      backdropFilter: 'blur(8px)',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {/* Search */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 8, fontSize: 11, color: '#4b5563' }}>⌕</span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search node…"
          style={{
            background: '#0f1420', border: '1px solid #ffffff15',
            borderRadius: 8, padding: '5px 10px 5px 24px',
            color: '#e8eaf0', fontSize: 11, outline: 'none',
            width: 150, fontFamily: 'inherit',
            caretColor: '#00e5ff',
          }}
        />
        {query && matchCount > 0 && (
          <span style={{
            position: 'absolute', right: 8,
            fontSize: 9, color: '#00e5ff', fontWeight: 700,
          }}>
            {matchCount}
          </span>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: '#ffffff10' }} />

      {/* Layout buttons */}
      {layouts.map(({ id, label, icon }) => (
        <button
          key={id}
          title={label}
          onClick={() => onLayout(id)}
          style={{
            background: layout === id ? '#00e5ff18' : 'transparent',
            border: `1px solid ${layout === id ? '#00e5ff44' : 'transparent'}`,
            borderRadius: 7, padding: '4px 10px',
            color: layout === id ? '#00e5ff' : '#4b5563',
            fontSize: 11, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span>{icon}</span>
          <span style={{ fontSize: 10 }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main inner component (needs useReactFlow)
// ─────────────────────────────────────────────

function GraphFlowInner() {
  const { setCenter, getNode } = useReactFlow();

  // ── State ──────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState(RAW_NODES as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(RAW_EDGES);

  const [hoveredId,    setHoveredId]    = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<ClassData> | null>(null);
  const [pathIds,      setPathIds]      = useState<Set<string> | null>(null);

  // ② Edge filter
  const [activeEdgeKinds, setActiveEdgeKinds] = useState<Set<EdgeKind>>(
    new Set(['extends', 'implements', 'mixin'])
  );

  // ③ Search
  const [query, setQuery] = useState('');

  // ④ Layout
  const [layout, setLayout] = useState<LayoutDir>('TB');

  // ─────────────────────────────────────────
  // ② Edge filter: derive visible edges
  // ─────────────────────────────────────────
  const visibleEdges = useMemo(
    () => RAW_EDGES.filter((e) => activeEdgeKinds.has(e.data?.kind as EdgeKind)),
    [activeEdgeKinds]
  );

  const handleToggleEdge = useCallback((kind: EdgeKind) => {
    setActiveEdgeKinds((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  }, []);

  // ─────────────────────────────────────────
  // ① Hover focus
  // ─────────────────────────────────────────
  const handleNodeMouseEnter = useCallback((_: any, node: Node) => {
    setHoveredId(node.id);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredId(null);
  }, []);

  // ─────────────────────────────────────────
  // ③ Path tracing on click
  // ─────────────────────────────────────────
  const handleNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node as Node<ClassData>);
    const connected = getConnectedPath(node.id, RAW_EDGES);
    setPathIds(connected);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setPathIds(null);
  }, []);

  // ─────────────────────────────────────────
  // Merge: dimmed / highlighted state into node data
  // ─────────────────────────────────────────
  const displayNodes = useMemo(() => {
    return nodes.map((n) => {
      let dimmed = false;
      let highlighted = false;

      if (hoveredId) {
        const neighbors = getNeighborIds(hoveredId, visibleEdges);
        dimmed = n.id !== hoveredId && !neighbors.has(n.id);
        highlighted = n.id === hoveredId || neighbors.has(n.id);
      } else if (pathIds) {
        dimmed = !pathIds.has(n.id);
        highlighted = pathIds.has(n.id);
      }

      return { ...n, data: { ...n.data, dimmed, highlighted } };
    });
  }, [nodes, hoveredId, pathIds, visibleEdges]);

  // Edge dim on hover / path
  const displayEdges = useMemo(() => {
    return visibleEdges.map((e) => {
      let opacity = 1;
      if (hoveredId) {
        const neighbors = getNeighborIds(hoveredId, visibleEdges);
        const connected = e.source === hoveredId || e.target === hoveredId
          || neighbors.has(e.source) || neighbors.has(e.target);
        // only edges directly touching hovered node
        const direct = e.source === hoveredId || e.target === hoveredId;
        opacity = direct ? 1 : 0.08;
      } else if (pathIds) {
        opacity = pathIds.has(e.source) && pathIds.has(e.target) ? 1 : 0.08;
      }
      return {
        ...e,
        style: { ...e.style, opacity },
      };
    });
  }, [visibleEdges, hoveredId, pathIds]);

  // ─────────────────────────────────────────
  // ③ Search: highlight + camera jump
  // ─────────────────────────────────────────
  const searchMatches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return RAW_NODES.filter((n) => n.data.label.toLowerCase().includes(q));
  }, [query]);

  // Jump camera to first match
  useEffect(() => {
    if (searchMatches.length === 0) return;
    const first = searchMatches[0];
    const rfNode = getNode(first.id);
    if (!rfNode) return;
    const cx = rfNode.position.x + NODE_W / 2;
    const cy = rfNode.position.y + NODE_H / 2;
    setCenter(cx, cy, { zoom: 1.4, duration: 500 });

    // Highlight path of matched nodes
    const ids = new Set(searchMatches.map((n) => n.id));
    setPathIds(ids);
  }, [searchMatches, getNode, setCenter]);

  // Clear on empty
  useEffect(() => {
    if (!query.trim()) setPathIds(null);
  }, [query]);

  // ─────────────────────────────────────────
  // ④ Layout change
  // ─────────────────────────────────────────
  const applyLayout = useCallback((dir: LayoutDir) => {
    setLayout(dir);
    let next: Node[];
    if (dir === 'radial') {
      next = applyRadialLayout([...nodes], RAW_EDGES);
    } else {
      next = applyDagreLayout([...nodes], RAW_EDGES, dir);
    }
    setNodes(next as any);
  }, [nodes, setNodes]);

  // Initialise layout once on mount
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const laid = applyDagreLayout(RAW_NODES as Node[], RAW_EDGES, 'TB');
    setNodes(laid as any);
  }, [setNodes]);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* ── Toolbar ── */}
      <Toolbar
        query={query}
        onQuery={setQuery}
        layout={layout}
        onLayout={applyLayout}
        matchCount={searchMatches.length}
      />

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} size={0.8} color="#00e5ff18" style={{ backgroundColor: '#05070a' }} />
        <Controls style={{ background: '#0b0d14', border: '1px solid #ffffff10', borderRadius: 10 }} />
        <MiniMap
          style={{ background: '#0b0d14', border: '1px solid #ffffff10', borderRadius: 10 }}
          nodeColor={((n: any) => KIND_THEME[(n.data?.kind as NodeKind) ?? 'concrete'].border + '99') as any}
          maskColor="#05070acc"
        />
      </ReactFlow>

      {/* ② Legend with edge filter */}
      <Legend activeEdgeKinds={activeEdgeKinds} onToggleEdge={handleToggleEdge} />

      {/* ③ Detail panel */}
      <DetailPanel node={selectedNode} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Export: wrap with ReactFlowProvider
// ─────────────────────────────────────────────

export default function GraphFlow() {
  return (
    <ReactFlowProvider>
      <GraphFlowInner />
    </ReactFlowProvider>
  );
}