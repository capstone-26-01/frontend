'use client';

interface FeatureCardProps {
  tag: string;
  title: string;
  desc: string;
}

export default function FeatureCard({ tag, title, desc }: FeatureCardProps) {
  return (
    <div className="group p-10 rounded-3xl bg-[#0a0c10] border border-white/10 hover:border-[#00e5ff]/40 transition-all duration-300 relative overflow-hidden">
      {/* Tag watermark */}
      <div className="absolute top-0 right-0 p-6 text-4xl font-mono font-black text-white/5 group-hover:text-[#00e5ff]/10 transition-colors">
        {tag}
      </div>
      {/* Accent line */}
      <div className="w-10 h-[3px] mb-6 bg-[#00e5ff]/20 group-hover:w-16 group-hover:bg-[#00e5ff] transition-all duration-300 rounded-full" />
      <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#00e5ff] transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed font-light">{desc}</p>
    </div>
  );
}