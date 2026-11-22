'use client'

import { useEffect, useState } from 'react'
import { recordPayment } from '@/app/actions/finance'

export default function GoodsReceiptsPage() {
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      // Placeholder - will be populated when goods receipts server action is added
      setGoodsReceipts([])
    } catch {
      setGoodsReceipts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Goods Receipts</h1>
        <button className="primary-button">Create Receipt</button>
      </div>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
