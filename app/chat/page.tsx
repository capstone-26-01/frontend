'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import GraphFlow from '@/public/components/GraphFlow';
import ChatPanel, { type Message } from '@/public/components/chat/ChatPanel';
import type { NodeInfo, GraphFlowHandle } from '@/public/components/GraphFlow';

const MOCK_RESPONSES: Record<string, string> = {
  animal:    '`Animal` is the root abstract class. It defines the core contract—`speak()`, `move()`, `toString()`—that every concrete animal must implement. Nothing here is instantiable; it just sets the rules.',
  mammal:    '`Mammal` extends `Animal` and adds warm-blooded traits: a `furColor` property and `breathe()` / `nurse()` methods. Both `Dog` and `Dolphin` extend it.',
  bird:      '`Bird` extends `Animal` with a `wingspan` property and `layEgg()`. Eagle and Penguin are the two concrete birds—Eagle flies, Penguin doesn\'t, which is a classic Liskov Substitution edge case.',
  flyable:   '`IFlyable` is an interface that enforces `fly()` and `land()`. Both `Bird` and `Eagle` implement it, but `Penguin` does not—even though it\'s a bird.',
  swimmable: '`Swimmable` is a mixin that injects `swim()` and `dive()` behavior into `Dolphin` and `Penguin` via composition rather than inheritance.',
  dog:       '`Dog` is the simplest concrete leaf: it overrides `speak()` and adds `fetch()`. No extra complexity.',
  dolphin:   '`Dolphin` is a concrete `Mammal` that also mixes in `Swimmable`. The unique `echolocate()` method makes it behaviorally distinct from all other mammals.',
  eagle:     '`Eagle` is a concrete `Bird` that implements `IFlyable`. Its exclusive `hunt()` method and owned `territory` property make it the most specialized node in the graph.',
  penguin:   '`Penguin` is a concrete `Bird` that can\'t fly but mixes in `Swimmable`. It\'s the best example in this graph of why interface segregation beats a monolithic `Animal` interface.',
};

const FOLLOW_UPS: Record<string, string[]> = {
  abstract:  ['Which classes extend this?', 'What must subclasses implement?'],
  concrete:  ['What does this class inherit?', 'Are there similar classes?'],
  interface: ['Who implements this interface?', 'What methods does it enforce?'],
  mixin:     ['Which classes use this mixin?', 'Why mixin instead of inheritance?'],
};

function getMockResponse(node: NodeInfo): string {
  return MOCK_RESPONSES[node.id] ?? `\`${node.label}\` is a **${node.kind}** with ${node.methods.length} method(s). Try asking something specific!`;
}

const INITIAL_MESSAGES: Message[] = [{
  id: 'init',
  role: 'assistant',
  content: 'Graph loaded. Click any node on the left to explore it, or ask me anything about this codebase.',
}];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [nodeTrail, setNodeTrail] = useState<NodeInfo[]>([]);
  const [chatWidth, setChatWidth] = useState(380);
  const [collapsed, setCollapsed] = useState(false);

  const isDragging = useRef(false);
  const graphRef = useRef<GraphFlowHandle>(null);

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

  const handleNodeSelect = useCallback((node: NodeInfo) => {
    setNodeTrail(prev => [node, ...prev.filter(n => n.id !== node.id)].slice(0, 4));
    setMessages(prev => [...prev, {
      id: `ctx-${Date.now()}`,
      role: 'node-context',
      content: '',
      node,
    }]);
    if (collapsed) setCollapsed(false);
  }, [collapsed]);

  const handleSend = useCallback((text: string, contextNode: NodeInfo | null) => {
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantId = `a-${Date.now() + 1}`;
    const streamingMsg: Message = { id: assistantId, role: 'assistant', content: '', isStreaming: true };

    setMessages(prev => [...prev, userMsg, streamingMsg]);

    const full = contextNode
      ? getMockResponse(contextNode)
      : 'Try clicking a node on the graph first — then I can give you context-aware answers about it!';

    const followUps = contextNode ? (FOLLOW_UPS[contextNode.kind] ?? []) : [];

    let i = 0;
    const interval = setInterval(() => {
      i += 4;
      const done = i >= full.length;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: full.slice(0, i), isStreaming: !done, followUps: done ? followUps : undefined }
          : m
      ));
      if (done) clearInterval(interval);
    }, 18);
  }, []);

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
            <span className="text-xs font-mono text-white/60">facebook / react</span>
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
        {/* Left: Graph */}
        <div className="flex-1 overflow-hidden">
          <GraphFlow ref={graphRef} onNodeSelect={handleNodeSelect} />
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
          />
        </div>
      </div>
    </div>
  );
}
