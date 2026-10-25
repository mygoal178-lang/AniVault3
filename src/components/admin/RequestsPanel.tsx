import React, { useCallback, useEffect, useState } from 'react';
import {
  Inbox,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Copy,
  AlertCircle,
  Mail,
  Clock,
  Filter,
} from 'lucide-react';
import { api } from '../../services/api';

export type RequestStatus = 'pending' | 'imported' | 'rejected' | 'duplicate';

export interface AnimeRequestRow {
  id: string;
  title: string;
  note: string | null;
  email: string | null;
  mal_id: number | null;
  status: RequestStatus;
  ip: string | null;
  created_at: string;
  updated_at?: string;
}

interface RequestsPanelProps {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const STATUS_STYLES: Record<
  RequestStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  imported: {
    label: 'Imported',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  duplicate: {
    label: 'Duplicate',
    className: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
};

export function RequestsPanel({ showToast }: RequestsPanelProps) {
  const [requests, setRequests] = useState<AnimeRequestRow[]>([]);
  const [filter, setFilter] = useState<RequestStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await api.getAdminRequests(status);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load requests.';
      setError(msg);
      setRequests([]);
      // Table missing is the most common setup issue
      if (/relation|does not exist|anime_requests/i.test(msg)) {
        setError(
          'Table anime_requests is missing. Run supabase_anime_requests.sql in the Supabase SQL Editor, then refresh.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: RequestStatus) => {
    setUpdatingId(id);
    try {
      await api.updateAdminRequestStatus(id, status);
      showToast(`Marked as ${status}.`);
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Inbox className="h-5 w-5 text-rose-500" />
            Anime Requests
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Public submissions from /request (no login required).
            {filter === 'pending' && !loading && (
              <span className="ml-1 text-amber-400 font-semibold">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as RequestStatus | 'all')}
              className="rounded-xl border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white focus:border-rose-500 focus:outline-none"
            >
              <option value="pending">Pending</option>
              <option value="all">All</option>
              <option value="imported">Imported</option>
              <option value="rejected">Rejected</option>
              <option value="duplicate">Duplicate</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center">
          <Inbox className="mx-auto h-10 w-10 text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-400">No requests here</p>
          <p className="text-xs text-slate-500 mt-1">
            When users submit on /request, they will show up in this list.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
            const busy = updatingId === req.id;
            return (
              <div
                key={req.id}
                className="rounded-2xl border border-white/10 bg-[#0a0a10] p-4 shadow-lg"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white truncate">{req.title}</h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.className}`}
                      >
                        {style.label}
                      </span>
                    </div>

                    {req.note && (
                      <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{req.note}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(req.created_at).toLocaleString()}
                      </span>
                      {req.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {req.email}
                        </span>
                      )}
                      {req.mal_id != null && (
                        <span>MAL #{req.mal_id}</span>
                      )}
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateStatus(req.id, 'imported')}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Imported
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateStatus(req.id, 'duplicate')}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-600/20 border border-slate-500/30 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-600/30 disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicate
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateStatus(req.id, 'rejected')}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-600/20 border border-rose-500/30 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-600/30 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
