'use client';

import { useEffect, useState } from 'react';
import { createGoodsReceipt, listGoodsReceipts, receiveGoodsReceipt } from '@/app/actions/finance';
import { Plus } from 'lucide-react';

export default function GoodsReceiptsPage() {
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    purchaseOrderId: '',
    supplierId: '',
    warehouseId: '',
    receivedDate: '',
    notes: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const rows = await listGoodsReceipts();
      setGoodsReceipts(rows);
    } catch {
      setGoodsReceipts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createGoodsReceipt({
        purchaseOrderId: form.purchaseOrderId,
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        receivedDate: form.receivedDate || undefined,
        notes: form.notes || undefined,
      });
      setOpenForm(false);
      setForm({
        purchaseOrderId: '',
        supplierId: '',
        warehouseId: '',
        receivedDate: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create goods receipt');
    } finally {
      setLoading(false);
    }
  }

  async function receiveReceipt(id: string) {
    setLoading(true);
    try {
      await receiveGoodsReceipt({ goodsReceiptId: id });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to receive goods');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Goods Receipts</h1>
          <p className="text-jt-muted text-sm">
            Track and manage goods received against purchase orders
          </p>
        </div>
        <button className="primary-button" onClick={() => setOpenForm(true)}>
          <Plus size={14} /> Create Receipt
        </button>
      </div>

      {openForm && (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Create Goods Receipt</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="purchaseOrderId"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Purchase Order ID
                  </label>
                  <input
                    id="purchaseOrderId"
                    name="purchaseOrderId"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.purchaseOrderId}
                    onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="supplierId"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Supplier ID
                  </label>
                  <input
                    id="supplierId"
                    name="supplierId"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="warehouseId"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Warehouse ID
                  </label>
                  <input
                    id="warehouseId"
                    name="warehouseId"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.warehouseId}
                    onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="receivedDate"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Received Date
                  </label>
                  <input
                    id="receivedDate"
                    name="receivedDate"
                    type="date"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.receivedDate}
                    onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="notes"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    placeholder="Optional notes about this receipt..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="button-secondary flex-1"
                  onClick={() => setOpenForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button flex-1" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Receipt'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-jt-border/50 bg-jt-surface/50 sticky top-0 z-10">
                <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                  Receipt #
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                  PO #
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jt-border/50">
              {goodsReceipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <p className="text-sm text-jt-muted">No goods receipts yet.</p>
                  </td>
                </tr>
              ) : (
                goodsReceipts.map((r: any) => (
                  <tr key={r.id} className="hover:bg-jt-surface/50 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-jt-text truncate block">
                        {r.number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[100px]">
                      {r.purchaseOrderId}
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[120px]">
                      {r.supplierId}
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[100px]">
                      {r.warehouseId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block ${
                          r.status === 'received'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : r.status === 'draft'
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : r.status === 'cancelled'
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text">{String(r.total)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'draft' && (
                        <button
                          onClick={() => receiveReceipt(r.id)}
                          className="row-action text-green-600 hover:bg-green-50 disabled:opacity-50"
                          title="Receive"
                        >
                          Receive
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
