'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import type { NodeInfo } from '@/public/components/GraphFlow';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'node-context';
  content: string;
  node?: NodeInfo;
  isStreaming?: boolean;
}

const KIND_COLOR: Record<string, string> = {
  abstract:  '#00e5ff',
  concrete:  '#3b82f6',
  interface: '#a855f7',
  mixin:     '#f59e0b',
};

const QUICK_QUESTIONS = [
  'What does this class do?',
  'Who extends this?',
  'What are the key methods?',
  'How is this used?',
];

interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string, contextNode: NodeInfo | null) => void;
}

export default function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lastContextNode = [...messages].reverse().find(m => m.role === 'node-context')?.node ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim()) return;
    onSend(text.trim(), lastContextNode);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="flex flex-col h-full bg-[#05070a]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Chat</p>
        {lastContextNode && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] font-mono" style={{ color: KIND_COLOR[lastContextNode.kind] }}>◉</span>
            <span className="text-xs text-gray-400">{lastContextNode.label} in context</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map(msg => {
          if (msg.role === 'node-context') {
            const node = msg.node!;
            const color = KIND_COLOR[node.kind] ?? '#00e5ff';
            return (
              <div
                key={msg.id}
                className="rounded-xl border px-4 py-3"
                style={{ borderColor: `${color}30`, background: `${color}08` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color }}>{node.kind}</span>
                  <span className="text-sm font-semibold" style={{ color }}>{node.label}</span>
                </div>
                {node.properties && node.properties.length > 0 && (
                  <div className="mb-2 text-[10px] font-mono text-gray-600">
                    {node.properties.map(p => <div key={p}>+ {p}</div>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {QUICK_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-[10px] text-gray-500 hover:text-white border border-white/8 hover:border-white/20 px-2.5 py-1 rounded-full transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[82%] bg-[#00e5ff]/10 border border-[#00e5ff]/20 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-[#e8eaf0] leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[90%] bg-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-300 leading-relaxed">
                {msg.content}
                {msg.isStreaming && (
                  <span className="inline-block w-0.5 h-3.5 bg-[#00e5ff] ml-0.5 animate-pulse rounded-sm align-middle" />
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/5 shrink-0">
        <div className="flex items-end gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/8 focus-within:border-[#00e5ff]/20 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the codebase…"
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-[#e8eaf0] placeholder:text-gray-700 px-3 py-2 max-h-36 leading-relaxed font-sans"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="shrink-0 mb-1 mr-1 p-2 rounded-lg bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="#00e5ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-700 mt-2 text-center">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
