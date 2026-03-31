'use client';

import RepoInput from "./RepoInput";

interface HeroSectionProps {
  repo: string;
  onRepoChange: (value: string) => void;
  onAnalyze?: (repo: string) => void;
}

export default function HeroSection({ repo, onRepoChange, onAnalyze }: HeroSectionProps) {
  return (
    <section className="relative pt-44 pb-20 px-6 flex flex-col items-center text-center z-10">
      <div className="mb-8 flex items-center gap-2 px-3 py-1 rounded-full border border-[#00e5ff]/30 bg-[#00e5ff]/5 text-[10px] font-mono font-bold text-[#00e5ff]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5ff] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00e5ff]" />
        </span>
        Understand any repo in seconds
      </div>

      <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
        Understand any codebase,
        <br />
        <span className="text-cyan-400">
          in one glance.
        </span>
      </h1>

      <p className="max-w-xl text-gray-400 text-base leading-relaxed mb-10">
        GitStarter turns complex repositories into simple visual maps.
        <br />
        See how files connect and where to start — instantly.
      </p>

      <RepoInput value={repo} onChange={onRepoChange} onAnalyze={onAnalyze} />
    </section>
  );
}