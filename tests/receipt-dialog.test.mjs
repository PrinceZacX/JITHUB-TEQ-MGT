import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../components/dashboard.tsx', import.meta.url), 'utf8')
const start = source.indexOf('{selectedReceipt &&')
const end = source.indexOf('{toast &&', start)
const receiptBlock = start >= 0 && end > start ? source.slice(start, end) : ''
const dialogStart = source.indexOf('function ReceiptDialog')
const dialogImpl = dialogStart >= 0 ? source.slice(dialogStart) : ''

test('receipt detail uses a native dialog with focus, Escape, and scroll handling', () => {
  assert.ok(receiptBlock, 'receipt detail block should exist in the dashboard')
  assert.match(receiptBlock, /<ReceiptDialog\b/, 'receipt detail should render the dedicated dialog component')
  assert.doesNotMatch(receiptBlock, /role="dialog"/, 'receipt detail must not duplicate role="dialog"')
  assert.doesNotMatch(receiptBlock, /aria-modal="true"/, 'receipt detail must not duplicate aria-modal')

  assert.match(dialogImpl, /<dialog\b/, 'receipt dialog should use the native dialog element')
  assert.doesNotMatch(dialogImpl, /role="dialog"/, 'native dialog must not duplicate role="dialog"')
  assert.doesNotMatch(dialogImpl, /aria-modal="true"/, 'native dialog must not duplicate aria-modal')
  assert.match(dialogImpl, /showModal\(\)/, 'receipt dialog should open modally')
  assert.match(dialogImpl, /document\.body\.style\.overflow/, 'receipt dialog should prevent page scroll behind it')
  assert.match(dialogImpl, /addEventListener\('cancel'/, 'receipt dialog should handle Escape dismissal')
})
