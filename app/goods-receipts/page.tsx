'use client'

import { useEffect, useState } from 'react'
import { createGoodsReceipt, listGoodsReceipts, receiveGoodsReceipt } from '@/app/actions/finance'
import { Plus } from 'lucide-react'

export default function GoodsReceiptsPage() {
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [form, setForm] = useState({
    purchaseOrderId: '',
    supplierId: '',
    warehouseId: '',
    receivedDate: '',
    notes: '',
  })

  async function loadData() {
    setLoading(true)
    try {
      const rows = await listGoodsReceipts()
      setGoodsReceipts(rows)
    } catch {
      setGoodsReceipts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await createGoodsReceipt({
        purchaseOrderId: form.purchaseOrderId,
        supplierId: form.supplierId,
        warehouseId: form.warehouseId,
        receivedDate: form.receivedDate || undefined,
        notes: form.notes || undefined,
      })
      setOpenForm(false)
      setForm({ purchaseOrderId: '', supplierId: '', warehouseId: '', receivedDate: '', notes: '' })
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to create goods receipt')
    } finally {
      setLoading(false)
    }
  }

  async function receiveReceipt(id: string) {
    setLoading(true)
    try {
      await receiveGoodsReceipt({ goodsReceiptId: id })
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to receive goods')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Goods Receipts</h1>
        <button className="primary-button" onClick={() => setOpenForm(true)}>
          <Plus size={14} /> Create Receipt
        </button>
      </div>
      {openForm && (
        <div className="mb-6 panel data-panel">
          <h3 className="text-lg font-medium mb-4">Create Goods Receipt</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Purchase Order ID</label>
              <input name="purchaseOrderId" className="w-full border rounded px-2 py-1" value={form.purchaseOrderId} onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })} required />
              <label className="block text-sm font-medium">Supplier ID</label>
              <input name="supplierId" className="w-full border rounded px-2 py-1" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Warehouse ID</label>
              <input name="warehouseId" className="w-full border rounded px-2 py-1" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} required />
              <label className="block text-sm font-medium">Received Date</label>
              <input name="receivedDate" type="date" className="w-full border rounded px-2 py-1" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />
            </div>
            <label className="block text-sm font-medium">Notes</label>
            <input name="notes" className="w-full border rounded px-2 py-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex gap-2">
              <button className="button-secondary" onClick={() => setOpenForm(false)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Receipt'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="invoice-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>PO #</th>
              <th>Supplier</th>
              <th>Warehouse</th>
              <th>Status</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {goodsReceipts.map((r: any) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>{r.purchaseOrderId}</td>
                <td>{r.supplierId}</td>
                <td>{r.warehouseId}</td>
                <td><span className={`status-pill status-${r.status?.toLowerCase() || 'draft'}`}>{r.status}</span></td>
                <td>{r.total}</td>
                <td>
                  {r.status === 'draft' && (
                    <button className="row-action" onClick={() => receiveReceipt(r.id)}>Receive</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
