'use client';

import { useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent, ChangeEvent } from 'react';
import type { NodeInfo } from '@/public/components/GraphFlow';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'node-context';
  content: string;
  node?: NodeInfo;
  isStreaming?: boolean;
  followUps?: string[];
  citations?: string[];
}

export type NodeMapEntry = { label: string; id: string; kind: string };

const KIND_COLOR: Record<string, string> = {
  abstract:  '#00e5ff',
  concrete:  '#3b82f6',
  interface: '#a855f7',
  mixin:     '#f59e0b',
};

const DEFAULT_NODE_MAP: NodeMapEntry[] = [];

type TextPart = { type: 'text'; content: string } | { type: 'node'; label: string; id: string; kind: string };

function parseContent(text: string, nodeMap: NodeMapEntry[], pattern: RegExp): TextPart[] {
  if (!nodeMap.length) return [{ type: 'text', content: text }];
  const parts: TextPart[] = [];
  let last = 0;
  const re = new RegExp(pattern.source, pattern.flags);
  re.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', content: text.slice(last, match.index) });
    const label = match[1] ?? match[2];
    const node = nodeMap.find(n => n.label === label);
    if (node) parts.push({ type: 'node', label, id: node.id, kind: node.kind });
    else parts.push({ type: 'text', content: match[0] });
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
  nodeMap?: NodeMapEntry[];
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

export default function ChatPanel({ messages, onSend, onClear, onFocusNode, nodeMap }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const effectiveNodeMap = nodeMap?.length ? nodeMap : DEFAULT_NODE_MAP;
  const nodePattern = useMemo(() => {
    if (!effectiveNodeMap.length) return /(?!)/g;
    const labels = effectiveNodeMap.map(n => n.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(
      `\`(${labels.join('|')})\`|(${labels.join('|')})(?=[\\s.,;:!?)\\]|]|$)`,
      'g'
    );
  }, [effectiveNodeMap]);

  const doParse = useCallback(
    (text: string) => parseContent(text, effectiveNodeMap, nodePattern),
    [effectiveNodeMap, nodePattern]
  );

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
      <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Chat</p>
          {lastContextNode && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[lastContextNode.kind] ?? '#00e5ff' }} />
              <span className="text-xs text-gray-400">
                <span className="font-mono" style={{ color: KIND_COLOR[lastContextNode.kind] ?? '#00e5ff' }}>{lastContextNode.label}</span> in context
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-xs font-mono text-gray-500 hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-white/5"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 flex flex-col gap-3">
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
                className="pl-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
                style={{ borderLeft: `2px solid ${color}`, background: `${color}0a` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color, background: `${color}1a` }}>{node.kind}</span>
                  <span className="text-sm font-semibold font-mono" style={{ color }}>{node.label}</span>
                </div>
                {node.properties && node.properties.length > 0 && (
                  <div className="mt-2 text-xs font-mono text-gray-400 space-y-0.5">
                    {node.properties.map(p => <div key={p}><span className="text-gray-600">+</span> {p}</div>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {QUICK_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/25 px-2.5 py-1 rounded transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          const isUser = msg.role === 'user';
          const roleColor = isUser ? '#00e5ff' : '#7ee787';
          const roleLabel = isUser ? 'USER' : 'ASSISTANT';

          return (
            <div key={msg.id} className="flex flex-col gap-2 group animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Role header */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em]" style={{ color: roleColor }}>
                  {roleLabel}
                </span>
                <div className="flex-1 h-px bg-white/8" />
                {!isUser && !msg.isStreaming && msg.content && <CopyButton text={msg.content} />}
              </div>

              {/* Content */}
              <div
                className="text-[13px] leading-relaxed pl-3 border-l"
                style={{ borderColor: `${roleColor}22`, color: isUser ? '#e8eaf0' : '#c9d1d9' }}
              >
                {doParse(msg.content).map((part, i) =>
                  part.type === 'text' ? (
                    <span key={i} className="whitespace-pre-wrap">{part.content}</span>
                  ) : (
                    <button
                      key={i}
                      onClick={() => onFocusNode(part.id)}
                      title={`Go to ${part.label}`}
                      className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded font-mono text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                      style={{
                        color: KIND_COLOR[part.kind] ?? '#00e5ff',
                        background: `${KIND_COLOR[part.kind] ?? '#00e5ff'}15`,
                        border: `1px solid ${KIND_COLOR[part.kind] ?? '#00e5ff'}30`,
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
                  <span className="inline-block w-0.5 h-3.5 bg-[#7ee787] ml-0.5 animate-pulse rounded-sm align-middle" />
                )}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/8">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">References</div>
                    <div className="flex flex-wrap gap-1">
                      {msg.citations.map(c => (
                        <span key={c} className="text-xs font-mono text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                          {c.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Follow-up suggestions */}
              {isLastAssistant && msg.followUps && msg.followUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-3">
                  {msg.followUps.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs text-[#00e5ff]/70 hover:text-[#00e5ff] border border-[#00e5ff]/20 hover:border-[#00e5ff]/40 px-2.5 py-1 rounded transition-all"
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
      <div className="px-4 py-4 border-t border-white/8 shrink-0">
        <div className="flex items-end gap-2 p-1 rounded-md bg-white/[0.03] border border-white/10 focus-within:border-[#00e5ff]/30 transition-colors">
          <span className="text-[#00e5ff]/60 font-mono text-sm pl-2 pb-2 select-none">›</span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response…' : 'Ask about the codebase…'}
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-[#e8eaf0] placeholder:text-gray-600 px-1 py-2 max-h-36 leading-relaxed font-sans disabled:cursor-wait"
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
        <p className="text-xs text-gray-500 mt-2 text-center">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
