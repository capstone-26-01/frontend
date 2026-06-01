export type NodeKind = 'abstract' | 'concrete' | 'interface' | 'mixin';

export interface AnalysisResponse {
  analysis_id: number | null;
  repo: string;
  revision: string;
  status: string;
  artifact: unknown;
  warnings: unknown;
}

export interface RepoGraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  methods: string[];
  properties?: string[];
}

export interface RepoGraphEdge {
  id?: string;
  source: string;
  target: string;
  kind: 'extends' | 'implements' | 'mixin' | 'contains' | 'imports' | 'calls' | 'inherits' | 'entrypoint' | string;
}

export interface RepoGraphResponse {
  analysis_id: number | null;
  repo: string;
  revision: string;
  nodes: RepoGraphNode[];
  edges: RepoGraphEdge[];
  entrypoints: unknown;
  key_modules: unknown;
  warnings: unknown;
}

export interface AnalysisByIdResponse {
  analysis_id: number;
  repo: string;
  revision: string;
  status: string;
  artifact: unknown;
  warnings: unknown;
  error: unknown;
}

export interface GraphDiffResponse {
  repo: string;
  base: unknown;
  head: unknown;
  diff: unknown;
  warnings: unknown;
}

export interface RepoTreeResponse {
  analysis_id: number | null;
  repo: string;
  revision: string;
  tree: unknown;
  warnings: unknown;
}

export interface RepoFilesResponse {
  repo: string;
  files: string[];
}

export interface ShareCreateRequest {
  repo_url: string;
  mode?: 'fixed' | 'latest';
  revision?: string;
  title?: string;
  expires_at?: string | null;
}

export interface ShareResponse {
  share_id: string;
  mode: string;
  title: string;
  repo: string;
  repository: unknown;
  ref: string;
  revision: string;
  analysis_id: number;
  graph: unknown;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  warnings: unknown;
  urls: unknown;
  snippets: unknown;
}

export interface NodeSummary {
  kind?: string;
  prompt_version?: string;
  model?: Record<string, string>;
  target_id?: string;
  text: string;
  source_nodes?: string[];
  source_files?: string[];
  warnings?: unknown[];
}

export interface SummaryResponse {
  analysis_id: number;
  repo: string;
  revision: string;
  summary: string | NodeSummary;
  cached: boolean;
}

/** node-summary 응답의 summary는 문자열이거나 { text, ... } 객체 — 본문 텍스트만 추출 */
export function summaryText(summary: string | NodeSummary | unknown): string {
  if (typeof summary === 'string') return summary;
  if (summary && typeof summary === 'object' && typeof (summary as NodeSummary).text === 'string') {
    return (summary as NodeSummary).text;
  }
  return '';
}

export interface QARequest {
  repo_url: string;
  question: string;
  revision?: string;
  analysis_id?: number;
  selected_node_id?: string;
  selected_file_path?: string;
  max_context_files?: number;
}

