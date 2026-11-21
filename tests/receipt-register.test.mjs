import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../components/dashboard.tsx', import.meta.url), 'utf8')
const start = source.indexOf("{section === 'Receipts' &&")
const end = source.indexOf("{section === 'Products & services'", start)
const registerBlock = start >= 0 && end > start ? source.slice(start, end) : ''

test('catalogue creation stays enabled when no existing item is selected', () => {
  assert.match(source, /modal === 'catalogue' \? \(selectedCatalogue \? 'Edit catalogue item' : 'Add catalogue item'\)/, 'catalogue dialog should support both create and edit states')
  assert.doesNotMatch(source, /modal === 'catalogue' && !String\(selectedCatalogue\?\.id \|\| ''\)/, 'catalogue create action should not be disabled when there is no selected item')
})

test('customers can be edited through a user-scoped audited server action', () => {
  assert.match(source, /function CustomerTable\(\{ customers, onEdit \}/, 'customer rows should expose edit actions')
  assert.match(source, /updateCustomer\(\{ id: selectedCustomer\.id, \.\.\.customerInput \}\)/, 'customer dialog should submit edits')
  const actions = fs.readFileSync(new URL('../app/actions/finance.ts', import.meta.url), 'utf8')
  assert.match(actions, /export async function updateCustomer\(/, 'customer update action should exist')
  assert.match(actions, /eq\(customers\.id, input\.id\), eq\(customers\.userId, userId\)/, 'customer updates should be scoped to the signed-in user')
  assert.match(actions, /customer\.updated/, 'customer updates should be audited')
})

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
