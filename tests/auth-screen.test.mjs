import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const authScreen = fs.readFileSync(new URL('../components/auth-screen.tsx', import.meta.url), 'utf8')

test('sign-in displays the Better Auth error code without exposing credentials', () => {
  assert.match(authScreen, /result\.error\.code \|\| 'AUTH_FAILED'/)
  assert.match(authScreen, /Sign-in failed \(\$\{code\}\)/)
  assert.doesNotMatch(authScreen, /console\.(log|error).*password/i)
})

test('sign-in always clears pending state after an authentication response or exception', () => {
  assert.match(authScreen, /try \{[\s\S]*authClient\.signIn\.email[\s\S]*finally \{\s*setPending\(false\)/)
  assert.match(authScreen, /catch \{\s*setError\('The authentication service did not return a valid response\./)
})
