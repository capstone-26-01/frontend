'use client';

export default function Background() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `linear-gradient(#00e5ff 1px, transparent 1px), linear-gradient(90deg, #00e5ff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-[#00e5ff]/10 to-transparent blur-[120px]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[300px] bg-gradient-to-t from-blue-900/10 to-transparent blur-[80px]" />
    </div>
  );
}