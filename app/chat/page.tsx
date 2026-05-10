'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import GraphFlow from '@/public/components/GraphFlow';
import ChatPanel, { type Message } from '@/public/components/chat/ChatPanel';
import type { NodeInfo } from '@/public/components/GraphFlow';

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

function getMockResponse(node: NodeInfo): string {
  return MOCK_RESPONSES[node.id] ?? `\`${node.label}\` is a **${node.kind}** with ${node.methods.length} method(s). Try asking something specific!`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'init',
    role: 'assistant',
    content: 'Graph loaded. Click any node on the left to explore it, or ask me anything about this codebase.',
  }]);

  const handleNodeSelect = useCallback((node: NodeInfo) => {
    setMessages(prev => [...prev, {
      id: `ctx-${Date.now()}`,
      role: 'node-context',
      content: '',
      node,
    }]);
  }, []);

  const handleSend = useCallback((text: string, contextNode: NodeInfo | null) => {
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantId = `a-${Date.now() + 1}`;
    const streamingMsg: Message = { id: assistantId, role: 'assistant', content: '', isStreaming: true };

    setMessages(prev => [...prev, userMsg, streamingMsg]);

    const full = contextNode
      ? getMockResponse(contextNode)
      : 'Try clicking a node on the graph first — then I can give you context-aware answers about it!';

    let i = 0;
    const interval = setInterval(() => {
      i += 4;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: full.slice(0, i), isStreaming: i < full.length }
          : m
      ));
      if (i >= full.length) clearInterval(interval);
    }, 18);
  }, []);

  return (
    <div className="h-screen bg-[#05070a] text-[#e8eaf0] flex flex-col overflow-hidden">
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
        </div>
        <span className="text-[10px] font-mono text-gray-700 uppercase tracking-widest">GitStarter · Chat</span>
      </header>

      {/* Split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Graph */}
        <div className="flex-1 overflow-hidden border-r border-white/5">
          <GraphFlow onNodeSelect={handleNodeSelect} />
        </div>

        {/* Right: Chat */}
        <div className="w-[380px] shrink-0 overflow-hidden">
          <ChatPanel messages={messages} onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
