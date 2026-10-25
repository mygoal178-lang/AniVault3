import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface RequestPageProps {
  navigate: (route: string) => void;
}

export function RequestPage({ navigate }: RequestPageProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const t = title.trim();
    if (t.length < 2) {
      setError('Please enter an anime title.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.submitAnimeRequest({
        title: t,
        note: note.trim() || undefined,
        email: email.trim() || undefined,
        website: website || undefined,
      });
      setSuccess(res.message || 'Request submitted. Thank you!');
      setTitle('');
      setNote('');
      setEmail('');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Request an Anime
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          No account needed. Tell us what you want to watch and we&apos;ll try to add it.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-white/10 bg-[#0e0e14] p-6 shadow-xl sm:p-8"
      >
        {/* Honeypot – hidden from real users */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="absolute -left-[9999px] opacity-0"
          aria-hidden="true"
        />

        <label className="mb-1 block text-sm font-medium text-slate-300">
          Anime title <span className="text-rose-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Solo Leveling Season 2"
          maxLength={200}
          required
          className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />

        <label className="mb-1 block text-sm font-medium text-slate-300">
          Note <span className="text-slate-500">(optional)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Season, language preference, episode range…"
          maxLength={500}
          rows={3}
          className="mb-4 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />

        <label className="mb-1 block text-sm font-medium text-slate-300">
          Email <span className="text-slate-500">(optional – for updates)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mb-6 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {loading ? 'Submitting…' : 'Submit request'}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          You do not need an account. Spam is filtered automatically.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Looking for something already on the site?{' '}
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="font-semibold text-rose-400 hover:text-rose-300"
        >
          Search the catalog
        </button>
      </p>
    </div>
  );
}
