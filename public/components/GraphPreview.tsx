'use client';

import GraphFlow from "./GraphFlow";

export default function GraphPreview() {
  return (
    <div className="relative max-w-6xl mx-auto mb-32 px-4">
      <div className="flex flex-col items-center text-center mb-10 gap-3">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-cyan/10 bg-cyan/5 text-[10px] font-mono font-bold text-cyan-500 uppercase tracking-widest">
          Live Preview
        </div>
        <p className="text-whites text-sm max-w-md leading-relaxed">
          Paste any repo and watch your codebase unfold as a live graph.
          <br />
          <span className="text-white">Here's what it looks like.</span>
        </p>
      </div>

      <div className="relative h-[400px] border-x border-t border-white/5 rounded-t-[3rem] bg-gradient-to-b from-[#7c3aed]/5 to-transparent overflow-hidden">
        <GraphFlow />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent pointer-events-none" />
      </div>
    </div>
  );
}