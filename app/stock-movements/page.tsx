'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

type Movement = {
  id: string;
  itemId: string;
  warehouseId: string;
  movementType: string;
  quantity: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
};

const REQUEST_TIMEOUT_MS = 15000;

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stock-movements', {
        signal: controller.signal,
        credentials: 'same-origin',
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        if (res.status === 401) throw new Error('Please sign in to continue.');
        if (res.status === 403) throw new Error('You do not have access to stock movements.');
        throw new Error(`Request failed (${res.status})`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Unexpected response from server.');
      }
      const data = await res.json();
      if (!mountedRef.current || controller.signal.aborted) return;
      setMovements(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }
      if (err?.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err?.message || 'Failed to load stock movements.');
      }
      setMovements([]);
    } finally {
      clearTimeout(timeoutId);
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Stock Movements</h1>
          <p className="text-jt-muted text-sm">
            Track inventory movements across warehouses
          </p>
        </div>
        <button
          className="button-secondary"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button className="button-secondary" onClick={loadData} disabled={loading}>
            Retry
          </button>
        </div>
      )}

      {loading && movements.length === 0 ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-8 flex items-center justify-center">
            <p className="text-sm text-jt-muted">Loading stock movements…</p>
          </div>
        </section>
      ) : movements.length === 0 ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-jt-muted mb-4">No stock movements recorded yet.</p>
          </div>
        </section>
      ) : (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-jt-border/50 bg-jt-surface/50 sticky top-0 z-10">
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Warehouse
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jt-border/50">
                {movements.map((m: Movement) => (
                  <tr key={m.id} className="hover:bg-jt-surface/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[100px]">
                      {m.itemId}
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[100px]">
                      {m.warehouseId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block ${
                          m.movementType === 'in'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : m.movementType === 'out'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : m.movementType === 'adjustment'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {m.movementType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text">{m.quantity}</td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[100px]">
                      {m.referenceNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-muted">
                      {m.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
