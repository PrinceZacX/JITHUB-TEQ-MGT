import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../components/dashboard.tsx', import.meta.url), 'utf8')
const start = source.indexOf("{section === 'Receipts' &&")
const end = source.indexOf("{section === 'Products & services'", start)
const registerBlock = start >= 0 && end > start ? source.slice(start, end) : ''

test('receipt register exposes client-side search and sorting', () => {
  assert.ok(registerBlock, 'receipt register block should exist in the dashboard')
  assert.match(source, /const visibleReceipts = useMemo\(/, 'dashboard should derive visible receipts with useMemo')
  assert.match(source, /filterReceipts\(data\.receipts, query\)/, 'visible receipts should use the receipt filter helper')
  assert.match(source, /sortReceipts\([^)]*receiptSort\)/, 'visible receipts should use the receipt sort helper')
  assert.match(registerBlock, /aria-label="Search receipts"/, 'receipt search should have an accessible label')
  assert.match(registerBlock, /aria-label="Sort receipts"/, 'receipt sort should have an accessible label')
  assert.match(registerBlock, /visibleReceipts\.map\(/, 'receipt table should render the filtered and sorted list')
  assert.match(registerBlock, /formatReceiptDate\(receipt\.paidAt\)/, 'receipt dates should use the stable date helper')
  assert.match(registerBlock, /query \? 'No receipts match your search\./, 'filtered empty state should be distinct from the no-data state')
})