export interface QAResponse {
  answer: string;
  citations: string[];
  selected_nodes: string[];
  context_files: string[];
  context_summary: unknown;
  tool_trace: unknown;
  warnings: unknown;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://gitstarter.kro.kr';

export function toGithubUrl(input: string): string {
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  return `https://github.com/${input}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchAnalysis(repoInput: string, revision?: string): Promise<AnalysisResponse> {
  const url = toGithubUrl(repoInput);
  const params = new URLSearchParams({ url });
  if (revision) params.set('revision', revision);
  return apiFetch<AnalysisResponse>(`/api/analysis/?${params}`);
}

export async function fetchGraph(repoInput: string, revision?: string): Promise<RepoGraphResponse> {
  const url = toGithubUrl(repoInput);
  const params = new URLSearchParams({ url });
  if (revision) params.set('revision', revision);
  return apiFetch<RepoGraphResponse>(`/api/graph/?${params}`);
}

export async function fetchNodeSummary(analysisId: number, nodeId: string): Promise<SummaryResponse> {
  const params = new URLSearchParams({ analysis_id: String(analysisId), node_id: nodeId });
  return apiFetch<SummaryResponse>(`/api/node-summary/?${params}`);
}

export async function postQA(req: QARequest): Promise<QAResponse> {
  return apiFetch<QAResponse>('/api/qa/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, repo_url: toGithubUrl(req.repo_url) }),
  });
}

export async function postAnalysis(repoUrl: string, revision?: string): Promise<AnalysisResponse> {
  return apiFetch<AnalysisResponse>('/api/analysis/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: toGithubUrl(repoUrl), ...(revision ? { revision } : {}) }),
  });
}

export async function fetchAnalysisById(analysisId: number): Promise<AnalysisByIdResponse> {
  return apiFetch<AnalysisByIdResponse>(`/api/analysis/${analysisId}/`);
}

export async function fetchAnalysisDiff(analysisId: number, base: number): Promise<GraphDiffResponse> {
  const params = new URLSearchParams({ base: String(base) });
  return apiFetch<GraphDiffResponse>(`/api/analysis/${analysisId}/diff/?${params}`);
}

export async function fetchDiffByRevision(repoInput: string, base: string, head?: string): Promise<GraphDiffResponse> {
  const url = toGithubUrl(repoInput);
  const params = new URLSearchParams({ url, base });
  if (head) params.set('head', head);
  return apiFetch<GraphDiffResponse>(`/api/diff/?${params}`);
}

export async function fetchEmbed(shareId: string): Promise<string> {
  return apiFetch<string>(`/api/embed/${shareId}/`);
}

export async function fetchSummary(analysisId: number, kind?: 'repo_overview' | 'onboarding_guide'): Promise<SummaryResponse> {
  const params = new URLSearchParams({ analysis_id: String(analysisId) });
  if (kind) params.set('kind', kind);
  return apiFetch<SummaryResponse>(`/api/summary/?${params}`);
}

export async function fetchTree(repoInput: string, revision?: string): Promise<RepoTreeResponse> {
  const url = toGithubUrl(repoInput);
  const params = new URLSearchParams({ url });
  if (revision) params.set('revision', revision);
  return apiFetch<RepoTreeResponse>(`/api/tree/?${params}`);
}

export async function fetchRepo(repoInput: string): Promise<RepoFilesResponse> {
  const url = toGithubUrl(repoInput);
  const params = new URLSearchParams({ url });
  return apiFetch<RepoFilesResponse>(`/api/repo/?${params}`);
}

export async function createShare(req: ShareCreateRequest): Promise<ShareResponse> {
  return apiFetch<ShareResponse>('/api/share/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, repo_url: toGithubUrl(req.repo_url) }),
  });
}

export async function fetchShare(shareId: string): Promise<ShareResponse> {
  return apiFetch<ShareResponse>(`/api/share/${shareId}/`);
}

export interface IssueAuthor {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface IssueLabel {
  name: string;
  color: string;
  description: string;
}

export interface GithubIssue {
  key: string;
  number: number;
  title: string;
  state: string;
  html_url: string;
  author: IssueAuthor | null;
  labels: IssueLabel[];
  assignees: IssueAuthor[];
  comments_count: number;
  created_at: string;
  updated_at: string;
  body_excerpt: string;
  body_truncated: boolean;
  locked: boolean;
  is_pull_request: boolean;
}

export interface IssueListResponse {
  repo: string;
  provider: string;
  source: string;
  mock: boolean;
  state: string;
  page: number;
  per_page: number;
  has_next_page: boolean;
  next_page: number | null;
  issues: GithubIssue[];
}

export interface IssueRelatedNodesRequest {
  analysis_id: number;
  issue_number: number;
  max_nodes?: number;
}

export interface IssueNodeInfo {
  id: string;
  kind: string;
  label: string;
  path: string;
  start_line: number;
  end_line: number;
  metadata: Record<string, unknown>;
}

export interface IssueRelatedNodeCandidate {
  rank: number;
  score: number;
  node_id: string;
  node: IssueNodeInfo;
  reason: string;
  evidence: unknown[];
}

export interface IssueRelatedNodesResponse {
  analysis_id: number;
  repo: string;
  revision: string;
  provider: string;
  source: string;
  mock: boolean;
  issue: Partial<GithubIssue>;
  selected_node_ids: string[];
  candidates: IssueRelatedNodeCandidate[];
  limits: { max_nodes: number };
  warnings: unknown[];
}

export async function fetchIssues(
  repoUrl: string,
  page?: number,
  perPage?: number,
): Promise<IssueListResponse> {
  const params = new URLSearchParams({ url: toGithubUrl(repoUrl) });
  if (page) params.set('page', String(page));
  if (perPage) params.set('per_page', String(perPage));
  return apiFetch<IssueListResponse>(`/api/issues/?${params}`);
}

export async function fetchIssueRelatedNodes(
  req: IssueRelatedNodesRequest,
): Promise<IssueRelatedNodesResponse> {
  return apiFetch<IssueRelatedNodesResponse>('/api/issues/related-nodes/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}
