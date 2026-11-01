import React, { useEffect } from 'react';
import { setPageSeo } from '../lib/seo';

interface LegalPageProps {
  type: 'about' | 'privacy' | 'terms';
  navigate: (route: string) => void;
}

const CONTENT = {
  about: {
    title: 'About AniVault',
    description:
      'AniVault is a free anime discovery and streaming platform. Browse thousands of titles, track your watchlist, and watch episodes in HD.',
    heading: 'About AniVault',
    body: [
      'AniVault is built for anime fans who want a clean place to discover series, follow new episodes, and keep a personal watchlist.',
      'Browse trending titles, search by name or genre, and continue watching from where you left off. New episodes are added regularly so you can stay up to date with seasonal anime.',
      'Our goal is a fast, modern experience focused on discovery and watching — without clutter.',
    ],
  },
  privacy: {
    title: 'Privacy Policy - AniVault',
    description:
      'Privacy Policy for AniVault. Learn how we handle account data, watch history, and analytics.',
    heading: 'Privacy Policy',
    body: [
      'Last updated: November 2026.',
      'AniVault may collect information you provide when you create an account (such as email) and usage data needed to operate the service (for example watchlist and watch history tied to your account).',
      'We use analytics tools to understand site performance and improve the product. We do not sell your personal information.',
      'Third-party services (such as authentication providers, hosting, and analytics) process data according to their own policies. Streaming and metadata may involve external sources.',
      'You can request account-related data deletion by contacting us through the site if an account contact method is available. We may update this policy from time to time; continued use means you accept the updated policy.',
    ],
  },
  terms: {
    title: 'Terms of Service - AniVault',
    description:
      'Terms of Service for using AniVault. Read the rules for accounts, content, and acceptable use.',
    heading: 'Terms of Service',
    body: [
      'Last updated: November 2026.',
      'By using AniVault you agree to these terms. If you do not agree, please do not use the service.',
      'AniVault provides anime discovery, catalog browsing, and related features. Content availability may change. Trademarks and copyrighted works belong to their respective owners.',
      'You are responsible for your account and for using the service lawfully. Do not abuse the platform, attempt unauthorized access, or interfere with other users.',
      'The service is provided as-is without warranties. We may modify or discontinue features at any time. These terms may be updated; continued use constitutes acceptance of changes.',
    ],
  },
} as const;

export function LegalPage({ type, navigate }: LegalPageProps) {
  const page = CONTENT[type];

  useEffect(() => {
    setPageSeo({
      title: page.title,
      description: page.description,
      url: `/${type}`,
    });
  }, [type, page.title, page.description]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight text-white mb-6">{page.heading}</h1>
      <div className="space-y-4 text-slate-300 leading-relaxed text-sm sm:text-base">
        {page.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-4 text-sm font-bold">
        <button
          type="button"
          onClick={() => navigate('/about')}
          className="text-rose-400 hover:text-rose-300"
        >
          About
        </button>
        <button
          type="button"
          onClick={() => navigate('/privacy')}
          className="text-rose-400 hover:text-rose-300"
        >
          Privacy
        </button>
        <button
          type="button"
          onClick={() => navigate('/terms')}
          className="text-rose-400 hover:text-rose-300"
        >
          Terms
        </button>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="text-slate-400 hover:text-white"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
