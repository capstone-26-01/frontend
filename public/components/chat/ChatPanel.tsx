'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { FiUser, FiStar } from 'react-icons/fi';
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

type NodePart = { label: string; id: string; kind: string };

function findNode(token: string, nodeMap: NodeMapEntry[]): NodePart | null {
  const n = nodeMap.find(m => m.label === token || m.id === token || m.id.split('/').pop() === token);
  return n ? { label: n.label, id: n.id, kind: n.kind } : null;
}

function NodeChip({ part, onFocusNode }: { part: NodePart; onFocusNode: (id: string) => void }) {
  const color = KIND_COLOR[part.kind] ?? '#00e5ff';
  return (
    <button
      onClick={() => onFocusNode(part.id)}
      title={`Go to ${part.label}`}
      className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded font-mono text-xs font-semibold align-baseline transition-all hover:scale-105 active:scale-95"
      style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
    >
      {part.label}
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="opacity-60">
        <path d="M1 4h6M4 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// Inline markdown: **bold**, `code` (clickable when it matches a graph node)
function renderInline(text: string, nodeMap: NodeMapEntry[], onFocusNode: (id: string) => void, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(
        <strong key={`${kp}-b${i}`} style={{ color: '#e8eaf0', fontWeight: 700 }}>
          {renderInline(m[1], nodeMap, onFocusNode, `${kp}-b${i}`)}
        </strong>
      );
    } else {
      const code = m[2];
      const node = findNode(code, nodeMap);
      out.push(
        node
          ? <NodeChip key={`${kp}-n${i}`} part={node} onFocusNode={onFocusNode} />
          : <code key={`${kp}-c${i}`} className="font-mono text-xs px-1 py-0.5 rounded bg-white/10 text-[#c9d1d9]">{code}</code>
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Block-level markdown: headings, bullet lists, paragraphs
function MarkdownContent({ content, nodeMap, onFocusNode }: { content: string; nodeMap: NodeMapEntry[]; onFocusNode: (id: string) => void }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={`ul${blocks.length}`} className="list-disc pl-5 my-1.5 space-y-1">{list}</ul>);
      list = [];
    }
  };
  lines.forEach((line, idx) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    const heading = line.match(/^\s*(#{1,6})\s+(.*)/);
    if (bullet) {
      list.push(<li key={`li${idx}`}>{renderInline(bullet[1], nodeMap, onFocusNode, `li${idx}`)}</li>);
      return;
    }
    flush();
    if (heading) {
      blocks.push(<div key={`h${idx}`} className="font-semibold text-[#e8eaf0] mt-3 mb-1">{renderInline(heading[2], nodeMap, onFocusNode, `h${idx}`)}</div>);
    } else if (line.trim() === '') {
      if (blocks.length) blocks.push(<div key={`sp${idx}`} className="h-2" />);
    } else {
      blocks.push(<p key={`p${idx}`} className="my-1">{renderInline(line, nodeMap, onFocusNode, `p${idx}`)}</p>);
    }
  });
  flush();
  return <>{blocks}</>;
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
          const roleColor = isUser ? '#00e5ff' : '#818cf8';
          const roleLabel = isUser ? 'USER' : 'GITSTARTER';
          const RoleIcon = isUser ? FiUser : FiStar;

          return (
            <div key={msg.id} className="flex flex-col gap-2 group animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Role header */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.15em]" style={{ color: roleColor }}>
                  <RoleIcon size={12} />
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
                {isUser
                  ? <span className="whitespace-pre-wrap">{msg.content}</span>
                  : <MarkdownContent content={msg.content} nodeMap={effectiveNodeMap} onFocusNode={onFocusNode} />
                }
                {msg.isStreaming && (
                  <span className="inline-block w-0.5 h-3.5 bg-[#818cf8] ml-0.5 animate-pulse rounded-sm align-middle" />
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
