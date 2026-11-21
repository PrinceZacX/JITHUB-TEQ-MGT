type ReceiptLike = {
  number: string
  customer: string
  method: string
  reference: string | null
  paidAt: string
  amount: string | number
}

export function filterReceipts<T extends ReceiptLike>(receipts: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...receipts]

  return receipts.filter((receipt) => (
    `${receipt.number} ${receipt.customer} ${receipt.method} ${receipt.reference ?? ''}`
      .toLowerCase()
      .includes(needle)
  ))
}

export function formatReceiptDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export type ReceiptSort = 'newest' | 'oldest' | 'amount-high' | 'amount-low'

export function sortReceipts<T extends ReceiptLike>(receipts: readonly T[], sort: ReceiptSort): T[] {
  const sorted = [...receipts]
  const byNumber = (a: T, b: T) => a.number.localeCompare(b.number)

  if (sort === 'amount-high' || sort === 'amount-low') {
    const direction = sort === 'amount-high' ? -1 : 1
    return sorted.sort((a, b) => (Number(a.amount || 0) - Number(b.amount || 0)) * direction || byNumber(a, b))
  }

  return sort === 'oldest'
    ? sorted.sort((a, b) => a.paidAt.localeCompare(b.paidAt) || byNumber(a, b))
    : sorted.sort((a, b) => b.paidAt.localeCompare(a.paidAt) || byNumber(a, b))
}
