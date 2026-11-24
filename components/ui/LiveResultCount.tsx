'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Filter, X } from 'lucide-react';

interface LiveResultCountProps {
  /** The API endpoint or function to fetch the count */
  countSource: string | (() => Promise<number>);
  /** Dependencies that trigger a recount */
  dependencies?: any[];
  /** Debounce ms for dependency changes */
  debounceMs?: number;
  /** Label for the count */
  label?: string;
  /** Show loading skeleton */
  showSkeleton?: boolean;
  /** Custom formatter for the count */
  formatCount?: (count: number) => string;
  /** Fallback count while loading */
  fallbackCount?: number;
  /** Class name */
  className?: string;
}

export function LiveResultCount({
  countSource,
  dependencies = [],
  debounceMs = 300,
  label,
  showSkeleton = true,
  formatCount,
  fallbackCount = 0,
  className,
}: LiveResultCountProps) {
  const [count, setCount] = useState<number>(fallbackCount);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCount = useCallback(async () => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      let count: number;
      if (typeof countSource === 'function') {
        count = await countSource();
      } else {
        const response = await fetch(countSource, {
          signal: abortControllerRef.current.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        count = data.count ?? data.total ?? data.data?.length ?? 0;
      }

      if (!abortControllerRef.current.signal.aborted) {
        setCount(count);
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
        console.error('Live count fetch error:', err);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [countSource]);

  // Debounced fetch on dependency changes
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchCount();
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [fetchCount, debounceMs, ...dependencies]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const displayCount = formatCount ? formatCount(count) : count.toLocaleString();

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {label && <span className="text-sm font-medium text-jt-text">{label}</span>}

      <div className="flex items-center gap-2">
        {isLoading && showSkeleton && (
          <div className="flex items-center gap-2">
            <div className="w-10 h-5 bg-jt-surface border border-jt-border rounded animate-pulse" />
            <span className="text-sm font-medium text-jt-muted">—</span>
          </div>
        )}

        {!isLoading && (
          <span
            className={cn(
              'text-lg font-semibold tabular-nums transition-all duration-200',
              error ? 'text-jt-destructive' : 'text-jt-text',
            )}
          >
            {displayCount}
          </span>
        )}

        {error && (
          <button
            onClick={fetchCount}
            className="p-1.5 text-jt-destructive hover:bg-jt-destructive/10 rounded transition-colors"
            aria-label="Retry count"
            title="Failed to load count. Click to retry."
          >
            <AlertCircle size={14} />
          </button>
        )}
      </div>

      {label && <span className="text-sm text-jt-muted capitalize">{label}</span>}
    </div>
  );
}

// Hook for managing multiple live counts
export function useLiveCounts(
  sources: Record<string, string | (() => Promise<number>)>,
  options?: {
    debounceMs?: number;
    onAllLoaded?: (counts: Record<string, number>) => void;
  },
) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, Error | null>>({});

  const fetchAll = useCallback(async () => {
    const entries = Object.entries(sources);
    setLoading(Object.fromEntries(entries.map(([k]) => [k, true])));

    await Promise.all(
      entries.map(async ([key, source]) => {
        try {
          let count: number;
          if (typeof source === 'function') {
            count = await source();
          } else {
            const response = await fetch(source);
            const data = await response.json();
            count = data.count ?? data.total ?? 0;
          }
          setCounts((prev) => ({ ...prev, [key]: count }));
          setErrors((prev) => ({ ...prev, [key]: null }));
        } catch (err) {
          setErrors((prev) => ({ ...prev, [key]: err as Error }));
        } finally {
          setLoading((prev) => ({ ...prev, [key]: false }));
        }
      }),
    );

    options?.onAllLoaded?.(counts);
  }, [sources, options]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { counts, loading, errors, refresh: fetchAll };
}

// Component for filter result counts
interface FilterResultCountProps {
  /** Current filter state */
  filters: Record<string, any>;
  /** Function to get count for current filters */
  getCount: (filters: Record<string, any>) => Promise<number>;
  /** Label for the count */
  label?: string;
  /** Debounce ms */
  debounceMs?: number;
  className?: string;
}

export function FilterResultCount({
  filters,
  getCount,
  label,
  debounceMs = 300,
  className,
}: FilterResultCountProps) {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      try {
        setIsLoading(true);
        const result = await getCount(filters);
        if (!abortRef.current.signal.aborted) {
          setCount(result);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Filter count error:', err);
        }
      } finally {
        if (!abortRef.current?.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [filters, getCount, debounceMs]);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {label && <span className="text-sm text-jt-muted">{label}</span>}
      {isLoading ? (
        <span className="w-10 h-5 bg-jt-surface border border-jt-border rounded animate-pulse" />
      ) : (
        <span className="text-sm font-semibold text-jt-text tabular-nums">
          {count.toLocaleString()}
        </span>
      )}
    </span>
  );
}

import { AlertCircle } from 'lucide-react';
