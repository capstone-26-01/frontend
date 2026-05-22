'use client';

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import GraphFlow from '@/public/components/GraphFlow';
import ChatPanel, { type Message, type NodeMapEntry } from '@/public/components/chat/ChatPanel';
import type { NodeInfo, GraphFlowHandle } from '@/public/components/GraphFlow';
import TreePanel from '@/public/components/TreePanel';
import { fetchGraph, fetchNodeSummary, postQA } from '@/lib/api';
import type { RepoGraphNode, RepoGraphEdge } from '@/lib/api';

const FOLLOW_UPS: Record<string, string[]> = {
  abstract:  ['Which classes extend this?', 'What must subclasses implement?'],
  concrete:  ['What does this class inherit?', 'Are there similar classes?'],
  interface: ['Who implements this interface?', 'What methods does it enforce?'],
  mixin:     ['Which classes use this mixin?', 'Why mixin instead of inheritance?'],
};

const INITIAL_MESSAGES: Message[] = [{
  id: 'init',
  role: 'assistant',
  content: 'Graph loaded. Click any node on the left to explore it, or ask me anything about this codebase.',
}];

function ChatContent() {
  const searchParams = useSearchParams();
  const analysisId = searchParams.get('analysis_id') ? Number(searchParams.get('analysis_id')) : null;
  const repoName = searchParams.get('repo') ?? '';
  const revision = searchParams.get('revision') ?? undefined;
  const repoUrl = searchParams.get('url') ?? (repoName ? `https://github.com/${repoName}` : '');

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [nodeTrail, setNodeTrail] = useState<NodeInfo[]>([]);
  const [chatWidth, setChatWidth] = useState(380);
  const [collapsed, setCollapsed] = useState(false);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const TREE_WIDTH = 220;

  const [apiNodes, setApiNodes] = useState<RepoGraphNode[] | null>(null);
  const [apiEdges, setApiEdges] = useState<RepoGraphEdge[] | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  const isDragging = useRef(false);
  const graphRef = useRef<GraphFlowHandle>(null);

  // Load graph data
  useEffect(() => {
    if (!repoUrl) return;
    setGraphLoading(true);
    fetchGraph(repoUrl, revision)
      .then(data => {
        setApiNodes(data.nodes);
        setApiEdges(data.edges);
      })
      .catch(() => {
        // keep showing mock graph on error
      })
      .finally(() => setGraphLoading(false));
  }, [repoUrl, revision]);

  const nodeMapForChat = useMemo<NodeMapEntry[]>(
    () => (apiNodes ?? []).map(n => ({ label: n.label, id: n.id, kind: n.kind })),
    [apiNodes]
  );

  const handleFocusNode = useCallback((id: string) => {
    graphRef.current?.focusNode(id);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setChatWidth(Math.max(300, Math.min(newWidth, window.innerWidth * 0.6)));
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleNodeSelect = useCallback(async (node: NodeInfo) => {
    setNodeTrail(prev => [node, ...prev.filter(n => n.id !== node.id)].slice(0, 4));
    if (collapsed) setCollapsed(false);

    setMessages(prev => [...prev, {
      id: `ctx-${Date.now()}`,
      role: 'node-context',
      content: '',
      node,
    }]);

    if (analysisId == null) return;

    const assistantId = `ns-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', isStreaming: true }]);

    try {
      const data = await fetchNodeSummary(analysisId, node.id);
      const summary = typeof data.summary === 'string' ? data.summary : JSON.stringify(data.summary, null, 2);
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: summary, isStreaming: false, followUps: FOLLOW_UPS[node.kind] ?? [] }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `No summary available for \`${node.label}\`.`, isStreaming: false }
          : m
      ));
    }
  }, [analysisId, collapsed]);

  const handleSend = useCallback(async (text: string, contextNode: NodeInfo | null) => {
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantId = `a-${Date.now() + 1}`;

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', isStreaming: true }]);

    try {
      const data = await postQA({
        repo_url: repoUrl,
        question: text,
        analysis_id: analysisId ?? undefined,
        selected_node_id: contextNode?.id,
        revision,
      });

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? {
              ...m,
              content: data.answer,
              isStreaming: false,
              followUps: contextNode ? (FOLLOW_UPS[contextNode.kind] ?? []) : [],
              citations: data.citations?.length ? data.citations : undefined,
            }
          : m
      ));
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Failed to get response. Please try again.', isStreaming: false }
          : m
      ));
    }
  }, [repoUrl, analysisId, revision]);

  const handleClear = useCallback(() => {
    setMessages(INITIAL_MESSAGES);
    setNodeTrail([]);
  }, []);

  return (
    <div className="h-screen bg-[#05070a] text-[#e8eaf0] flex flex-col overflow-hidden select-none">
      {/* Top bar */}
      <header className="h-12 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-gray-600 hover:text-white transition-colors text-xs"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="5" r="3" fill="#00e5ff" />
              <circle cx="4" cy="17" r="2.5" fill="#00e5ff" fillOpacity="0.55" />
              <circle cx="18" cy="17" r="2.5" fill="#00e5ff" fillOpacity="0.55" />
              <line x1="11" y1="8" x2="4.5" y2="14.5" stroke="#00e5ff" strokeWidth="1.2" strokeOpacity="0.35" />
              <line x1="11" y1="8" x2="17.5" y2="14.5" stroke="#00e5ff" strokeWidth="1.2" strokeOpacity="0.35" />
            </svg>
            <span className="text-xs font-mono text-white/60">{repoName || 'unknown / repo'}</span>
          </div>

          {/* Node trail */}
          {nodeTrail.length > 0 && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-1">
                {nodeTrail.map((n, i) => (
                  <span key={n.id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-700 text-[10px]">←</span>}
                    <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                      {n.label}
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-gray-700 uppercase tracking-widest">GitStarter · Chat</span>
          <button
            onClick={() => setTreeCollapsed(c => !c)}
            title={treeCollapsed ? 'Show explorer' : 'Hide explorer'}
            className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 2h4M1 7h6M1 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              {treeCollapsed && <path d="M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand chat' : 'Collapse chat'}
            className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {collapsed
                ? <path d="M9 1H13V5M5 13H1V9M13 1L8 6M1 13L6 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                : <path d="M1 5V1H5M9 13H13V9M1 1L6 6M13 13L8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              }
            </svg>
          </button>
        </div>
      </header>

      {/* Split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tree Explorer */}
        <div
          className="shrink-0 overflow-hidden transition-all duration-300 border-r border-white/5"
          style={{ width: treeCollapsed ? 0 : TREE_WIDTH }}
        >
          <TreePanel
            apiNodes={apiNodes}
            apiEdges={apiEdges}
            onFocusNode={handleFocusNode}
          />
        </div>

        {/* Center: Graph */}
        <div className="flex-1 overflow-hidden">
          <GraphFlow
            ref={graphRef}
            onNodeSelect={handleNodeSelect}
            apiNodes={apiNodes}
            apiEdges={apiEdges}
            loading={graphLoading}
          />
        </div>

        {/* Draggable divider */}
        {!collapsed && (
          <div
            onMouseDown={(e) => { isDragging.current = true; e.preventDefault(); }}
            className="w-1 shrink-0 cursor-col-resize border-l border-white/5 hover:border-[#00e5ff]/30 hover:bg-[#00e5ff]/5 transition-colors"
          />
        )}

        {/* Right: Chat */}
        <div
          className="shrink-0 overflow-hidden transition-all duration-300"
          style={{ width: collapsed ? 0 : chatWidth }}
        >
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            onClear={handleClear}
            onFocusNode={handleFocusNode}
            nodeMap={nodeMapForChat}
          />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#05070a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div style={{
            width: 32, height: 32,
            border: '2px solid #00e5ff33',
            borderTopColor: '#00e5ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span className="text-xs font-mono text-[#00e5ff88]">Loading…</span>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
