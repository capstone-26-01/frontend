'use client';

import Background from '@/public/components/Background';
import FeaturesSection from '@/public/components/FeatureSection';
import GraphPreview from '@/public/components/GraphPreview';
import HeroSection from '@/public/components/HeroSection';
import Navbar from '@/public/components/NavBar';
import { useState } from 'react';

export default function GitStarterLanding() {
  const [repo, setRepo] = useState('');

  const handleAnalyze = (value: string) => {
    // TODO: trigger graph analysis with `value`
    console.log('Analyzing:', value);
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-[#e8eaf0] selection:bg-[#00e5ff]/30 selection:text-[#00e5ff] overflow-hidden font-sans">
      <Background />
      <Navbar />
      <HeroSection repo={repo} onRepoChange={setRepo} onAnalyze={handleAnalyze} />
      <GraphPreview />
      <FeaturesSection />
    </div>
  );
}