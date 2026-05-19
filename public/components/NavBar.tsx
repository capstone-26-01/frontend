'use client';

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full h-14 border-b border-[#00e5ff]/10 bg-black/60 backdrop-blur-md z-50 flex items-center justify-between px-8">
      <div className="flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="5" r="3" fill="#00e5ff" />
          <circle cx="4" cy="17" r="2.5" fill="#00e5ff" fillOpacity="0.55" />
          <circle cx="18" cy="17" r="2.5" fill="#00e5ff" fillOpacity="0.55" />
          <line x1="11" y1="8" x2="4.5" y2="14.5" stroke="#00e5ff" strokeWidth="1.2" strokeOpacity="0.35" />
          <line x1="11" y1="8" x2="17.5" y2="14.5" stroke="#00e5ff" strokeWidth="1.2" strokeOpacity="0.35" />
        </svg>
        <span className="font-mono font-black tracking-tighter text-[#00e5ff] text-xl uppercase">GitStarter</span>
      </div>

      <div className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        <button className="hover:text-[#00e5ff] transition-colors">Flow Map</button>
        <button className="hover:text-[#00e5ff] transition-colors">Documentation</button>
        <button className="px-4 py-1.5 border border-[#00e5ff]/30 rounded-full hover:bg-[#00e5ff]/10 transition-all text-[#00e5ff]">
          Star on GitHub
        </button>
      </div>
    </nav>
  );
}
