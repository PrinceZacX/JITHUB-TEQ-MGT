'use client'

import { useEffect, useState } from 'react'

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const data = await (await fetch('/api/stock-movements')).json()
      setMovements(data)
    } catch {
      setMovements([])
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
        <h1 className="text-2xl font-bold">Stock Movements</h1>
      </div>
      <div className="invoice-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Warehouse</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Reference</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m: any) => (
              <tr key={m.id}>
                <td>{m.itemId}</td>
                <td>{m.warehouseId}</td>
                <td>{m.movementType}</td>
                <td>{m.quantity}</td>
                <td>{m.referenceNumber || '-'}</td>
                <td>{m.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
