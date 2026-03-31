'use client';

import Background from '@/public/components/Background';
import FeaturesSection from '@/public/components/FeatureSection';
import HeroSection from '@/public/components/HeroSection';
import { useState } from 'react';

export default function GitStarterLanding() {
  const [repo, setRepo] = useState('');

  const handleAnalyze = (value: string) => {
   
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-[#e8eaf0] selection:bg-[#00e5ff]/30 selection:text-[#00e5ff] overflow-hidden font-sans">
      <Background />
      <HeroSection repo={repo} onRepoChange={setRepo} onAnalyze={handleAnalyze} />

      <FeaturesSection />
    </div>
  );
}