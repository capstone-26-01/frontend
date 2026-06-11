'use client';

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import GraphFlow from '@/public/components/GraphFlow';
import ChatPanel, { type Message, type NodeMapEntry } from '@/public/components/chat/ChatPanel';
import type { NodeInfo, GraphFlowHandle } from '@/public/components/GraphFlow';
import IssuePanel, { type Issue } from '@/public/components/IssuePanel';
import { fetchGraph, fetchNodeSummary, postQAStream, fetchIssueRelatedNodes, summaryText, type IssueRelatedNodeCandidate } from '@/lib/api';
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
  content: 'Graph loaded. Click any node to explore it, or ask me anything about this codebase.',
}];

const ISSUE_PANEL_WIDTH = 260;

const EXT_TECH: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  rs: 'Rust', py: 'Python', go: 'Go', java: 'Java', kt: 'Kotlin', rb: 'Ruby',
  php: 'PHP', cs: 'C#', cpp: 'C++', cc: 'C++', c: 'C', swift: 'Swift', scala: 'Scala',
  css: 'CSS', scss: 'SCSS', sass: 'SCSS', html: 'HTML', vue: 'Vue', svelte: 'Svelte',
};
const CONFIG_TECH: Array<[string, string]> = [
  ['package.json', 'Node.js'], ['cargo.toml', 'Cargo'], ['go.mod', 'Go modules'],
  ['requirements.txt', 'pip'], ['pyproject.toml', 'Python'], ['pom.xml', 'Maven'],
  ['build.gradle', 'Gradle'], ['gemfile', 'Bundler'], ['dockerfile', 'Docker'],
  ['vite.config', 'Vite'], ['next.config', 'Next.js'], ['webpack.config', 'webpack'],
  ['tailwind.config', 'Tailwind'],
];

