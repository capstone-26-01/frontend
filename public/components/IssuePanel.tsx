'use client';

import { useState, useEffect } from 'react';
import { fetchIssues, type GithubIssue } from '@/lib/api';

export type { GithubIssue as Issue };

const STATUS_DOT: Record<string, string> = {
  open:   '#f87171',
  closed: '#4b5563',
};

interface IssuePanelProps {
  repoUrl: string;
  selectedIssueKey: string | null;
  onSelectIssue: (issue: GithubIssue | null) => void;
}

export default function IssuePanel({ repoUrl, selectedIssueKey, onSelectIssue }: IssuePanelProps) {
  const [issues, setIssues] = useState<GithubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!repoUrl) return;
    setLoading(true);
    fetchIssues(repoUrl)
      .then(data => setIssues(data.issues))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [repoUrl]);

  const handleClick = (issue: GithubIssue) => {
    if (selectedIssueKey === issue.key) {
      onSelectIssue(null);
      setExpandedKey(null);
    } else {
      onSelectIssue(issue);
      setExpandedKey(issue.key);
    }
  };

  const openCount = issues.filter(i => i.state === 'open').length;

  return (
    <div
      className="h-full flex flex-col bg-[#05070a] overflow-hidden"
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/5 shrink-0 flex items-center justify-between">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest">Issues</p>
        <span className="text-[9px] text-gray-700 bg-white/5 px-2 py-0.5 rounded-full">
          {loading ? '…' : `${openCount} open`}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1.5 px-2 space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div style={{
              width: 20, height: 20,
              border: '2px solid #00e5ff33',
              borderTopColor: '#00e5ff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && issues.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <span className="text-[10px] text-gray-700">No issues found</span>
          </div>
        )}

        {!loading && issues.map(issue => {
          const accentColor = issue.labels[0] ? `#${issue.labels[0].color}` : '#6b7280';
          const isSelected = selectedIssueKey === issue.key;
          const isExpanded = expandedKey === issue.key;

          return (
            <div
              key={issue.key}
              onClick={() => handleClick(issue)}
              className="rounded-lg cursor-pointer transition-all duration-150 overflow-hidden"
              style={{
                background: isSelected ? '#0d1018' : '#0b0d1400',
                border: `1px solid ${isSelected ? accentColor + '66' : '#ffffff08'}`,
                boxShadow: isSelected ? `0 0 14px ${accentColor}22` : 'none',
              }}
            >
              <div className="px-2.5 py-2">
                {/* Title row */}
                <div className="flex items-start gap-1.5 mb-1.5">
                  <span className="text-[9px] text-gray-700 shrink-0 mt-[1px]">#{issue.number}</span>
                  {issue.locked && (
                    <span className="text-[9px] text-gray-600 shrink-0 mt-[1px]">🔒</span>
                  )}
                  <span
                    className="text-[10px] leading-snug"
                    style={{ color: isSelected ? '#e8eaf0' : '#7a8a9e' }}
                  >
                    {issue.title}
                  </span>
                </div>

                {/* Tags row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {issue.labels.slice(0, 2).map(label => (
                    <span
                      key={label.name}
                      className="text-[8px] font-bold uppercase px-1.5 py-px rounded"
                      style={{
                        background: `#${label.color}18`,
                        color: `#${label.color}`,
                        border: `1px solid #${label.color}44`,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                  <span className="text-[8px]" style={{ color: STATUS_DOT[issue.state] ?? '#6b7280' }}>
                    ● {issue.state}
                  </span>
                  {issue.comments_count > 0 && (
                    <span className="text-[8px] text-gray-700 ml-auto">
                      {issue.comments_count}💬
                    </span>
                  )}
                </div>

                {/* Expanded description */}
                {isExpanded && issue.body_excerpt && (
                  <p className="text-[9px] text-gray-600 mt-2 leading-relaxed border-t border-white/5 pt-2">
                    {issue.body_excerpt}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      {selectedIssueKey && (
        <div className="px-3 py-2 border-t border-white/5 shrink-0">
          <p className="text-[9px] text-gray-700 text-center">
            Click again to deselect
          </p>
        </div>
      )}
    </div>
  );
}
