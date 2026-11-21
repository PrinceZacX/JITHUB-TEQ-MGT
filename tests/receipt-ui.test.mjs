import test from 'node:test'
import assert from 'node:assert/strict'

const loadReceiptUi = async () => {
  try {
    return await import('../lib/receipt-ui.ts')
  } catch {
    return {}
  }
}

const { filterReceipts, sortReceipts, formatReceiptDate } = await loadReceiptUi()

const receipts = [
  { id: '1', number: 'RCP-0001', customer: 'Kampala Creative Hub', method: 'Bank transfer', reference: 'INV-1001', paidAt: '2026-11-18', amount: '250000' },
  { id: '2', number: 'RCP-0002', customer: 'Amina Enterprises', method: 'Mobile Money', reference: 'MM-7781', paidAt: '2026-11-19', amount: '180000' },
]

test('filters receipts by number, customer, method, or reference', () => {
  assert.equal(typeof filterReceipts, 'function', 'receipt UI helper should expose filterReceipts')
  assert.deepEqual(filterReceipts(receipts, 'mobile').map((receipt) => receipt.number), ['RCP-0002'])
  assert.deepEqual(filterReceipts(receipts, 'creative').map((receipt) => receipt.number), ['RCP-0001'])
  assert.deepEqual(filterReceipts(receipts, 'mm-7781').map((receipt) => receipt.number), ['RCP-0002'])
  assert.deepEqual(filterReceipts(receipts, 'rcp-0001').map((receipt) => receipt.number), ['RCP-0001'])
})

test('sorts receipts by newest payment date without mutating the source list', () => {
  assert.equal(typeof sortReceipts, 'function', 'receipt UI helper should expose sortReceipts')
  assert.deepEqual(sortReceipts(receipts, 'newest').map((receipt) => receipt.number), ['RCP-0002', 'RCP-0001'])
  assert.deepEqual(receipts.map((receipt) => receipt.number), ['RCP-0001', 'RCP-0002'])
})

test('sorts receipts by numeric amount when requested', () => {
  assert.deepEqual(sortReceipts(receipts, 'amount-high').map((receipt) => receipt.number), ['RCP-0001', 'RCP-0002'])
  assert.deepEqual(sortReceipts(receipts, 'amount-low').map((receipt) => receipt.number), ['RCP-0002', 'RCP-0001'])
})

test('formats receipt dates as a stable day-month-year label', () => {
  assert.equal(typeof formatReceiptDate, 'function', 'receipt UI helper should expose formatReceiptDate')
  assert.equal(formatReceiptDate('2026-11-19'), '19 Nov 2026')
})

test('shows a placeholder for an unreadable receipt date', () => {
  assert.equal(formatReceiptDate(''), '—')
  assert.equal(formatReceiptDate('not-a-date'), '—')
})
