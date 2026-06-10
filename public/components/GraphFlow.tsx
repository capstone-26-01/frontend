'use client';

import React, { useCallback, useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { RepoGraphNode, RepoGraphEdge } from '@/lib/api';
import ReactFlow, {
  Background as _Background,
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
  getBezierPath,
  BaseEdge as _BaseEdge,
  EdgeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
// npm install dagre @types/dagre
import dagre from 'dagre';

const Background = _Background as any;
const BaseEdge = _BaseEdge as any;

// ─────────────────────────────────────────────
// Types & Theme
// ─────────────────────────────────────────────

export type NodeKind = 'abstract' | 'concrete' | 'interface' | 'mixin' | 'class' | 'function' | 'module' | 'method' | 'external' | 'file' | 'directory';

export interface NodeInfo {
  id: string;
  label: string;
  kind: NodeKind;
  methods: string[];
  properties?: string[];
}

export interface GraphFlowHandle {
  focusNode: (id: string) => void;
}

interface GraphFlowProps {
  onNodeSelect?: (node: NodeInfo) => void;
  apiNodes?: RepoGraphNode[] | null;
  apiEdges?: RepoGraphEdge[] | null;
  loading?: boolean;
  issueHighlightIds?: Set<string> | null;
}
type EdgeKind = string;
type LayoutDir = 'TB' | 'LR' | 'radial';
type ViewLevel = 'file' | 'class' | 'function' | 'folders' | 'all';

// Code-symbol kinds — their presence means the repo was analyzed into modules/classes/functions.
// When absent (only file/directory), we switch the view toggle to a file-tree mode (Folders / All).
const CODE_KINDS = ['module', 'class', 'function', 'abstract', 'interface', 'concrete', 'mixin', 'method'];

const LEVEL_NODE_KINDS: Record<ViewLevel, Set<string>> = {
  file:     new Set(['module', 'file', 'directory']),
  class:    new Set(['module', 'file', 'directory', 'class', 'abstract', 'interface', 'concrete', 'mixin']),
  function: new Set(['module', 'file', 'directory', 'class', 'abstract', 'interface', 'concrete', 'mixin', 'function']),
  // File-tree mode
  folders:  new Set(['directory']),
  all:      new Set(['directory', 'file', 'module']),
};

const LEVEL_EDGE_KINDS: Record<ViewLevel, string[]> = {
  file:     ['contains'],
  class:    ['contains', 'inherits', 'imports'],
  function: ['contains', 'inherits', 'imports', 'calls', 'entrypoint'],
  folders:  ['contains'],
  all:      ['contains'],
};

const DEFAULT_HIDDEN_KINDS = new Set(['external', 'method']);

interface ClassData {
  label: string;
  kind: NodeKind;
  methods: string[];
  properties?: string[];
}

const KIND_THEME: Record<NodeKind, {
  border: string; badge: string; badgeText: string; glow: string; icon: string;
}> = {
  // OOP 스타일
  abstract:  { border: '#00e5ff', badge: '#00e5ff22', badgeText: '#00e5ff', glow: '0 0 24px rgba(0,229,255,0.35)', icon: '⬡' },
  concrete:  { border: '#3b82f6', badge: '#3b82f622', badgeText: '#93c5fd', glow: '0 0 16px rgba(59,130,246,0.25)', icon: '⬢' },
  interface: { border: '#a855f7', badge: '#a855f722', badgeText: '#d8b4fe', glow: '0 0 16px rgba(168,85,247,0.25)', icon: '⟨⟩' },
  mixin:     { border: '#f59e0b', badge: '#f59e0b22', badgeText: '#fcd34d', glow: '0 0 16px rgba(245,158,11,0.25)', icon: '⊕' },
  // API 실제 kind 값
  class:    { border: '#3b82f6', badge: '#3b82f622', badgeText: '#93c5fd', glow: '0 0 16px rgba(59,130,246,0.25)', icon: '⬢' },
  function: { border: '#10b981', badge: '#10b98122', badgeText: '#6ee7b7', glow: '0 0 16px rgba(16,185,129,0.25)', icon: 'ƒ' },
  module:   { border: '#00e5ff', badge: '#00e5ff22', badgeText: '#00e5ff', glow: '0 0 24px rgba(0,229,255,0.35)', icon: '◈' },
  method:   { border: '#6366f1', badge: '#6366f122', badgeText: '#a5b4fc', glow: '0 0 16px rgba(99,102,241,0.25)', icon: 'm' },
  external: { border: '#4b5563', badge: '#4b556322', badgeText: '#9ca3af', glow: '0 0 8px rgba(75,85,99,0.2)',   icon: '↗' },
  // 파일 트리 kind (분석 미지원 레포 등)
  directory: { border: '#818cf8', badge: '#818cf822', badgeText: '#a5b4fc', glow: '0 0 16px rgba(129,140,248,0.25)', icon: '▸' },
  file:      { border: '#8b98a5', badge: '#8b98a51f', badgeText: '#c0c9d4', glow: '0 0 12px rgba(139,152,165,0.2)',  icon: '◦' },
};

// ─────────────────────────────────────────────
// ClassNode
// ─────────────────────────────────────────────

interface ClassNodeData extends ClassData {
  dimmed?: boolean;
  highlighted?: boolean;
  flashing?: boolean;
  expandable?: boolean;
  expanded?: boolean;
}

function ClassNode({ data, selected }: NodeProps<ClassNodeData>) {
  const theme = KIND_THEME[data.kind] ?? KIND_THEME.concrete;
  const opacity = data.dimmed ? 0.18 : 1;
  const scale = data.highlighted ? 1.04 : 1;

  // Compact single-line node for file/directory tree
  if (data.kind === 'file' || data.kind === 'directory') {
    const active = selected || data.highlighted;
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: selected ? '#0f1420' : '#0b0d14',
          border: `1.5px solid ${active ? theme.border : theme.border + '44'}`,
          borderRadius: 9, padding: '9px 13px',
          width: COMPACT_W, height: COMPACT_H, boxSizing: 'border-box',
          boxShadow: data.flashing
            ? `0 0 0 4px ${theme.border}50, 0 0 32px ${theme.border}60`
            : (active ? theme.glow : 'none'),
          transition: 'all 0.18s ease',
          opacity, transform: `scale(${scale})`,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: theme.border, border: 'none', width: 7, height: 7 }} />
        <span style={{ fontSize: 14, color: theme.border, lineHeight: 1, flexShrink: 0, width: 14, textAlign: 'center' }}>
          {data.expandable ? (data.expanded ? '▾' : '▸') : theme.icon}
        </span>
        <span style={{
          fontSize: 12.5, fontWeight: data.kind === 'directory' ? 700 : 500,
          color: data.kind === 'directory' ? '#f0f3f8' : '#c9d1d9',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {data.label}
        </span>
        {data.expandable && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: theme.badgeText, opacity: 0.7, flexShrink: 0 }}>
            {data.expanded ? '' : '⋯'}
          </span>
        )}
        <Handle type="source" position={Position.Bottom} style={{ background: theme.border, border: 'none', width: 7, height: 7 }} />
      </div>
    );
  }

  return (
    <div
      style={{
        background: selected ? '#0f1420' : '#0b0d14',
        border: `1.5px solid ${selected || data.highlighted ? theme.border : theme.border + '55'}`,
        borderRadius: 14,
        minWidth: 190,
        boxShadow: data.flashing
          ? `0 0 0 4px ${theme.border}50, 0 0 32px ${theme.border}60`
          : (selected || data.highlighted ? theme.glow : 'none'),
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
            <div key={p} style={{ fontSize: 10, color: '#94a3b8', lineHeight: '1.7' }}>
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
const edgeTypes = { bundledEdge: BundledEdge };

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

// ─────────────────────────────────────────────
// Edge theme — kind별 색상 + 선 스타일
// ─────────────────────────────────────────────
const EDGE_PALETTE: Record<string, { color: string; dash?: string; width?: number }> = {
  // API 실제 kind
  inherits:   { color: '#00e5ff', width: 2 },
  imports:    { color: '#6366f1', dash: '8 4', width: 1.5 },
  calls:      { color: '#f59e0b', dash: '3 5', width: 1.5 },
  contains:   { color: '#7a8a9e', width: 1 },
  entrypoint: { color: '#10b981', width: 2.5 },
  // OOP 레거시
  extends:    { color: '#00e5ff', width: 2 },
  implements: { color: '#a855f7', dash: '5 4', width: 1.5 },
  mixin:      { color: '#f59e0b', dash: '3 3', width: 1.5 },
};
const EDGE_DEFAULT = { color: '#7a8a9e', width: 1 };

const EDGE_BASE_OPACITY: Record<string, number> = {
  contains:   1.0,
  inherits:   1.0,
  extends:    1.0,
  implements: 0.85,
  imports:    0.55,
  calls:      0.5,
  mixin:      0.75,
  entrypoint: 1.0,
};

// ─────────────────────────────────────────────
// BundledEdge: edges from the same source share a trunk point
// ─────────────────────────────────────────────

const BUNDLE_OFFSET = 64;

function BundledEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, style, markerEnd,
  label, labelStyle, labelBgStyle, labelBgPadding, labelBgBorderRadius,
}: EdgeProps) {
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (data?.bundled) {
    // All edges from the same source share (sourceX, sourceY + BUNDLE_OFFSET) as the trunk point.
    // The first bezier segment is identical for all siblings → visually merges into one line.
    const bx = sourceX;
    const by = sourceY + BUNDLE_OFFSET;
    const mid = (by + targetY) / 2;
    edgePath = [
      `M ${sourceX} ${sourceY}`,
      `C ${sourceX} ${sourceY + BUNDLE_OFFSET * 0.85},`,
      `${bx} ${by - BUNDLE_OFFSET * 0.15},`,
      `${bx} ${by}`,
      `C ${bx} ${mid},`,
      `${targetX} ${mid},`,
      `${targetX} ${targetY}`,
    ].join(' ');
    labelX = (bx + targetX) / 2;
    labelY = mid;
  } else {
    [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  }

  return (
    <BaseEdge
      path={edgePath}
      style={style}
      markerEnd={markerEnd}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding as [number, number] | undefined}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  );
}

function getEdgeStyle(kind: string) {
  const p = EDGE_PALETTE[kind] ?? EDGE_DEFAULT;
  return {
    data: { kind },
    style: {
      stroke: p.color,
      strokeWidth: p.width ?? 1.5,
      strokeDasharray: p.dash,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: p.color,
      width: 12, height: 12,
    },
    label: kind,
    labelStyle: {
      fontSize: 9,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fill: p.color,
      fontWeight: 700,
    },
    labelBgStyle: { fill: '#05070a', fillOpacity: 0.85 },
    labelBgPadding: [3, 6] as [number, number],
    labelBgBorderRadius: 4,
  };
}

const RAW_EDGES: Edge[] = [
  { id: 'a-m',     source: 'animal',    target: 'mammal',   ...getEdgeStyle('extends') },
  { id: 'a-b',     source: 'animal',    target: 'bird',     ...getEdgeStyle('extends') },
  { id: 'm-dog',   source: 'mammal',    target: 'dog',      ...getEdgeStyle('extends') },
  { id: 'm-dol',   source: 'mammal',    target: 'dolphin',  ...getEdgeStyle('extends') },
  { id: 'b-eag',   source: 'bird',      target: 'eagle',    ...getEdgeStyle('extends') },
  { id: 'b-pen',   source: 'bird',      target: 'penguin',  ...getEdgeStyle('extends') },
  { id: 'fly-eag', source: 'flyable',   target: 'eagle',    ...getEdgeStyle('implements') },
  { id: 'fly-bird',source: 'flyable',   target: 'bird',     ...getEdgeStyle('implements') },
  { id: 'swim-dol',source: 'swimmable', target: 'dolphin',  ...getEdgeStyle('mixin') },
  { id: 'swim-pen',source: 'swimmable', target: 'penguin',  ...getEdgeStyle('mixin') },
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
// ② Depth-limited BFS from a node
// ─────────────────────────────────────────────

const MAX_DEPTH = 5;

function getNodesWithinDepth(startId: string, edges: Edge[], maxDepth: number): Set<string> {
  const visited = new Set<string>([startId]);
  const queue: Array<{ id: string; d: number }> = [{ id: startId, d: 0 }];
  while (queue.length) {
    const { id: cur, d } = queue.shift()!;
    if (d >= maxDepth) continue;
    edges.forEach((e) => {
      if (e.source === cur && !visited.has(e.target)) { visited.add(e.target); queue.push({ id: e.target, d: d + 1 }); }
      if (e.target === cur && !visited.has(e.source)) { visited.add(e.source); queue.push({ id: e.source, d: d + 1 }); }
    });
  }
  return visited;
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
const COMPACT_W = 210;
const COMPACT_H = 46;

function isCompactKind(kind?: string): boolean {
  return kind === 'file' || kind === 'directory';
}

function nodeSize(n: Node): { width: number; height: number } {
  return isCompactKind((n.data as ClassData)?.kind)
    ? { width: COMPACT_W, height: COMPACT_H }
    : { width: NODE_W, height: NODE_H };
}

function applyDagreLayout(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR'): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 28, ranksep: 56 });
  nodes.forEach((n) => g.setNode(n.id, nodeSize(n)));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    const s = nodeSize(n);
    return { ...n, position: { x: x - s.width / 2, y: y - s.height / 2 } };
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
  presentNodeKinds,
  presentEdgeKinds,
}: {
  activeEdgeKinds: Set<EdgeKind>;
  onToggleEdge: (k: EdgeKind) => void;
  presentNodeKinds: Set<string>;
  presentEdgeKinds: Set<string>;
}) {
  const ALL_NODE_ITEMS: { kind: NodeKind; label: string }[] = [
    { kind: 'directory', label: 'Directory' },
    { kind: 'file',      label: 'File' },
    { kind: 'class',    label: 'Class' },
    { kind: 'module',   label: 'Module' },
    { kind: 'function', label: 'Function' },
    { kind: 'abstract', label: 'Abstract' },
    { kind: 'concrete', label: 'Concrete' },
    { kind: 'interface',label: 'Interface' },
    { kind: 'mixin',    label: 'Mixin' },
    { kind: 'method',   label: 'Method' },
    { kind: 'external', label: 'External' },
  ];
  const nodeItems = ALL_NODE_ITEMS.filter(i => presentNodeKinds.has(i.kind));
  const edgeItems = Array.from(presentEdgeKinds).map(kind => {
    const p = EDGE_PALETTE[kind] ?? EDGE_DEFAULT;
    return { kind, color: p.color, dash: p.dash ?? 'none' };
  });

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
        <div style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.1em', marginBottom: 2 }}>
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
              <span style={{ fontSize: 10, color: active ? '#cbd5e1' : '#6b7280' }}>{kind}</span>
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

function DetailPanel({ node, childStats, onFocus, onSummarize }: {
  node: Node<ClassData> | null;
  childStats: { folders: number; files: number } | null;
  onFocus: () => void;
  onSummarize: () => void;
}) {
  if (!node) return null;
  const { label, kind, methods, properties } = node.data;
  const t = KIND_THEME[kind] ?? KIND_THEME.concrete;
  const parentSegments = node.id.split('/').slice(0, -1);

  const actionBtn: React.CSSProperties = {
    flex: 1, fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
    color: '#9aa6b2', background: '#ffffff08', border: '1px solid #ffffff12',
    borderRadius: 6, padding: '4px 6px', cursor: 'pointer', transition: 'all 0.15s',
  };
  const aEnter = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.color = '#00e5ff'; e.currentTarget.style.borderColor = '#00e5ff44'; };
  const aLeave = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.color = '#9aa6b2'; e.currentTarget.style.borderColor = '#ffffff12'; };

  return (
    <div style={{
      position: 'absolute', top: 64, right: 16, zIndex: 10,
      background: '#0b0d14ee', border: `1px solid ${t.border}33`,
      borderRadius: 11, padding: '10px 12px', minWidth: 170, maxWidth: 220,
      backdropFilter: 'blur(12px)',
      fontFamily: '"JetBrains Mono", monospace',
      boxShadow: t.glow,
      transition: 'all 0.2s ease',
    }}>
      {/* Path breadcrumb */}
      {parentSegments.length > 0 && (
        <div style={{ fontSize: 9, color: '#6b7787', marginBottom: 5, lineHeight: 1.4, wordBreak: 'break-all' }}>
          {parentSegments.map((s, i) => (
            <span key={i}>{i > 0 && <span style={{ opacity: 0.45 }}> › </span>}{s}</span>
          ))}
        </div>
      )}

      <div style={{ fontSize: 8, color: t.badgeText, letterSpacing: '0.12em', marginBottom: 3, textTransform: 'uppercase' }}>
        {t.icon} {kind}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#e8eaf0', marginBottom: 7, wordBreak: 'break-all', lineHeight: 1.25 }}>{label}</div>

      {/* Directory child stats */}
      {childStats && (childStats.folders + childStats.files) > 0 && (
        <div style={{ fontSize: 9.5, color: '#94a3b8', marginBottom: 7, display: 'flex', gap: 10 }}>
          <span style={{ color: '#a5b4fc' }}>▸ {childStats.folders} {childStats.folders === 1 ? 'folder' : 'folders'}</span>
          <span style={{ color: '#c0c9d4' }}>◦ {childStats.files} {childStats.files === 1 ? 'file' : 'files'}</span>
        </div>
      )}

      {properties && properties.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 4, letterSpacing: '0.1em' }}>PROPERTIES</div>
          {properties.map(p => (
            <div key={p} style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.8 }}>
              <span style={{ color: '#4ade80' }}>+</span> {p}
            </div>
          ))}
        </div>
      )}
      {methods && methods.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 4, letterSpacing: '0.1em' }}>METHODS</div>
          {methods.map(m => (
            <div key={m} style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.8 }}>
              <span style={{ color: t.badgeText, opacity: 0.7 }}>ƒ</span> {m}
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
        <button style={actionBtn} onMouseEnter={aEnter} onMouseLeave={aLeave} onClick={onFocus}>Focus</button>
        <button style={actionBtn} onMouseEnter={aEnter} onMouseLeave={aLeave} onClick={onSummarize}>Summarize</button>
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
  viewLevel,
  onViewLevel,
  treeMode,
  searchRef,
}: {
  query: string;
  onQuery: (q: string) => void;
  layout: LayoutDir;
  onLayout: (l: LayoutDir) => void;
  matchCount: number;
  viewLevel: ViewLevel;
  onViewLevel: (l: ViewLevel) => void;
  treeMode: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const views: { id: ViewLevel; label: string; icon: string }[] = treeMode
    ? [
        { id: 'folders', label: 'Folders', icon: '▸' },
        { id: 'all',     label: 'All',     icon: '◦' },
      ]
    : [
        { id: 'file',     label: 'File',  icon: '◈' },
        { id: 'class',    label: 'Class', icon: '⬢' },
        { id: 'function', label: 'Func',  icon: 'ƒ' },
      ];

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
        <span style={{ position: 'absolute', left: 8, fontSize: 11, color: '#6b7280' }}>⌕</span>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search node…  ( / )"
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

      {/* View level buttons */}
      {views.map(({ id, label, icon }) => (
        <button
          key={id}
          title={`${label} view`}
          onClick={() => onViewLevel(id)}
          style={{
            background: viewLevel === id ? '#00e5ff18' : 'transparent',
            border: `1px solid ${viewLevel === id ? '#00e5ff55' : 'transparent'}`,
            borderRadius: 7, padding: '4px 9px',
            color: viewLevel === id ? '#00e5ff' : '#6b7280',
            fontSize: 10, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
            fontWeight: viewLevel === id ? 700 : 400,
          }}
        >
          <span style={{ fontSize: 11 }}>{icon}</span>
          <span>{label}</span>
        </button>
      ))}

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
            color: layout === id ? '#00e5ff' : '#6b7280',
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
// Custom zoom/fit controls (matches toolbar styling)
// ─────────────────────────────────────────────

function GraphControls({ onExpandAll, onCollapseAll, treeable }: { onExpandAll: () => void; onCollapseAll: () => void; treeable: boolean }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const btn: React.CSSProperties = {
    width: 30, height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', borderRadius: 8,
    color: '#9aa6b2', cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
  };
  const enter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#00e5ff14';
    e.currentTarget.style.color = '#00e5ff';
  };
  const leave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = '#9aa6b2';
  };
  const divider = <div style={{ height: 1, background: '#ffffff0d', margin: '1px 5px' }} />;

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16, zIndex: 10,
      background: '#0b0d14ee', border: '1px solid #ffffff10',
      borderRadius: 12, padding: 4,
      display: 'flex', flexDirection: 'column', gap: 2,
      backdropFilter: 'blur(8px)', userSelect: 'none',
    }}>
      <button title="Zoom in" style={btn} onMouseEnter={enter} onMouseLeave={leave} onClick={() => zoomIn({ duration: 200 })}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
      {divider}
      <button title="Zoom out" style={btn} onMouseEnter={enter} onMouseLeave={leave} onClick={() => zoomOut({ duration: 200 })}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
      {divider}
      <button title="Fit view" style={btn} onMouseEnter={enter} onMouseLeave={leave} onClick={() => fitView({ padding: 0.15, duration: 400 })}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5.5V3a1 1 0 0 1 1-1h2.5M10.5 2H13a1 1 0 0 1 1 1v2.5M14 10.5V13a1 1 0 0 1-1 1h-2.5M5.5 14H3a1 1 0 0 1-1-1v-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {treeable && <>
        {divider}
        <button title="Expand all" style={btn} onMouseEnter={enter} onMouseLeave={leave} onClick={onExpandAll}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12M5 5l3-3 3 3M5 11l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {divider}
        <button title="Collapse all" style={btn} onMouseEnter={enter} onMouseLeave={leave} onClick={onCollapseAll}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M5 4l3 3 3-3M5 12l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main inner component (needs useReactFlow)
// ─────────────────────────────────────────────

const GraphFlowInner = forwardRef<GraphFlowHandle, GraphFlowProps>(function GraphFlowInner({ onNodeSelect, apiNodes, apiEdges, loading, issueHighlightIds }, ref) {
  const { setCenter, getNode, fitView } = useReactFlow();

  // ── State ──────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState(RAW_NODES as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(RAW_EDGES);

  const [hoveredId,    setHoveredId]    = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<ClassData> | null>(null);
  const [pathIds,      setPathIds]      = useState<Set<string> | null>(null);
  const [flashId,      setFlashId]      = useState<string | null>(null);
  // Collapsible tree: set of expanded parent ids (children visible only when all ancestors expanded)
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set());
  // Hover tooltip
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; label: string; kind: string; path: string } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusNode: (id: string) => {
      const rfNode = getNode(id);
      if (!rfNode) return;
      setCenter(rfNode.position.x + NODE_W / 2, rfNode.position.y + NODE_H / 2, { zoom: 1.4, duration: 500 });
      setFlashId(id);
      setTimeout(() => setFlashId(null), 1500);
    },
  }), [getNode, setCenter]);

  // View level
  const [viewLevel, setViewLevel] = useState<ViewLevel>('file');

  // ② Edge filter
  const [activeEdgeKinds, setActiveEdgeKinds] = useState<Set<EdgeKind>>(
    new Set(['contains'])
  );

  // ③ Search
  const [query, setQuery] = useState('');

  // ④ Layout
  const [layout, setLayout] = useState<LayoutDir>('TB');

  // ─────────────────────────────────────────
  // ② Edge filter: derive visible edges
  // ─────────────────────────────────────────
  const presentNodeKinds = useMemo(
    () => new Set(nodes.map(n => (n.data as ClassData).kind as string)),
    [nodes]
  );
  const presentEdgeKinds = useMemo(
    () => new Set(edges.map(e => e.data?.kind as string).filter(Boolean)),
    [edges]
  );
  // No code symbols (only file/directory) → file-tree view mode
  const treeMode = useMemo(
    () => !CODE_KINDS.some(k => presentNodeKinds.has(k)),
    [presentNodeKinds]
  );

  // ─────────────────────────────────────────
  // Hierarchy (from 'contains' edges) for collapse/expand
  // ─────────────────────────────────────────
  const hierarchy = useMemo(() => {
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();
    const hasChildren = new Set<string>();
    for (const e of edges) {
      if (e.data?.kind !== 'contains') continue;
      parentMap.set(e.target, e.source);
      hasChildren.add(e.source);
      if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
      childrenMap.get(e.source)!.push(e.target);
    }
    return { parentMap, childrenMap, hasChildren };
  }, [edges]);

  const issueFocusActive = issueHighlightIds !== null;
  const issueVisibleIds = useMemo(() => {
    if (!issueHighlightIds) return null;
    const visible = new Set(issueHighlightIds);
    for (const id of issueHighlightIds) {
      const seen = new Set<string>();
      let cur = hierarchy.parentMap.get(id);
      while (cur !== undefined && !seen.has(cur)) {
        visible.add(cur);
        seen.add(cur);
        cur = hierarchy.parentMap.get(cur);
      }
    }
    return visible;
  }, [issueHighlightIds, hierarchy]);

  const kindById = useMemo(
    () => new Map(nodes.map(n => [n.id, (n.data as ClassData).kind as string])),
    [nodes]
  );

  // A node is hidden when any ancestor is collapsed
  const collapsedHiddenIds = useMemo(() => {
    const { parentMap } = hierarchy;
    const hidden = new Set<string>();
    for (const n of nodes) {
      let cur = parentMap.get(n.id);
      while (cur !== undefined) {
        if (!expandedIds.has(cur)) { hidden.add(n.id); break; }
        cur = parentMap.get(cur);
      }
    }
    return hidden;
  }, [nodes, hierarchy, expandedIds]);

  // Re-run layout over only the visible nodes (kind filter + expanded ancestors)
  const layoutVisible = useCallback((dir: LayoutDir, expanded: Set<string>, level: ViewLevel) => {
    const allowed = LEVEL_NODE_KINDS[level];
    const { parentMap } = hierarchy;
    const isVisible = (id: string, kind: string) => {
      if (issueVisibleIds) return issueVisibleIds.has(id);
      if (DEFAULT_HIDDEN_KINDS.has(kind)) return false;
      if (!allowed.has(kind)) return false;
      let cur = parentMap.get(id);
      while (cur !== undefined) {
        if (!expanded.has(cur)) return false;
        cur = parentMap.get(cur);
      }
      return true;
    };
    setNodes(prev => {
      const visNodes = prev.filter(n => isVisible(n.id, (n.data as ClassData).kind));
      const visIds = new Set(visNodes.map(n => n.id));
      const visEdges = edges.filter(e => visIds.has(e.source) && visIds.has(e.target));
      const laid = dir === 'radial'
        ? applyRadialLayout(visNodes as Node[], visEdges)
        : applyDagreLayout(visNodes as Node[], visEdges, dir);
      const pos = new Map(laid.map(n => [n.id, n.position]));
      return prev.map(n => (pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n));
    });
  }, [hierarchy, edges, issueVisibleIds, setNodes]);

  // Recompute layout + refit whenever expansion / view / layout changes
  useEffect(() => {
    layoutVisible(layout, expandedIds, viewLevel);
    if (issueFocusActive) return;
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 450 }), 90);
    return () => clearTimeout(t);
  }, [expandedIds, viewLevel, layout, layoutVisible, fitView, issueFocusActive]);

  // activeEdgeKinds가 비어있으면(초기값) 전체 허용
  const visibleEdges = useMemo(
    () => activeEdgeKinds.size === 0
      ? edges
      : edges.filter((e) => activeEdgeKinds.has(e.data?.kind as EdgeKind)),
    [edges, activeEdgeKinds]
  );
  const issueEdges = useMemo(
    () => issueVisibleIds
      ? edges.filter((e) => issueVisibleIds.has(e.source) && issueVisibleIds.has(e.target))
      : [],
    [edges, issueVisibleIds]
  );
  const edgeRenderSource = issueFocusActive ? issueEdges : visibleEdges;

  const handleToggleEdge = useCallback((kind: EdgeKind) => {
    setActiveEdgeKinds((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  }, []);

  const handleViewLevel = useCallback((level: ViewLevel) => {
    setViewLevel(level);
    setActiveEdgeKinds(new Set(LEVEL_EDGE_KINDS[level]));
  }, []);

  // ─────────────────────────────────────────
  // Level filter: which node IDs to hide based on viewLevel
  // ─────────────────────────────────────────
  const hiddenNodeIdsByLevel = useMemo(() => {
    const allowed = LEVEL_NODE_KINDS[viewLevel];
    return new Set(nodes.filter(n => {
      const kind = (n.data as ClassData).kind;
      return DEFAULT_HIDDEN_KINDS.has(kind) || !allowed.has(kind);
    }).map(n => n.id));
  }, [nodes, viewLevel]);


  // ─────────────────────────────────────────
  // ① Hover focus
  // ─────────────────────────────────────────
  const handleNodeMouseEnter = useCallback((e: React.MouseEvent, node: Node) => {
    setHoveredId(node.id);
    const d = node.data as ClassData;
    setHoverTip({ x: e.clientX, y: e.clientY, label: d.label, kind: d.kind, path: node.id });
  }, []);

  const handleNodeMouseMove = useCallback((e: React.MouseEvent) => {
    setHoverTip(prev => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredId(null);
    setHoverTip(null);
  }, []);

  // Double-click a directory → expand its whole subtree
  const handleNodeDoubleClick = useCallback((_: any, node: Node) => {
    if (!hierarchy.hasChildren.has(node.id)) return;
    setExpandedIds(prev => {
      const next = new Set(prev);
      const stack = [node.id];
      while (stack.length) {
        const id = stack.pop()!;
        if (hierarchy.hasChildren.has(id)) next.add(id);
        for (const c of (hierarchy.childrenMap.get(id) ?? [])) stack.push(c);
      }
      return next;
    });
  }, [hierarchy]);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(hierarchy.hasChildren));
  }, [hierarchy]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Keyboard shortcuts: "/" focus search, Esc deselect / clear search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (t === searchRef.current) {
          setQuery('');
          searchRef.current?.blur();
        } else if (!typing) {
          setSelectedNode(null);
          setPathIds(null);
          setHoverTip(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─────────────────────────────────────────
  // ③ Path tracing on click
  // ─────────────────────────────────────────
  const handleNodeClick = useCallback((_: any, node: Node) => {
    // Toggle expand/collapse for nodes that have children
    if (hierarchy.hasChildren.has(node.id)) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.has(node.id) ? next.delete(node.id) : next.add(node.id);
        return next;
      });
    }
    // Clicking the already-selected node deselects it
    if (selectedNode?.id === node.id) {
      setSelectedNode(null);
      setPathIds(null);
      return;
    }
    setSelectedNode(node as Node<ClassData>);
    setPathIds(getConnectedPath(node.id, edges));
    onNodeSelect?.({ id: node.id, ...(node.data as ClassData) });
  }, [onNodeSelect, edges, hierarchy, selectedNode]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setPathIds(null);
  }, []);

  // Direct-children stats for the selected node (for the detail panel)
  const selectedStats = useMemo(() => {
    if (!selectedNode) return null;
    const kids = hierarchy.childrenMap.get(selectedNode.id);
    if (!kids || kids.length === 0) return null;
    let folders = 0, files = 0;
    for (const cid of kids) {
      (kindById.get(cid) === 'directory') ? folders++ : files++;
    }
    return { folders, files };
  }, [selectedNode, hierarchy, kindById]);

  const focusSelected = useCallback(() => {
    if (!selectedNode) return;
    const rf = getNode(selectedNode.id);
    if (rf) setCenter(rf.position.x + NODE_W / 2, rf.position.y + 23, { zoom: 1.2, duration: 450 });
  }, [selectedNode, getNode, setCenter]);

  const summarizeSelected = useCallback(() => {
    if (selectedNode) onNodeSelect?.({ id: selectedNode.id, ...(selectedNode.data as ClassData) });
  }, [selectedNode, onNodeSelect]);

  // ─────────────────────────────────────────
  // Merge: dimmed / highlighted state into node data
  // ─────────────────────────────────────────
  const displayNodes = useMemo(() => {
    return nodes.map((n) => {
      const hidden = issueFocusActive
        ? !issueVisibleIds?.has(n.id)
        : hiddenNodeIdsByLevel.has(n.id) || collapsedHiddenIds.has(n.id);

      let dimmed = false;
      let highlighted = false;

      if (issueFocusActive) {
        highlighted = issueHighlightIds?.has(n.id) ?? false;
      } else if (hoveredId) {
        const neighbors = getNeighborIds(hoveredId, edgeRenderSource);
        dimmed = n.id !== hoveredId && !neighbors.has(n.id);
        highlighted = n.id === hoveredId || neighbors.has(n.id);
      } else if (pathIds) {
        dimmed = !pathIds.has(n.id);
        highlighted = pathIds.has(n.id);
      }

      const flashing = n.id === flashId;
      const expandable = hierarchy.hasChildren.has(n.id);
      return {
        ...n,
        hidden,
        data: { ...n.data, dimmed, highlighted: highlighted || flashing, flashing, expandable, expanded: expandable && expandedIds.has(n.id) },
      };
    });
  }, [nodes, hoveredId, issueHighlightIds, issueFocusActive, issueVisibleIds, pathIds, edgeRenderSource, flashId, hiddenNodeIdsByLevel, collapsedHiddenIds, hierarchy, expandedIds]);

  // Edge dim on hover / path + bundling + level filter + base opacity
  const displayEdges = useMemo(() => {
    const sourceCounts: Record<string, number> = {};
    edgeRenderSource.forEach((e) => { sourceCounts[e.source] = (sourceCounts[e.source] ?? 0) + 1; });

    return edgeRenderSource.map((e) => {
      const hiddenByLevel =
        hiddenNodeIdsByLevel.has(e.source) || hiddenNodeIdsByLevel.has(e.target) ||
        collapsedHiddenIds.has(e.source) || collapsedHiddenIds.has(e.target);

      const kind = e.data?.kind as string ?? '';
      const baseOpacity = EDGE_BASE_OPACITY[kind] ?? 0.6;

      let opacity = baseOpacity;
      if (hoveredId) {
        const direct = e.source === hoveredId || e.target === hoveredId;
        opacity = direct ? 1 : 0.06;
      } else if (pathIds) {
        opacity = pathIds.has(e.source) && pathIds.has(e.target) ? baseOpacity : 0.06;
      }
      return {
        ...e,
        type: 'bundledEdge',
        hidden: issueFocusActive ? false : hiddenByLevel,
        data: { ...(e.data ?? {}), bundled: sourceCounts[e.source] > 1 },
        style: { ...e.style, opacity },
      };
    });
  }, [edgeRenderSource, hoveredId, issueFocusActive, pathIds, hiddenNodeIdsByLevel, collapsedHiddenIds]);

  // ─────────────────────────────────────────
  // ③ Search: highlight + camera jump
  // ─────────────────────────────────────────
  const searchMatches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return nodes.filter((n) =>
      (!issueVisibleIds || issueVisibleIds.has(n.id)) &&
      (n.data as ClassData).label.toLowerCase().includes(q)
    );
  }, [query, nodes, issueVisibleIds]);

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
  // Focus camera on issue-related nodes when an issue is selected
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!issueVisibleIds || issueVisibleIds.size === 0) return;

    const nodeIds = new Set(nodes.map((n) => n.id));
    const targets = Array.from(issueVisibleIds)
      .filter(id => nodeIds.has(id))
      .map(id => ({ id }));
    if (targets.length === 0) return;
    const t = setTimeout(() => {
      fitView({ nodes: targets, padding: 0.45, duration: 600, maxZoom: 1.3 });
    }, 280);
    return () => clearTimeout(t);
  }, [issueVisibleIds, nodes, fitView]);


  // ─────────────────────────────────────────
  // ④ Layout change
  // ─────────────────────────────────────────
  // Layout is recomputed (over visible nodes) by the effect that watches `layout`.
  const applyLayout = useCallback((dir: LayoutDir) => setLayout(dir), []);

  // Initialise layout once on mount with RAW data
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const laid = applyDagreLayout(RAW_NODES as Node[], RAW_EDGES, 'TB');
    setNodes(laid as any);
  }, [setNodes]);

  // Re-initialize when real API data arrives
  useEffect(() => {
    if (!apiNodes || !apiEdges) return;

    const nodeIds = new Set(apiNodes.map(n => n.id));

    const rfNodes: Node<ClassData>[] = apiNodes
      .map(n => ({
        id: n.id, type: 'classNode', position: { x: 0, y: 0 },
        data: { label: n.label, kind: (n.kind in KIND_THEME ? n.kind : 'concrete') as NodeKind, methods: n.methods ?? [], properties: n.properties },
      }));

    // Keep API edges whose endpoints exist; visibility is derived later.
    const rfEdges: Edge[] = apiEdges
      .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map(e => ({
        id: e.id ?? `${e.source}-${e.target}`,
        source: e.source, target: e.target,
        ...getEdgeStyle(e.kind),
      }));

    // 기본 뷰: 코드 심볼 있으면 File, 파일 트리만 있으면 Folders(디렉토리만)
    const hasCode = apiNodes.some(n => CODE_KINDS.includes(n.kind));
    setViewLevel(hasCode ? 'file' : 'folders');
    setActiveEdgeKinds(new Set(['contains']));

    // 초기 펼침: 파일 트리는 접힌 채(최상위만), 코드 그래프는 전체 펼침(기존 동작 유지)
    const parentIds = new Set(rfEdges.filter(e => e.data?.kind === 'contains').map(e => e.source));
    setExpandedIds(hasCode ? parentIds : new Set());

    const laid = applyDagreLayout(rfNodes, rfEdges, 'TB');
    setNodes(laid as any);
    setEdges(rfEdges);
    setLayout('TB');
    setSelectedNode(null);
    setPathIds(null);
  }, [apiNodes, apiEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: '#05070acc', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, fontFamily: '"JetBrains Mono", monospace',
        }}>
          <div style={{
            width: 32, height: 32, border: '2px solid #00e5ff33',
            borderTopColor: '#00e5ff', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: 11, color: '#00e5ff88', letterSpacing: '0.1em' }}>Loading graph…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Toolbar ── */}
      <Toolbar
        query={query}
        onQuery={setQuery}
        layout={layout}
        onLayout={applyLayout}
        matchCount={searchMatches.length}
        viewLevel={viewLevel}
        onViewLevel={handleViewLevel}
        treeMode={treeMode}
        searchRef={searchRef}
      />

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseMove={handleNodeMouseMove}
        onNodeMouseLeave={handleNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} size={0.8} color="#00e5ff18" style={{ backgroundColor: '#05070a' }} />
      </ReactFlow>

      {/* Hover tooltip */}
      {hoverTip && (
        <div style={{
          position: 'fixed', left: hoverTip.x + 14, top: hoverTip.y + 14, zIndex: 50,
          pointerEvents: 'none', maxWidth: 320,
          background: '#0b0d14f2', border: `1px solid ${(KIND_THEME[hoverTip.kind as NodeKind] ?? KIND_THEME.concrete).border}55`,
          borderRadius: 8, padding: '7px 10px',
          fontFamily: '"JetBrains Mono", monospace',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: (KIND_THEME[hoverTip.kind as NodeKind] ?? KIND_THEME.concrete).badgeText }}>
              {(KIND_THEME[hoverTip.kind as NodeKind] ?? KIND_THEME.concrete).icon} {hoverTip.kind}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e8eaf0' }}>{hoverTip.label}</span>
          </div>
          <div style={{ fontSize: 9.5, color: '#7a8896', wordBreak: 'break-all' }}>{hoverTip.path}</div>
          {hierarchy.hasChildren.has(hoverTip.path) && (
            <div style={{ fontSize: 9, color: '#6b7787', marginTop: 3 }}>
              {(hierarchy.childrenMap.get(hoverTip.path) ?? []).length} children · click to {expandedIds.has(hoverTip.path) ? 'collapse' : 'expand'}
            </div>
          )}
        </div>
      )}

      {/* ① Custom zoom/fit controls */}
      <GraphControls onExpandAll={expandAll} onCollapseAll={collapseAll} treeable={hierarchy.hasChildren.size > 0} />

      {/* ② Legend with edge filter */}
      <Legend
        activeEdgeKinds={activeEdgeKinds}
        onToggleEdge={handleToggleEdge}
        presentNodeKinds={presentNodeKinds}
        presentEdgeKinds={presentEdgeKinds}
      />

      {/* ③ Detail panel */}
      <DetailPanel node={selectedNode} childStats={selectedStats} onFocus={focusSelected} onSummarize={summarizeSelected} />
    </div>
  );
});

// ─────────────────────────────────────────────
// Export: wrap with ReactFlowProvider
// ─────────────────────────────────────────────

const GraphFlow = forwardRef<GraphFlowHandle, GraphFlowProps>(function GraphFlow({ onNodeSelect, apiNodes, apiEdges, loading, issueHighlightIds }, ref) {
  return (
    <ReactFlowProvider>
      <GraphFlowInner ref={ref} onNodeSelect={onNodeSelect} apiNodes={apiNodes} apiEdges={apiEdges} loading={loading} issueHighlightIds={issueHighlightIds} />
    </ReactFlowProvider>
  );
});
export default GraphFlow;
