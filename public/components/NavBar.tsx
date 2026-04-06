'use client';

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full h-14 border-b border-[#00e5ff]/10 bg-black/60 backdrop-blur-md z-50 flex items-center justify-between px-8">
      {/* 로고 변경해야됨 그대로 가도 괜찮을지도 */}
      <div className="flex items-center gap-3 font-mono font-black tracking-tighter text-[#00e5ff]">
        <div className="w-5 h-5 border-2 border-[#00e5ff] rounded-sm rotate-45 flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-[#00e5ff] rounded-full animate-pulse" />
        </div>
        <span className="text-xl uppercase">GitStarter</span>
      </div>

      <div className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        <button className="hover:text-[#00e5ff] transition-colors">Flow Map</button>
        <button className="hover:text-[#00e5ff] transition-colors">Documentation</button>
        <button className="px-4 py-1.5 border border-[#00e5ff]/30 rounded-full hover:bg-[#00e5ff]/10 transition-all text-[#00e5ff]">
          Star on Github
        </button>
      </div>
    </nav>
  );
}