/** Build a newcomer-friendly repo overview (markdown) from graph nodes. */
function buildOverview(repoName: string, nodes: RepoGraphNode[]): string {
  const extCount: Record<string, number> = {};
  const dirFiles: Record<string, number> = {};
  const labels = new Set<string>();
  let files = 0, dirs = 0;

  for (const n of nodes) {
    if (n.kind === 'directory') { dirs++; continue; }
    if (n.kind !== 'file') continue;
    files++;
    const label = n.label.toLowerCase();
    labels.add(label);
    const ext = label.includes('.') ? label.split('.').pop()! : '';
    if (EXT_TECH[ext]) extCount[EXT_TECH[ext]] = (extCount[EXT_TECH[ext]] ?? 0) + 1;
    const seg = n.id.split('/');
    const top = seg.length > 1 ? seg[0] : '(root)';
    dirFiles[top] = (dirFiles[top] ?? 0) + 1;
  }

  const langs = Object.entries(extCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  const tooling = CONFIG_TECH
    .filter(([f]) => [...labels].some(l => l === f || l.startsWith(f.replace('.config', '.config'))))
    .map(([, t]) => t);
  const tech = Array.from(new Set([...langs, ...tooling]));
  const topDirs = Object.entries(dirFiles).filter(([d]) => d !== '(root)').sort((a, b) => b[1] - a[1]).slice(0, 6);

  let md = `## 📦 ${repoName} — Overview\n\n`;
  if (tech.length) md += `**Tech stack:** ${tech.join(' · ')}\n\n`;
  md += `**Size:** ${files} files · ${dirs} folders\n\n`;
  if (topDirs.length) {
    md += `**Where the code lives:**\n`;
    for (const [d, c] of topDirs) md += `* \`${d}\` — ${c} files\n`;
    md += `\n`;
  }
  md += `Pick an issue on the left to see exactly which files you'd touch, or ask me anything about this codebase.`;
  return md;
}

function ChatContent() {
  const searchParams = useSearchParams();
  const analysisId = searchParams.get('analysis_id') ? Number(searchParams.get('analysis_id')) : null;
  const repoName = searchParams.get('repo') ?? '';
  const revision = searchParams.get('revision') ?? undefined;
  const repoUrl = searchParams.get('url') ?? (repoName ? `https://github.com/${repoName}` : '');

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [nodeTrail, setNodeTrail] = useState<NodeInfo[]>([]);

  // Panel states
  const [issueCollapsed, setIssueCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(380);

  // Issue selection
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueHighlightIds, setIssueHighlightIds] = useState<Set<string> | null>(null);
  const issueRequestIdRef = useRef(0);

  const fetchCandidateSummary = useCallback(async (
    candidate: IssueRelatedNodeCandidate,
    aId: number,
    isActive: () => boolean,
  ) => {
    if (!isActive()) return;

    const nodeInfo: NodeInfo = {
      id: candidate.node.id,
      label: candidate.node.label,
      kind: candidate.node.kind as NodeInfo['kind'],
      methods: [],
    };

    setMessages(prev => [...prev, {
      id: `ctx-issue-${candidate.node_id}-${Date.now()}`,
      role: 'node-context',
      content: '',
      node: nodeInfo,
    }]);

    const summaryId = `ns-issue-${candidate.node_id}-${Date.now()}`;
    setMessages(prev => [...prev, { id: summaryId, role: 'assistant', content: '', isStreaming: true }]);

    try {
      const summaryData = await fetchNodeSummary(aId, candidate.node_id);
      if (!isActive()) return;

      const summary = summaryText(summaryData.summary);
      setMessages(prev => prev.map(m =>
        m.id === summaryId ? { ...m, content: summary, isStreaming: false } : m
      ));
    } catch {
      if (!isActive()) return;

      setMessages(prev => prev.map(m =>
        m.id === summaryId
          ? { ...m, content: `\`${candidate.node.label}\` 요약을 불러올 수 없습니다.`, isStreaming: false }
          : m
      ));
    }
  }, []);

  const handleSelectIssue = useCallback(async (issue: Issue | null) => {
    const requestId = issueRequestIdRef.current + 1;
    issueRequestIdRef.current = requestId;
    const isActive = () => issueRequestIdRef.current === requestId;

    setSelectedIssue(issue);
    if (!issue || analysisId == null) {
      setIssueHighlightIds(null);
      setIssueCollapsed(false); // reopen issue list when deselected
      return;
    }

    // Selecting an issue: close the issue list, open the chat
    setIssueCollapsed(true);
    setChatCollapsed(false);

    try {
      const data = await fetchIssueRelatedNodes({ analysis_id: analysisId, issue_number: issue.number });
      if (!isActive()) return;

      setIssueHighlightIds(new Set(data.selected_node_ids));

      const candidates = data.candidates;
      if (candidates.length === 0) {
        setMessages(prev => [...prev, {
          id: `issue-none-${Date.now()}`,
          role: 'assistant',
          content: `## 🚀 Issue #${issue.number} — Start guide\n\n**${issue.title}**\n\nI couldn't pin this issue to specific files automatically. Try asking me where a feature mentioned in the issue lives.`,
        }]);
        return;
      }

      // 시작 가이드: 진입 파일 + 관련 파일
      const [entry, ...rest] = candidates;
      const relatedList = rest.slice(0, 5)
        .map(c => `* \`${c.node.path}\``)
        .join('\n');

      let guide = `## 🚀 Issue #${issue.number} — Start guide\n\n`;
      guide += `**${issue.title}**\n\n`;
      guide += `**Start here** (most relevant):\n* \`${entry.node.path}\`${entry.reason ? ` — ${entry.reason}` : ''}\n\n`;
      if (relatedList) guide += `**Also likely involved:**\n${relatedList}\n\n`;
      guide += `Below are summaries of the key files. Ask me "how would I fix this?" for a suggested approach.`;

      setMessages(prev => [...prev, {
        id: `issue-guide-${Date.now()}`,
        role: 'assistant',
        content: guide,
      }]);

      // 상위 3개 candidates에 대해 node-context + summary
      const top = candidates.slice(0, 3);
      for (const candidate of top) {
        if (!isActive()) return;
        await fetchCandidateSummary(candidate, analysisId, isActive);
      }
    } catch {
      if (!isActive()) return;

      setIssueHighlightIds(null);
    }
  }, [analysisId, fetchCandidateSummary]);

  // Graph data
  const [apiNodes, setApiNodes] = useState<RepoGraphNode[] | null>(null);
  const [apiEdges, setApiEdges] = useState<RepoGraphEdge[] | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const hasDragged = useRef(false);
  const graphRef = useRef<GraphFlowHandle>(null);
  const overviewKey = useRef<string | null>(null);
  const qaAbortRef = useRef<AbortController | null>(null);
  const qaRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      qaRequestIdRef.current += 1;
      qaAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!repoUrl) return;
    setGraphLoading(true);
    fetchGraph(repoUrl, revision)
      .then(data => {
        setApiNodes(data.nodes);
        setApiEdges(data.edges);
        // Auto-post a newcomer overview once per repo
        if (overviewKey.current !== repoUrl && data.nodes.length > 0) {
          overviewKey.current = repoUrl;
          const name = data.repo || repoName || repoUrl.replace('https://github.com/', '');
          setMessages(prev => [...prev, {
            id: `overview-${Date.now()}`,
            role: 'assistant',
            content: buildOverview(name, data.nodes),
          }]);
        }
      })
      .catch(() => {})
      .finally(() => setGraphLoading(false));
  }, [repoUrl, revision, repoName]);

  const nodeMapForChat = useMemo<NodeMapEntry[]>(
    () => (apiNodes ?? []).map(n => ({ label: n.label, id: n.id, kind: n.kind })),
    [apiNodes]
  );

  const handleFocusNode = useCallback((id: string) => {
    graphRef.current?.focusNode(id);
  }, []);

  // Chat panel drag resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      if (Math.abs(e.clientX - dragStartX.current) > 4) hasDragged.current = true;
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
    if (chatCollapsed) setChatCollapsed(false);

    const contextMessage: Message = {
      id: `ctx-${Date.now()}`,
      role: 'node-context',
      content: '',
      node,
    };
    setMessages(prev =>
      prev.at(-1)?.role === 'node-context'
        ? [...prev.slice(0, -1), contextMessage]
        : [...prev, contextMessage]
    );
  }, [chatCollapsed]);

  const handleSend = useCallback(async (text: string, contextNode: NodeInfo | null) => {
    qaAbortRef.current?.abort();
    const controller = new AbortController();
    const requestId = qaRequestIdRef.current + 1;
    qaRequestIdRef.current = requestId;
    qaAbortRef.current = controller;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantId = `a-${Date.now() + 1}`;
    const isActive = () => qaRequestIdRef.current === requestId && !controller.signal.aborted;

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', isStreaming: true }]);

    try {
      const data = await postQAStream(
        {
          repo_url: repoUrl,
          question: text,
          analysis_id: analysisId ?? undefined,
          selected_node_id: contextNode?.id,
          revision,
        },
        {
          signal: controller.signal,
          onToken: token => {
            if (!isActive()) return;
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: `${m.content}${token}` } : m
            ));
          },
        }
      );

      if (!isActive()) return;

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? {
              ...m,
              content: data.answer || m.content,
              isStreaming: false,
              followUps: contextNode ? (FOLLOW_UPS[contextNode.kind] ?? []) : [],
              citations: data.citations?.length ? data.citations : undefined,
            }
          : m
      ));
    } catch (error) {
      if (!isActive() || (error as Error).name === 'AbortError') return;

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Failed to get response. Please try again.', isStreaming: false }
          : m
      ));
    } finally {
      if (qaRequestIdRef.current === requestId) qaAbortRef.current = null;
    }
  }, [repoUrl, analysisId, revision]);

  const handleClear = useCallback(() => {
    qaRequestIdRef.current += 1;
    issueRequestIdRef.current += 1;
    qaAbortRef.current?.abort();
    qaAbortRef.current = null;
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

          {/* Active issue badge */}
          {selectedIssue && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-[#f87171] bg-[#ef444415] border border-[#ef444430] px-2 py-0.5 rounded-full">
                  Issue #{selectedIssue.number}
                </span>
                <span className="text-[10px] font-mono text-gray-600 max-w-[200px] truncate">
                  {selectedIssue.title}
                </span>
              </div>
            </>
          )}

          {/* Node trail */}
          {!selectedIssue && nodeTrail.length > 0 && (
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
        </div>
      </header>

      {/* Three-panel split view */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Issue Panel + handle strip */}
        <div className="flex shrink-0">
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ width: issueCollapsed ? 0 : ISSUE_PANEL_WIDTH }}
          >
            <IssuePanel
              repoUrl={repoUrl}
              selectedIssueKey={selectedIssue?.key ?? null}
              onSelectIssue={handleSelectIssue}
            />
          </div>

          {/* Left handle strip */}
          <button
            onClick={() => setIssueCollapsed(c => !c)}
            title={issueCollapsed ? 'Open Issues' : 'Close Issues'}
            className="w-7 shrink-0 flex flex-col items-center justify-center gap-3 group"
            style={{
              background: 'linear-gradient(180deg, #0d1424 0%, #0b1020 50%, #0d1424 100%)',
              borderRight: '1px solid rgba(255,255,255,0.10)',
              boxShadow: 'inset -1px 0 0 rgba(0,229,255,0.06)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, #101828 0%, #0e1526 50%, #101828 100%)';
              (e.currentTarget as HTMLElement).style.borderRight = '1px solid rgba(0,229,255,0.30)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'inset -1px 0 0 rgba(0,229,255,0.15), 0 0 12px rgba(0,229,255,0.06)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, #0d1424 0%, #0b1020 50%, #0d1424 100%)';
              (e.currentTarget as HTMLElement).style.borderRight = '1px solid rgba(255,255,255,0.10)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'inset -1px 0 0 rgba(0,229,255,0.06)';
            }}
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
              className="text-[#5a6e88] group-hover:text-[#a0b4cc] transition-colors duration-200">
              <path
                d={issueCollapsed ? 'M1 1l5 5-5 5' : 'M6 1L1 6l5 5'}
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            <div className="flex flex-col gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-white/25 group-hover:bg-white/55 transition-colors duration-200" />
                  <div className="w-1 h-1 rounded-full bg-white/25 group-hover:bg-white/55 transition-colors duration-200" />
                </div>
              ))}
            </div>
            <span style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: '"JetBrains Mono", monospace',
              userSelect: 'none',
            }}
              className="text-[#5a6e88] group-hover:text-[#a0b4cc] transition-colors duration-200"
            >
              Issues
            </span>
          </button>
        </div>

        {/* Center: Graph */}
        <div className="flex-1 overflow-hidden">
          <GraphFlow
            ref={graphRef}
            onNodeSelect={handleNodeSelect}
            apiNodes={apiNodes}
            apiEdges={apiEdges}
            loading={graphLoading}
            issueHighlightIds={issueHighlightIds}
          />
        </div>

        {/* Right: handle strip + Chat Panel */}
        <div className="flex shrink-0">
          {/* Right handle strip — click to toggle, drag to resize */}
          <button
            onMouseDown={(e) => {
              isDragging.current = true;
              dragStartX.current = e.clientX;
              hasDragged.current = false;
              e.preventDefault();
            }}
            onClick={() => {
              if (!hasDragged.current) setChatCollapsed(c => !c);
            }}
            title={chatCollapsed ? 'Open Chat' : 'Close Chat'}
            className="w-7 shrink-0 flex flex-col items-center justify-center gap-3 group"
            style={{
              background: 'linear-gradient(180deg, #0d1424 0%, #0b1020 50%, #0d1424 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.10)',
              boxShadow: 'inset 1px 0 0 rgba(0,229,255,0.06)',
              cursor: chatCollapsed ? 'pointer' : 'col-resize',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, #101828 0%, #0e1526 50%, #101828 100%)';
              (e.currentTarget as HTMLElement).style.borderLeft = '1px solid rgba(0,229,255,0.30)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'inset 1px 0 0 rgba(0,229,255,0.15), 0 0 12px rgba(0,229,255,0.06)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, #0d1424 0%, #0b1020 50%, #0d1424 100%)';
              (e.currentTarget as HTMLElement).style.borderLeft = '1px solid rgba(255,255,255,0.10)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'inset 1px 0 0 rgba(0,229,255,0.06)';
            }}
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
              className="text-[#5a6e88] group-hover:text-[#a0b4cc] transition-colors duration-200">
              <path
                d={chatCollapsed ? 'M6 1L1 6l5 5' : 'M1 1l5 5-5 5'}
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            <div className="flex flex-col gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-white/25 group-hover:bg-white/55 transition-colors duration-200" />
                  <div className="w-1 h-1 rounded-full bg-white/25 group-hover:bg-white/55 transition-colors duration-200" />
                </div>
              ))}
            </div>
            <span style={{
              writingMode: 'vertical-rl',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: '"JetBrains Mono", monospace',
              userSelect: 'none',
            }}
              className="text-[#5a6e88] group-hover:text-[#a0b4cc] transition-colors duration-200"
            >
              Chat
            </span>
          </button>

          <div
            className="overflow-hidden transition-all duration-300"
            style={{ width: chatCollapsed ? 0 : chatWidth }}
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
