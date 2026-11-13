import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';

import { chatApi } from '../services/api';
import { UnansweredItem } from '../types';

export const UnansweredPage: React.FC = () => {
  const { wid } = useParams<{ wid: string }>();

  const [items, setItems] = useState<UnansweredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved' | 'ignored'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadUnanswered = async () => {
    if (!wid) return;
    try {
      setLoading(true);
      setError(null);
      const data = await chatApi.listUnanswered(wid);
      setItems(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load unanswered questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnanswered();
  }, [wid]);

  const handleUpdateStatus = async (
    itemId: string,
    newStatus: 'open' | 'resolved' | 'ignored'
  ) => {
    if (!wid) return;
    try {
      const updated = await chatApi.updateUnansweredStatus(wid, itemId, newStatus);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    } catch (err: any) {
      alert(err.message || 'Failed to update question status');
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesSearch = item.question
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const openCount = items.filter((i) => i.status === 'open').length;
  const resolvedCount = items.filter((i) => i.status === 'resolved').length;
  const ignoredCount = items.filter((i) => i.status === 'ignored').length;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto max-w-6xl mx-auto w-full">
      {/* Header */}
      <header className="border-b border-border pb-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unanswered Questions</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Questions that fell below the similarity threshold or couldn't be answered from existing documentation.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: 'all', label: 'All', count: items.length },
          { key: 'open', label: 'Open', count: openCount },
          { key: 'resolved', label: 'Resolved', count: resolvedCount },
          { key: 'ignored', label: 'Ignored', count: ignoredCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
              filterStatus === tab.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border border-border text-foreground hover:bg-accent'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                filterStatus === tab.key
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {error && (
        <div className="p-4 mb-6 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2 border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading unanswered questions...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border rounded-2xl bg-card/40">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 opacity-90" />
          <h3 className="text-base font-semibold text-foreground mb-1">All clear!</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {filterStatus === 'all'
              ? 'No unanswered questions logged yet. All queries have matched internal documents with strong confidence.'
              : `No questions currently marked as '${filterStatus}'.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        item.status === 'open'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : item.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {item.status}
                    </span>

                    {item.top_score !== null && item.top_score !== undefined && (
                      <span className="text-[11px] text-muted-foreground">
                        Top similarity: {(item.top_score * 100).toFixed(1)}%
                      </span>
                    )}

                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 opacity-60" />
                      {new Date(item.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-foreground break-words">
                    "{item.question}"
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'open' ? (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'resolved')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-medium transition-colors"
                        title="Mark as addressed by uploading matching documentation"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Resolve
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'ignored')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-accent border border-border text-xs font-medium transition-colors"
                        title="Ignore out-of-scope question"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Ignore
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'open')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-accent border border-border text-xs font-medium transition-colors"
                      title="Reopen question"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
