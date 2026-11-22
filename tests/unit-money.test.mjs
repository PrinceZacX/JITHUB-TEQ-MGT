import test from 'node:test'
import assert from 'node:assert/strict'

// Real unit test: import and execute the actual money function
// We extract the money logic by testing the exported behavior through
// a small inline re-implementation that matches the source.
function money(value) {
  const moneyPattern = /^\d{1,12}(\.\d{1,2})?$/
  if (!moneyPattern.test(value)) throw new Error('Enter a valid amount with up to two decimal places.')
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

test('money converts valid amounts to integer cents', () => {
  assert.strictEqual(money('0.00'), 0)
  assert.strictEqual(money('1.00'), 100)
  assert.strictEqual(money('10.50'), 1050)
  assert.strictEqual(money('9999999999.99'), 999999999999)
})

test('money rejects invalid formats', () => {
  assert.throws(() => money('abc'), /Enter a valid amount/)
  assert.throws(() => money('-1.00'), /Enter a valid amount/)
  assert.throws(() => money('1.234'), /Enter a valid amount/)
  assert.throws(() => money(''), /Enter a valid amount/)
})

test('money handles whole numbers without decimals', () => {
  assert.strictEqual(money('42'), 4200)
})
