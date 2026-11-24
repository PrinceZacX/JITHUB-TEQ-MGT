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
      const pos = await listPurchaseOrders();
      setPos(pos);
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <button className="primary-button" onClick={() => setOpenForm(true)}>
          <Plus size={14} /> Create Order
        </button>
      </div>
      {openForm && (
        <div className="mb-6 panel data-panel">
          <h3 className="text-lg font-medium mb-4">Create Purchase Order</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Supplier ID</label>
              <input
                name="supplierId"
                className="w-full border rounded px-2 py-1"
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                required
              />
              <label className="block text-sm font-medium">Warehouse ID</label>
              <input
                name="warehouseId"
                className="w-full border rounded px-2 py-1"
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Expected Date</label>
              <input
                name="expectedDate"
                type="date"
                className="w-full border rounded px-2 py-1"
                value={form.expectedDate}
                onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
              />
              <label className="block text-sm font-medium">Notes</label>
              <input
                name="notes"
                className="w-full border rounded px-2 py-1"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="border rounded p-4 mb-4">
              <h4 className="font-medium mb-2">Line Items</h4>
              <div className="grid grid-cols-6 gap-2 mb-2">
                <input
                  name="itemId"
                  className="border rounded px-2 py-1"
                  value={newLine.itemId}
                  onChange={(e) => setNewLine({ ...newLine, itemId: e.target.value })}
                  placeholder="Item ID"
                />
                <input
                  name="itemName"
                  className="border rounded px-2 py-1"
                  value={newLine.itemName}
                  onChange={(e) => setNewLine({ ...newLine, itemName: e.target.value })}
                  placeholder="Item Name"
                />
                <input
                  name="quantity"
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newLine.quantity}
                  onChange={(e) => setNewLine({ ...newLine, quantity: e.target.value })}
                  placeholder="Qty"
                />
                <input
                  name="unitPrice"
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newLine.unitPrice}
                  onChange={(e) => setNewLine({ ...newLine, unitPrice: e.target.value })}
                  placeholder="Unit Price"
                />
                <input
                  name="taxRate"
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newLine.taxRate}
                  onChange={(e) => setNewLine({ ...newLine, taxRate: e.target.value })}
                  placeholder="Tax %"
                />
                <button
                  className="primary-button"
                  onClick={(e) => {
                    e.preventDefault();
                    setLineItems([...lineItems, newLine]);
                    setNewLine({
                      itemId: '',
                      itemName: '',
                      quantity: '',
                      unitPrice: '',
                      taxRate: '',
                    });
                  }}
                >
                  Add
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Tax %</th>
                    <th>Line Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.itemName}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unitPrice}</td>
                      <td>{item.taxRate}</td>
                      <td>{(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}</td>
                      <td>
                        <button
                          className="row-action text-red-600"
                          onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={() => setOpenForm(false)}>
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Purchase Order'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="invoice-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Supplier</th>
              <th>Warehouse</th>
              <th>Status</th>
              <th>Order Date</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po: any) => (
              <tr key={po.id}>
                <td>{po.number}</td>
                <td>{po.supplierId}</td>
                <td>{po.warehouseId}</td>
                <td>
                  <span className={`status-pill status-${po.status?.toLowerCase() || 'draft'}`}>
                    {po.status}
                  </span>
                </td>
                <td>{po.orderDate}</td>
                <td>{po.total}</td>
                <td>
                  {po.status === 'draft' && (
                    <button className="row-action" onClick={() => approveOrder(po.id)}>
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
