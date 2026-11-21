import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const email = read('../lib/email.ts')
const auth = read('../lib/auth.ts')
const authScreen = read('../components/auth-screen.tsx')
const resetForm = read('../components/password-reset-form.tsx')
const readme = read('../README.md')

test('SMTP delivery is optional and only reads credentials in server-side mail code', () => {
  assert.match(email, /process\.env\.SMTP_HOST/)
  assert.match(email, /process\.env\.SMTP_PASSWORD/)
  assert.match(email, /SMTP is not configured or configuration is incomplete/)
  assert.match(email, /delivery failed/)
  assert.doesNotMatch(authScreen, /SMTP_PASSWORD|SMTP_USER/)
})

test('authentication supports verification and password recovery without requiring verified email to sign in', () => {
  assert.match(auth, /requireEmailVerification:\s*false/)
  assert.match(auth, /sendOnSignUp:\s*true/)
  assert.match(auth, /sendResetPassword:/)
  assert.match(authScreen, /requestPasswordReset/)
  assert.match(resetForm, /resetPassword/)
})

test('mail helper supports invitations and account security notifications', () => {
  assert.match(email, /export async function sendInvitationEmail/)
  assert.match(email, /export async function sendSecurityNotification/)
  assert.match(auth, /sendSecurityNotification/)
})

test('production email configuration is documented without requiring a paid provider', () => {
  assert.match(readme, /SMTP_HOST/)
  assert.match(readme, /SMTP_FROM/)
  assert.match(readme, /SMTP_PASSWORD/)
  assert.match(readme, /does not require Resend or another paid transactional-email service/)
})
