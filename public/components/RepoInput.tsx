'use client';

import { useState } from 'react';

const QUICK_REPOS = ['shadcn/ui', 'facebook/react', 'tailwindlabs/tailwindcss'];

interface RepoInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze?: (repo: string) => void;
}

export default function RepoInput({ value, onChange, onAnalyze }: RepoInputProps) {
  const handleAnalyze = () => {
    if (value.trim()) onAnalyze?.(value.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  return (
    <div className="w-full max-w-xl group relative">
      <div className="absolute -inset-1 bg-gradient-to-r from-[#00e5ff]/50 to-blue-500/50 rounded-2xl blur opacity-20 group-focus-within:opacity-50 transition duration-500" />

      <div className="relative flex items-center p-1 rounded-2xl bg-[#0a0c10] border border-white/10 shadow-2xl">
        <span className="px-4 font-mono text-xs text-gray-600 select-none whitespace-nowrap">
          github URL
        </span>
        <input
          type="text"
          placeholder="owner / repository"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent py-4 outline-none font-mono text-sm text-[#00e5ff] placeholder:text-gray-700"
        />
        <button
          onClick={handleAnalyze}
          className="shrink-0 bg-[#00e5ff] text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white hover:scale-[0.98] active:scale-95 transition-all"
        >
          Analyze
        </button>
      </div>
    </div>
  )
}