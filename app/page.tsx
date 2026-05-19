'use client';

import Background from '@/public/components/Background';
import FeaturesSection from '@/public/components/FeatureSection';
import GraphPreview from '@/public/components/GraphPreview';
import HeroSection from '@/public/components/HeroSection';
import Navbar from '@/public/components/NavBar';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAnalysis, fetchAnalysisById } from '@/lib/api';

export default function GitStarterLanding() {
  const [repo, setRepo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Analyzing…');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const TERMINAL_STATUSES = new Set(['done', 'succeeded', 'failed', 'error']);

  const STATUS_LABEL: Record<string, string> = {
    pending:   'Queued…',
    running:   'Analyzing repository…',
    done:      'Done!',
    succeeded: 'Done!',
    failed:    'Analysis failed',
    error:     'Analysis failed',
  };

  const handleAnalyze = async (value: string) => {
    setLoading(true);
    setLoadingText('Starting…');
    setError(null);
    try {
      let data = await fetchAnalysis(value);

      // Poll until terminal status
      if (!TERMINAL_STATUSES.has(data.status) && data.analysis_id != null) {
        setLoadingText(STATUS_LABEL[data.status] ?? 'Analyzing…');
        while (!TERMINAL_STATUSES.has(data.status)) {
          await new Promise(r => setTimeout(r, 2500));
          const polled = await fetchAnalysisById(data.analysis_id!);
          data = { ...polled };
          setLoadingText(STATUS_LABEL[polled.status] ?? 'Analyzing…');
        }
      }

      if (data.status === 'failed' || data.status === 'error') throw new Error('Analysis failed on the server.');

      const repoUrl = `https://github.com/${data.repo}`;
      router.push(
        `/chat?analysis_id=${data.analysis_id}` +
        `&repo=${encodeURIComponent(data.repo)}` +
        `&revision=${encodeURIComponent(data.revision)}` +
        `&url=${encodeURIComponent(repoUrl)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-[#e8eaf0] selection:bg-[#00e5ff]/30 selection:text-[#00e5ff] overflow-hidden font-sans">
      <Background />
      <Navbar />
      <HeroSection repo={repo} onRepoChange={setRepo} onAnalyze={handleAnalyze} loading={loading} loadingText={loadingText} error={error} />
      <GraphPreview />
      <FeaturesSection />
    </div>
  );
}