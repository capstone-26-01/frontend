'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import type { NodeInfo } from '@/public/components/GraphFlow';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'node-context';
  content: string;
  node?: NodeInfo;
  isStreaming?: boolean;
  followUps?: string[];
}

const KIND_COLOR: Record<string, string> = {
  abstract:  '#00e5ff',
  concrete:  '#3b82f6',
  interface: '#a855f7',
  mixin:     '#f59e0b',
};

const NODE_MAP: { label: string; id: string; kind: string }[] = [
  { label: 'Animal',    id: 'animal',    kind: 'abstract' },
  { label: 'IFlyable',  id: 'flyable',   kind: 'interface' },
  { label: 'Swimmable', id: 'swimmable', kind: 'mixin' },
  { label: 'Mammal',    id: 'mammal',    kind: 'abstract' },
  { label: 'Bird',      id: 'bird',      kind: 'abstract' },
  { label: 'Dog',       id: 'dog',       kind: 'concrete' },
  { label: 'Dolphin',   id: 'dolphin',   kind: 'concrete' },
  { label: 'Eagle',     id: 'eagle',     kind: 'concrete' },
  { label: 'Penguin',   id: 'penguin',   kind: 'concrete' },
];

const NODE_PATTERN = new RegExp(
  `\`(${NODE_MAP.map(n => n.label).join('|')})\`|(${NODE_MAP.map(n => n.label).join('|')})(?=[\\s.,;:!?)\\]|]|$)`,
  'g'
);

type TextPart = { type: 'text'; content: string } | { type: 'node'; label: string; id: string; kind: string };

function parseContent(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  NODE_PATTERN.lastIndex = 0;

  while ((match = NODE_PATTERN.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', content: text.slice(last, match.index) });
    const label = match[1] ?? match[2];
    const node = NODE_MAP.find(n => n.label === label)!;
    parts.push({ type: 'node', label, id: node.id, kind: node.kind });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });
  return parts;
}

const QUICK_QUESTIONS = [
  'What does this class do?',
  'Who extends this?',
  'What are the key methods?',
  'How is this used?',
];

interface ChatPanelProps {
  messages: Message[];
  onSend: (text: string, contextNode: NodeInfo | null) => void;
  onClear: () => void;
  onFocusNode: (id: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-600 hover:text-gray-300"
      title="Copy"
    >
      {copied
        ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6l3 3 7-7" stroke="#00e5ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="1" width="7" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M1 4v7h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
      }
    </button>
  );
}

export default function ChatPanel({ messages, onSend, onClear, onFocusNode }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lastContextNode = [...messages].reverse().find(m => m.role === 'node-context')?.node ?? null;
  const isStreaming = messages.some(m => m.isStreaming);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim() || isStreaming) return;
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
    <div className="flex flex-col h-full bg-[#05070a] select-text">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 shrink-0 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Chat</p>
          {lastContextNode && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] font-mono" style={{ color: KIND_COLOR[lastContextNode.kind] }}>◉</span>
              <span className="text-xs text-gray-400">{lastContextNode.label} in context</span>
            </div>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-[10px] font-mono text-gray-700 hover:text-gray-400 transition-colors px-2 py-1 rounded hover:bg-white/5"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((msg, idx) => {
          const isLastAssistant =
            msg.role === 'assistant' &&
            !msg.isStreaming &&
            [...messages].slice(idx + 1).every(m => m.role !== 'assistant');

          if (msg.role === 'node-context') {
            const node = msg.node!;
            const color = KIND_COLOR[node.kind] ?? '#00e5ff';
            return (
              <div
                key={msg.id}
                className="rounded-xl border px-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
                style={{ borderColor: `${color}30`, background: `${color}08` }}
              >
                <div className="flex items-center gap-2 mb-1">
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
              <div key={msg.id} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="max-w-[82%] bg-[#00e5ff]/10 border border-[#00e5ff]/20 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-[#e8eaf0] leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex justify-start group">
                <div className="max-w-[90%] bg-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-300 leading-relaxed relative">
                  {parseContent(msg.content).map((part, i) =>
                    part.type === 'text' ? (
                      <span key={i}>{part.content}</span>
                    ) : (
                      <button
                        key={i}
                        onClick={() => onFocusNode(part.id)}
                        title={`Go to ${part.label}`}
                        className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded font-mono text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                        style={{
                          color: KIND_COLOR[part.kind],
                          background: `${KIND_COLOR[part.kind]}15`,
                          border: `1px solid ${KIND_COLOR[part.kind]}30`,
                        }}
                      >
                        {part.label}
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="opacity-60">
                          <path d="M1 4h6M4 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )
                  )}
                  {msg.isStreaming && (
                    <span className="inline-block w-0.5 h-3.5 bg-[#00e5ff] ml-0.5 animate-pulse rounded-sm align-middle" />
                  )}
                  {!msg.isStreaming && msg.content && (
                    <div className="absolute -top-2 -right-2">
                      <CopyButton text={msg.content} />
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up suggestions */}
              {isLastAssistant && msg.followUps && msg.followUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {msg.followUps.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-[10px] text-[#00e5ff]/60 hover:text-[#00e5ff] border border-[#00e5ff]/15 hover:border-[#00e5ff]/40 px-2.5 py-1 rounded-full transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
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
            placeholder={isStreaming ? 'Waiting for response…' : 'Ask about the codebase…'}
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-[#e8eaf0] placeholder:text-gray-700 px-3 py-2 max-h-36 leading-relaxed font-sans disabled:cursor-wait"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
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
