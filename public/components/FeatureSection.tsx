'use client';

import FeatureCard from "./FeatureCard";

const FEATURES = [
  {
    tag: '01',
    title: 'Code Structure Visualization',
    desc: 'See your entire codebase as an interactive graph — files, modules, and dependencies laid out the way your code actually works.',
  },
  {
    tag: '02',
    title: 'Ask Anything About Your Repo',
    desc: 'Click any node and ask. GitStarter answers questions about that file, function, or module with full context from the surrounding code.',
  },
  {
    tag: '03',
    title: 'README Auto-Sync',
    desc: 'Every insight gets written back. GitStarter keeps your README up to date as your code evolves — no manual docs, ever.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 px-8 pb-40 relative z-10">
      {FEATURES.map((feature) => (
        <FeatureCard key={feature.tag} {...feature} />
      ))}
    </section>
  );
}