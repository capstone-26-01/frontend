'use client';

import Background from '@/public/components/Background';
import { useState } from 'react';

export default function GitStarterLanding() {
  const [repo, setRepo] = useState('');

  return (
    <div className="min-h-screen bg-[#05070a] text-[#e8eaf0] selection:bg-[#00e5ff]/30 selection:text-[#00e5ff] overflow-hidden font-sans">
      <Background />

    </div>
  );
}