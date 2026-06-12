'use client';

const QUICK_REPOS: { label: string; repo: string }[] = [
  { label: 'oop-car', repo: 'sanghyunna/oop-car' },
  { label: 'openai/CLIP', repo: 'openai/CLIP' },
];

interface RepoInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze?: (repo: string) => void;
  loading?: boolean;
  loadingText?: string;
  error?: string | null;
}

export default function RepoInput({ value, onChange, onAnalyze, loading, loadingText, error }: RepoInputProps) {
  const handleAnalyze = () => {
    if (value.trim() && !loading) onAnalyze?.(value.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-3">
      <div className="w-full group relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#00e5ff]/50 to-blue-500/50 rounded-2xl blur opacity-20 group-focus-within:opacity-50 transition duration-500" />

        <div className="relative flex items-center p-1 rounded-2xl bg-[#0a0c10] border border-white/10 shadow-2xl">
          <span className="px-4 font-mono text-xs text-gray-600 select-none whitespace-nowrap">
            github URL
          </span>
          <input
            type="text"
            placeholder="owner/repo or GitHub URL"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 min-w-0 bg-transparent py-4 outline-none font-mono text-sm text-[#00e5ff] placeholder:text-gray-700 disabled:opacity-50"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !value.trim()}
            className="shrink-0 min-w-[118px] bg-[#00e5ff] text-black px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white hover:scale-[0.98] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
          >
            {loading ? (loadingText ?? 'Analyzing…') : 'Analyze'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="w-full rounded-xl border border-[#00e5ff]/15 bg-[#00e5ff]/[0.06] px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-[#00e5ff]">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-[#00e5ff]/30 border-t-[#00e5ff]"
                style={{ animation: 'spin 0.8s linear infinite' }}
              />
              <span className="truncate">{loadingText ?? 'Analyzing…'}</span>
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-300">
            처음 분석하는 저장소는 클론하고 그래프를 만드는 데 몇 분 걸릴 수 있어요. 완료되면 자동으로 그래프가 열립니다.
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <p className="text-xs font-mono text-red-400/80 text-center">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Try:</span>
        {QUICK_REPOS.map(({ label, repo }) => (
          <button
            key={repo}
            onClick={() => { onChange(repo); onAnalyze?.(repo); }}
            disabled={loading}
            className="text-[11px] font-mono text-gray-200 hover:text-[#00e5ff] border border-white/20 hover:border-[#00e5ff]/50 px-2.5 py-1 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
