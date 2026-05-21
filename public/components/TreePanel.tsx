'use client';

import { useState, useMemo } from 'react';
import type { RepoGraphNode, RepoGraphEdge } from '@/lib/api';

interface TreeNode {
  id: string;
  label: string;
  kind: string;
  children: TreeNode[];
}

const KIND_ICON: Record<string, string> = {
  module:    '◈',
  class:     '⬢',
  abstract:  '⬡',
  interface: '⟨⟩',
  mixin:     '⊕',
  concrete:  '⬢',
  function:  'ƒ',
  method:    'm',
  external:  '↗',
};

const KIND_COLOR: Record<string, string> = {
  module:    '#00e5ff',
  class:     '#3b82f6',
  abstract:  '#00e5ff',
  interface: '#a855f7',
  mixin:     '#f59e0b',
  concrete:  '#3b82f6',
  function:  '#10b981',
  method:    '#6366f1',
  external:  '#4b5563',
};

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  onSelect: (id: string) => void;
}

function TreeItem({ node, depth, onSelect }: TreeItemProps) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const color = KIND_COLOR[node.kind] ?? '#94a3b8';
  const icon = KIND_ICON[node.kind] ?? '·';

  return (
    <div>
      <div
        className="flex items-center gap-1 py-[3px] rounded cursor-pointer hover:bg-white/5 group"
        style={{ paddingLeft: 6 + depth * 12, paddingRight: 6 }}
        onClick={() => {
          if (hasChildren) setOpen(o => !o);
          onSelect(node.id);
        }}
      >
        <span
          className="shrink-0 text-gray-700 transition-transform duration-150"
          style={{
            fontSize: 8,
            width: 10,
            display: 'inline-block',
            transform: open && hasChildren ? 'rotate(90deg)' : 'rotate(0deg)',
            opacity: hasChildren ? 1 : 0,
          }}
        >
          ▶
        </span>

        <span
          className="shrink-0"
          style={{
            fontSize: 9,
            color,
            fontFamily: '"JetBrains Mono", monospace',
            width: 13,
            textAlign: 'center',
          }}
        >
          {icon}
        </span>

        <span
          className="text-[11px] truncate group-hover:text-white transition-colors"
          style={{
            color: depth === 0 ? color : '#94a3b8',
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {node.label}
        </span>
      </div>

      {open && hasChildren && (
        <div
          style={{
            borderLeft: `1px solid #ffffff0a`,
            marginLeft: 6 + depth * 12 + 5,
          }}
        >
          {node.children.map(child => (
            <TreeItem key={child.id} node={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

interface TreePanelProps {
  apiNodes: RepoGraphNode[] | null;
  apiEdges: RepoGraphEdge[] | null;
  onFocusNode: (id: string) => void;
}

export default function TreePanel({ apiNodes, apiEdges, onFocusNode }: TreePanelProps) {
  const tree = useMemo<TreeNode[]>(() => {
    if (!apiNodes || !apiEdges) return [];

    const HIDDEN_KINDS = new Set(['external', 'method']);
    const visibleNodes = apiNodes.filter(n => !HIDDEN_KINDS.has(n.kind));
    const nodeMap = new Map(visibleNodes.map(n => [n.id, n]));
    const childIds = new Map<string, string[]>();
    const hasParent = new Set<string>();

    for (const e of apiEdges) {
      if (e.kind === 'contains') {
        if (!childIds.has(e.source)) childIds.set(e.source, []);
        childIds.get(e.source)!.push(e.target);
        hasParent.add(e.target);
      }
    }

    function buildNode(id: string): TreeNode {
      const n = nodeMap.get(id)!;
      return {
        id: n.id,
        label: n.label,
        kind: n.kind,
        children: (childIds.get(id) ?? [])
          .filter(cid => nodeMap.has(cid))
          .map(cid => buildNode(cid)),
      };
    }

    return visibleNodes
      .filter(n => !hasParent.has(n.id))
      .map(n => buildNode(n.id));
  }, [apiNodes, apiEdges]);

  return (
    <div
      className="h-full flex flex-col bg-[#05070a] overflow-hidden"
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
    >
      <div className="px-3 py-2.5 border-b border-white/5 shrink-0">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest">Explorer</p>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1 scrollbar-thin">
        {tree.length === 0 ? (
          <p className="text-[10px] text-gray-700 text-center mt-8">No data</p>
        ) : (
          tree.map(node => (
            <TreeItem key={node.id} node={node} depth={0} onSelect={onFocusNode} />
          ))
        )}
      </div>
    </div>
  );
}
