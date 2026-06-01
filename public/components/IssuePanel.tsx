'use client';

import { useState, useEffect } from 'react';
import { fetchIssues, type GithubIssue } from '@/lib/api';

export type { GithubIssue as Issue };

const OPEN_COLOR = '#00e5ff';
const CLOSED_COLOR = '#8b95a5';

function relativeTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function OpenIssueIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={color} aria-hidden>
      <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      <path fillRule="evenodd" d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z" />
    </svg>
  );
}

function ClosedIssueIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={color} aria-hidden>
      <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z" />
      <path fillRule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 4a4 4 0 0 1 8 0v2h.25A1.75 1.75 0 0 1 14 7.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm6.5 2V4a2.5 2.5 0 1 0-5 0v2Z" />
    </svg>
  );
}

function Avatar({ login, url }: { login: string; url?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={login} className="w-4 h-4 rounded-full shrink-0" />;
  }
  return (
    <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold text-gray-300 bg-white/10">
      {login.charAt(0).toUpperCase()}
    </span>
  );
}

interface IssuePanelProps {
  repoUrl: string;
  selectedIssueKey: string | null;
  onSelectIssue: (issue: GithubIssue | null) => void;
}

export default function IssuePanel({ repoUrl, selectedIssueKey, onSelectIssue }: IssuePanelProps) {
  const [issues, setIssues] = useState<GithubIssue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!repoUrl) return;
    setLoading(true);
    fetchIssues(repoUrl)
      .then(data => setIssues(data.issues))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [repoUrl]);

  const handleClick = (issue: GithubIssue) => {
    onSelectIssue(selectedIssueKey === issue.key ? null : issue);
  };

  const openCount = issues.filter(i => i.state === 'open').length;

  return (
    <div className="h-full flex flex-col bg-[#0a0c10] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/10 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-100 tracking-wide">Issues</h2>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${OPEN_COLOR}1f`, color: OPEN_COLOR, border: `1px solid ${OPEN_COLOR}40` }}
        >
          {loading ? '…' : `${openCount} open`}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div style={{
              width: 22, height: 22,
              border: '2px solid #00e5ff33',
              borderTopColor: '#00e5ff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && issues.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-gray-500">No issues found</span>
          </div>
        )}

        {!loading && issues.map(issue => {
          const isSelected = selectedIssueKey === issue.key;
          const isOpen = issue.state === 'open';
          const stateColor = isOpen ? OPEN_COLOR : CLOSED_COLOR;
          const extraLabels = issue.labels.length - 3;
          const author = issue.author;
          const ago = relativeTime(issue.updated_at || issue.created_at);

          return (
            <button
              key={issue.key}
              onClick={() => handleClick(issue)}
              className="w-full text-left px-4 py-3.5 border-b border-white/[0.07] transition-colors block"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderLeft: `3px solid ${isSelected ? stateColor : 'transparent'}`,
                paddingLeft: isSelected ? 13 : 16,
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Top row: state + number */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: stateColor }}>
                  {isOpen ? <OpenIssueIcon color={stateColor} /> : <ClosedIssueIcon color={stateColor} />}
                  {issue.state}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  {issue.locked && <LockIcon />}
                  #{issue.number}
                </span>
              </div>

              {/* Title — always shown in full */}
              <p
                className="text-sm font-medium leading-snug wrap-break-word"
                style={{ color: isSelected ? '#f0f3f8' : '#dbe2ea' }}
              >
                {issue.title}
              </p>

              {/* Labels */}
              {issue.labels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {issue.labels.slice(0, 3).map(label => (
                    <span
                      key={label.name}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: `#${label.color}1f`,
                        border: `1px solid #${label.color}44`,
                        color: '#d6dde5',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `#${label.color}` }} />
                      {label.name}
                    </span>
                  ))}
                  {extraLabels > 0 && (
                    <span className="text-[11px] text-gray-500 font-medium">+{extraLabels}</span>
                  )}
                </div>
              )}

              {/* Footer: author · time · comments */}
              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                {author && <Avatar login={author.login} url={author.avatar_url} />}
                {author && <span className="text-gray-400 truncate max-w-22.5">{author.login}</span>}
                {ago && <span className="text-gray-600">· {ago}</span>}
                {issue.comments_count > 0 && (
                  <span className="flex items-center gap-1 ml-auto">
                    <CommentIcon />
                    {issue.comments_count}
                  </span>
                )}
              </div>

              {/* Body preview — always shown (2 lines), full when selected */}
              {issue.body_excerpt && (
                <p
                  className="text-xs text-gray-400 leading-relaxed wrap-break-word mt-2.5"
                  style={isSelected
                    ? { whiteSpace: 'pre-wrap' }
                    : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                >
                  {issue.body_excerpt}
                  {isSelected && issue.body_truncated && <span className="text-gray-600">…</span>}
                </p>
              )}

              {/* GitHub link (when selected) */}
              {isSelected && issue.html_url && (
                <a
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-[#00e5ff]/80 hover:text-[#00e5ff] transition-colors"
                >
                  {issue.body_truncated ? 'Read full issue on GitHub' : 'View on GitHub'}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 8L8 2M8 2H3.5M8 2v4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      {selectedIssueKey && (
        <div className="px-4 py-2.5 border-t border-white/10 shrink-0">
          <p className="text-xs text-gray-500 text-center">Click again to deselect</p>
        </div>
      )}
    </div>
  );
}
