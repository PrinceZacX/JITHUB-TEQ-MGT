import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

test('receipt dialog has native backdrop styling and print rules', () => {
  assert.match(css, /dialog\.receipt-dialog\s*\{/, 'native receipt dialog should be styled directly')
  assert.match(css, /dialog\.receipt-dialog::backdrop\s*\{/, 'native receipt dialog should style its backdrop')
  assert.match(css, /@media print\s*\{[\s\S]*dialog\.receipt-dialog/, 'receipt dialog should have print rules')
  assert.doesNotMatch(css, /\.receipt-backdrop/, 'obsolete wrapper backdrop styles should be removed')
})
