'use client';

import { useEffect, useState } from 'react';
import {
  createPurchaseOrder,
  listPurchaseOrders,
  approvePurchaseOrder,
  recordPayment,
} from '@/app/actions/finance';
import { Plus } from 'lucide-react';

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({
    supplierId: '',
    warehouseId: '',
    expectedDate: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<
    {
      itemId: string;
      itemName: string;
      quantity: string;
      unitPrice: string;
      taxRate: string;
    }[]
  >([]);
  const [newLine, setNewLine] = useState({
    itemId: '',
    itemName: '',
    quantity: '',
    unitPrice: '',
    taxRate: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const fetchedPos = await listPurchaseOrders();
      setPos(fetchedPos);
    } catch {
      // ignore
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
      await createPurchaseOrder({
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        expectedDate: form.expectedDate || undefined,
        notes: form.notes || undefined,
        lines: lineItems.map((item) => ({
          itemId: item.itemId,
          description: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate || '0',
        })),
      });
      setOpenForm(false);
      setForm({ supplierId: '', warehouseId: '', expectedDate: '', notes: '' });
      setLineItems([]);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  }

  async function approveOrder(id: string) {
    setLoading(true);
    try {
      await approvePurchaseOrder({ purchaseOrderId: id });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve purchase order');
    } finally {
      setLoading(false);
    }
  }

  function addLineItem() {
    if (!newLine.itemName.trim()) return;
    setLineItems([...lineItems, newLine]);
    setNewLine({
      itemId: '',
      itemName: '',
      quantity: '',
      unitPrice: '',
      taxRate: '',
    });
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Purchase Orders</h1>
          <p className="text-jt-muted text-sm">Manage purchase orders and supplier procurements</p>
        </div>
        <button className="primary-button" onClick={() => setOpenForm(true)}>
          <Plus size={14} /> Create Order
        </button>
      </div>

      {openForm && (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Create Purchase Order</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label
                    htmlFor="supplierId"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Supplier ID <span className="text-red-500">*</span>
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
                    Warehouse ID <span className="text-red-500">*</span>
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
                    htmlFor="expectedDate"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Expected Date
                  </label>
                  <input
                    id="expectedDate"
                    name="expectedDate"
                    type="date"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.expectedDate}
                    onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
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
                    placeholder="Optional notes about this purchase order..."
                  />
                </div>
              </div>

              <div className="border rounded-lg border-jt-border/50 bg-jt-surface/50 p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm text-jt-text">Line Items</h4>
                </div>
                <div className="grid gap-2 mb-3">
                  <input
                    name="itemId"
                    className="border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm"
                    value={newLine.itemId}
                    onChange={(e) => setNewLine({ ...newLine, itemId: e.target.value })}
                    placeholder="Item ID"
                  />
                  <input
                    name="itemName"
                    className="border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm"
                    value={newLine.itemName}
                    onChange={(e) => setNewLine({ ...newLine, itemName: e.target.value })}
                    placeholder="Item Name"
                  />
                  <input
                    name="quantity"
                    type="number"
                    className="border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm"
                    value={newLine.quantity}
                    onChange={(e) => setNewLine({ ...newLine, quantity: e.target.value })}
                    placeholder="Qty"
                  />
                  <input
                    name="unitPrice"
                    type="number"
                    className="border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm"
                    value={newLine.unitPrice}
                    onChange={(e) => setNewLine({ ...newLine, unitPrice: e.target.value })}
                    placeholder="Unit Price"
                  />
                  <input
                    name="taxRate"
                    type="number"
                    className="border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm"
                    value={newLine.taxRate}
                    onChange={(e) => setNewLine({ ...newLine, taxRate: e.target.value })}
                    placeholder="Tax %"
                  />
                  <button
                    className="primary-button px-4"
                    onClick={(e) => {
                      e.preventDefault();
                      addLineItem();
                    }}
                  >
                    Add
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-jt-border/50">
                      <th className="px-2 py-1 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-2 py-1 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-2 py-1 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-2 py-1 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                        Tax %
                      </th>
                      <th className="px-2 py-1 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                        Line Total
                      </th>
                      <th className="px-2 py-1 text-xs font-semibold text-jt-muted uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-jt-border/50">
                    {lineItems.map((item, idx) => {
                      const lineTotal = (Number(item.quantity) * Number(item.unitPrice)).toFixed(2);
                      return (
                        <tr key={idx} className="group">
                          <td className="px-2 py-1 text-sm text-jt-text truncate">
                            {item.itemName}
                          </td>
                          <td className="px-2 py-1 text-sm text-jt-text">{item.quantity}</td>
                          <td className="px-2 py-1 text-sm text-jt-text">{item.unitPrice}</td>
                          <td className="px-2 py-1 text-sm text-jt-text">{item.taxRate}</td>
                          <td className="px-2 py-1 text-sm text-jt-text">{lineTotal}</td>
                          <td className="px-2 py-1 text-right">
                            <button
                              className="row-action text-red-600 hover:bg-red-50"
                              onClick={() => removeLineItem(idx)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="button-secondary flex-1" onClick={() => setOpenForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button flex-1" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Purchase Order'}
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
                  Order #
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
                  Order Date
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
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <p className="text-sm text-jt-muted">No purchase orders yet.</p>
                  </td>
                </tr>
              ) : (
                pos.map((po: any) => (
                  <tr key={po.id} className="hover:bg-jt-surface/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-jt-text truncate block">
                        {po.number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[120px]">
                      {po.supplierId}
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[100px]">
                      {po.warehouseId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block ${
                          po.status === 'approved'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : po.status === 'draft'
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : po.status === 'cancelled'
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-muted">{po.orderDate}</td>
                    <td className="px-4 py-3 text-sm text-jt-text">{String(po.total)}</td>
                    <td className="px-4 py-3 text-right">
                      {po.status === 'draft' && (
                        <button
                          className="row-action text-green-600 hover:bg-green-50 disabled:opacity-50"
                          onClick={() => approveOrder(po.id)}
                          title="Approve"
                        >
                          Approve
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
