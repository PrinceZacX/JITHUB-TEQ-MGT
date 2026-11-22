'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

type Movement = {
  id: string
  itemId: string
  warehouseId: string
  movementType: string
  quantity: number
  unitCost?: number
  referenceType?: string
  referenceId?: string
  referenceNumber?: string
  notes?: string
  createdAt: string
}

const REQUEST_TIMEOUT_MS = 15000

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const loadData = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stock-movements', {
        signal: controller.signal,
        credentials: 'same-origin',
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        if (res.status === 401) throw new Error('Please sign in to continue.')
        if (res.status === 403) throw new Error('You do not have access to stock movements.')
        throw new Error(`Request failed (${res.status})`)
      }
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Unexpected response from server.')
      }
      const data = await res.json()
      if (!mountedRef.current || controller.signal.aborted) return
      setMovements(Array.isArray(data) ? data : [])
    } catch (err: any) {
      if (!mountedRef.current || controller.signal.aborted) {
        // Component unmounted or request aborted — don't update state
        return
      }
      if (err?.name === 'AbortError') {
        setError('Request timed out. Please try again.')
      } else {
        setError(err?.message || 'Failed to load stock movements.')
      }
      setMovements([])
    } finally {
      clearTimeout(timeoutId)
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Stock Movements</h1>
        <button className="button-secondary" onClick={loadData} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button className="button-secondary" onClick={loadData} disabled={loading}>Retry</button>
        </div>
      )}

      {loading && movements.length === 0 ? (
        <div className="empty-rows"><p>Loading stock movements…</p></div>
      ) : movements.length === 0 ? (
        <div className="empty-rows"><p>No stock movements recorded yet.</p></div>
      ) : (
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
              {movements.map((m: Movement) => (
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
      )}
    </div>
  )
}
