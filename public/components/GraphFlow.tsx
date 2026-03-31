'use client';

import React, { useCallback, useState } from 'react';
import ReactFlow, {
  Background as _Background,
  Controls as _Controls,
  MiniMap as _MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

const Background = _Background as any;
const Controls = _Controls as any;
const MiniMap = _MiniMap as any;

type NodeKind = 'abstract' | 'concrete' | 'interface' | 'mixin';

interface ClassData {
  label: string;
  kind: NodeKind;
  methods: string[];
  properties?: string[];
}

const KIND_THEME: Record<NodeKind, { border: string; badge: string; badgeText: string; glow: string; icon: string }> = {
  abstract:  { border: '#00e5ff', badge: '#00e5ff22', badgeText: '#00e5ff', glow: '0 0 24px rgba(0,229,255,0.35)', icon: '⬡' },
  concrete:  { border: '#3b82f6', badge: '#3b82f622', badgeText: '#93c5fd', glow: '0 0 16px rgba(59,130,246,0.25)', icon: '⬢' },
  interface: { border: '#a855f7', badge: '#a855f722', badgeText: '#d8b4fe', glow: '0 0 16px rgba(168,85,247,0.25)', icon: '⟨⟩' },
  mixin:     { border: '#f59e0b', badge: '#f59e0b22', badgeText: '#fcd34d', glow: '0 0 16px rgba(245,158,11,0.25)', icon: '⊕' },
};

function ClassNode({ data, selected }: NodeProps<ClassData>) {
  const theme = KIND_THEME[data.kind];
  return (
    <div
      style={{
        background: selected ? '#0f1420' : '#0b0d14',
        border: `1.5px solid ${selected ? theme.border : theme.border + '55'}`,
        borderRadius: 14,
        minWidth: 190,
        boxShadow: selected ? theme.glow : 'none',
        transition: 'all 0.2s ease',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: theme.border, border: 'none', width: 8, height: 8 }} />

      {/* Header */}
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
        <div style={{ padding: '7px 14px 4px', borderBottom: `1px solid #ffffff08` }}>
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

      <Handle type="source" position={Position.Bottom} style={{ background: theme.border, border: 'none', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { classNode: ClassNode };

// 예시 그래프, TODO: 나중에 백엔드 api보고 수정하기 
const initialNodes = [
  {
    id: 'animal',
    type: 'classNode',
    position: { x: 340, y: 20 },
    data: {
      label: 'Animal',
      kind: 'abstract' as NodeKind,
      properties: ['name: string', 'age: number'],
      methods: ['speak(): void', 'move(): void', 'toString(): string'],
    },
  },
  {
    id: 'flyable',
    type: 'classNode',
    position: { x: 700, y: 20 },
    data: {
      label: 'IFlyable',
      kind: 'interface' as NodeKind,
      methods: ['fly(): void', 'land(): void'],
    },
  },
  {
    id: 'swimmable',
    type: 'classNode',
    position: { x: -40, y: 20 },
    data: {
      label: 'Swimmable',
      kind: 'mixin' as NodeKind,
      methods: ['swim(): void', 'dive(depth): void'],
    },
  },
  {
    id: 'mammal',
    type: 'classNode',
    position: { x: 160, y: 220 },
    data: {
      label: 'Mammal',
      kind: 'abstract' as NodeKind,
      properties: ['furColor: string'],
      methods: ['breathe(): void', 'nurse(): void'],
    },
  },
  {
    id: 'bird',
    type: 'classNode',
    position: { x: 520, y: 220 },
    data: {
      label: 'Bird',
      kind: 'abstract' as NodeKind,
      properties: ['wingspan: number'],
      methods: ['layEgg(): void', 'speak(): void'],
    },
  },
  {
    id: 'dog',
    type: 'classNode',
    position: { x: 30, y: 430 },
    data: {
      label: 'Dog',
      kind: 'concrete' as NodeKind,
      properties: ['breed: string'],
      methods: ['speak(): void', 'fetch(): void'],
    },
  },
  {
    id: 'dolphin',
    type: 'classNode',
    position: { x: 270, y: 430 },
    data: {
      label: 'Dolphin',
      kind: 'concrete' as NodeKind,
      properties: ['podSize: number'],
      methods: ['speak(): void', 'swim(): void', 'echolocate(): void'],
    },
  },
  {
    id: 'eagle',
    type: 'classNode',
    position: { x: 450, y: 430 },
    data: {
      label: 'Eagle',
      kind: 'concrete' as NodeKind,
      properties: ['territory: string'],
      methods: ['fly(): void', 'hunt(): void', 'land(): void'],
    },
  },
  {
    id: 'penguin',
    type: 'classNode',
    position: { x: 660, y: 430 },
    data: {
      label: 'Penguin',
      kind: 'concrete' as NodeKind,
      properties: ['colony: string'],
      methods: ['speak(): void', 'swim(): void', 'waddle(): void'],
    },
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

const initialEdges: Edge[] = [

  { id: 'a-m', source: 'animal', target: 'mammal', label: 'extends', ...edgeBase },
  { id: 'a-b', source: 'animal', target: 'bird', label: 'extends', ...edgeBase },
  { id: 'm-dog', source: 'mammal', target: 'dog', label: 'extends', ...edgeBase },
  { id: 'm-dol', source: 'mammal', target: 'dolphin', label: 'extends', ...edgeBase },
  { id: 'b-eag', source: 'bird', target: 'eagle', label: 'extends', ...edgeBase },
  { id: 'b-pen', source: 'bird', target: 'penguin', label: 'extends', ...edgeBase },
 
  { id: 'fly-eag', source: 'flyable', target: 'eagle', label: 'implements', ...implementsEdge },
  { id: 'fly-bird', source: 'flyable', target: 'bird', label: 'implements', ...implementsEdge },

  { id: 'swim-dol', source: 'swimmable', target: 'dolphin', label: 'mixin', ...mixinEdge },
  { id: 'swim-pen', source: 'swimmable', target: 'penguin', label: 'mixin', ...mixinEdge },
];


function Legend() {
  const items: { kind: NodeKind; label: string }[] = [
    { kind: 'abstract', label: 'Abstract Class' },
    { kind: 'concrete', label: 'Concrete Class' },
    { kind: 'interface', label: 'Interface' },
    { kind: 'mixin', label: 'Mixin' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 10,
      background: '#0b0d14ee', border: '1px solid #ffffff10',
      borderRadius: 12, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
      backdropFilter: 'blur(8px)',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {items.map(({ kind, label }) => {
        const t = KIND_THEME[kind];
        return (
          <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: t.badge, border: `1.5px solid ${t.border}` }} />
            <span style={{ fontSize: 10, color: t.badgeText }}>{label}</span>
          </div>
        );
      })}
      <div style={{ borderTop: '1px solid #ffffff10', marginTop: 4, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { dash: 'none', color: '#00e5ff88', label: 'extends' },
          { dash: '5 4', color: '#a855f7aa', label: 'implements' },
          { dash: '3 3', color: '#f59e0baa', label: 'mixin' },
        ].map(({ dash, color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="10">
              <line x1="0" y1="5" x2="24" y2="5"
                stroke={color} strokeWidth="1.5"
                strokeDasharray={dash === 'none' ? undefined : dash} />
            </svg>
            <span style={{ fontSize: 10, color: '#6b7280' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function DetailPanel({ node }: { node: typeof initialNodes[0] | null }) {
  if (!node) return null;
  const { label, kind, methods, properties } = node.data;
  const t = KIND_THEME[kind];
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 10,
      background: '#0b0d14ee', border: `1px solid ${t.border}33`,
      borderRadius: 14, padding: '14px 18px', minWidth: 200,
      backdropFilter: 'blur(12px)',
      fontFamily: '"JetBrains Mono", monospace',
      boxShadow: t.glow,
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

export default function GraphFlow() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<typeof initialNodes[0] | null>(null);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onNodeClick = (_: any, node: any) => {
    setSelectedNode(initialNodes.find((n) => n.id === node.id) ?? null);
  };

  const onPaneClick = () => setSelectedNode(null);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={28}
          size={0.8}
          color="#00e5ff18"
          style={{ backgroundColor: '#05070a' }}
        />
        <Controls
          style={{
            background: '#0b0d14',
            border: '1px solid #ffffff10',
            borderRadius: 10,
          }}
        />
        <MiniMap
          style={{
            background: '#0b0d14',
            border: '1px solid #ffffff10',
            borderRadius: 10,
          }}
          nodeColor={((n: any) => KIND_THEME[(n.data?.kind as NodeKind) ?? 'concrete'].border + '99') as any}
          maskColor="#05070acc"
        />
      </ReactFlow>
      <Legend />
      <DetailPanel node={selectedNode} />
    </div>
  );
}