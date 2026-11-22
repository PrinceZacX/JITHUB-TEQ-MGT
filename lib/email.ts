import nodemailer from 'nodemailer'

type EmailMessage = {
  kind: string
  to: string
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!)
}

function getSmtpConfiguration() {
  const host = process.env.SMTP_HOST?.trim()
  const from = process.env.SMTP_FROM?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD
  const secureValue = process.env.SMTP_SECURE?.toLowerCase()

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) return null
  if (Boolean(user) !== Boolean(password)) return null
  if (secureValue && secureValue !== 'true' && secureValue !== 'false') return null

  return {
    host,
    from,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE.toLowerCase() === 'true' : port === 465,
    auth: user && password ? { user, pass: password } : undefined,
  }
}

async function sendEmail(message: EmailMessage) {
  const configuration = getSmtpConfiguration()
  if (!configuration) {
    console.warn(`[email] ${message.kind} not sent: SMTP is not configured or configuration is incomplete.`)
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      auth: configuration.auth,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
    await transporter.sendMail({
      from: configuration.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    console.info(`[email] ${message.kind} delivered.`)
    return true
  } catch (error) {
    const reason = error instanceof Error ? (error as NodeJS.ErrnoException).code || error.name : 'Unknown error'
    console.error(`[email] ${message.kind} delivery failed (${reason}).`)
    return false
  }
}

export async function sendVerificationEmail(to: string, url: string) {
  const safeUrl = escapeHtml(url)
  return sendEmail({
    kind: 'verification',
    to,
    subject: 'Verify your JITHUB-TEQ email',
    text: `Verify your email address by opening this link: ${url}`,
    html: `<p>Verify your email address to secure your JITHUB-TEQ account.</p><p><a href="${safeUrl}">Verify email address</a></p>`,
  })
}

export async function sendPasswordRecoveryEmail(to: string, url: string) {
  const safeUrl = escapeHtml(url)
  return sendEmail({
    kind: 'password recovery',
    to,
    subject: 'Reset your JITHUB-TEQ password',
    text: `Reset your password by opening this link: ${url}`,
    html: `<p>A password reset was requested for your JITHUB-TEQ account.</p><p><a href="${safeUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  })
}

export async function sendInvitationEmail(input: { to: string; inviterName: string; invitationUrl: string }) {
  const inviter = escapeHtml(input.inviterName)
  const url = escapeHtml(input.invitationUrl)
  return sendEmail({
    kind: 'invitation',
    to: input.to,
    subject: 'You are invited to JITHUB-TEQ',
    text: `${input.inviterName} invited you to join their JITHUB-TEQ workspace: ${input.invitationUrl}`,
    html: `<p>${inviter} invited you to join their JITHUB-TEQ workspace.</p><p><a href="${url}">Accept invitation</a></p>`,
  })
}

export async function sendSecurityNotification(input: { to: string; subject: string; message: string }) {
  const subject = input.subject.trim().slice(0, 160) || 'Account security update'
  const message = input.message.trim().slice(0, 4000)
  return sendEmail({
    kind: 'security notification',
    to: input.to,
    subject: `JITHUB-TEQ security: ${subject}`,
    text: message,
    html: `<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`,
  })
}

export async function sendInvoiceEmail(input: { to: string; invoiceNumber: string; amount: string; currency: string; dueDate: string; pdfUrl: string }) {
  const url = escapeHtml(input.pdfUrl)
  return sendEmail({
    kind: 'invoice',
    to: input.to,
    subject: `Invoice ${input.invoiceNumber} from JITHUB-TEQ`,
    text: `Your invoice ${input.invoiceNumber} for ${formatMoney(input.amount, input.currency)} is due on ${input.dueDate}. Download the PDF: ${input.pdfUrl}`,
    html: `<p>Your invoice <strong>${input.invoiceNumber}</strong> for <strong>${formatMoney(input.amount, input.currency)}</strong> is due on ${input.dueDate}.</p><p><a href="${url}">Download invoice PDF</a></p>`,
  })
}

export async function sendReceiptEmail(input: { to: string; receiptNumber: string; amount: string; currency: string; paidAt: string; pdfUrl: string }) {
  const url = escapeHtml(input.pdfUrl)
  return sendEmail({
    kind: 'receipt',
    to: input.to,
    subject: `Receipt ${input.receiptNumber} from JITHUB-TEQ`,
    text: `Your receipt ${input.receiptNumber} for ${formatMoney(input.amount, input.currency)} was received on ${input.paidAt}. Download the PDF: ${input.pdfUrl}`,
    html: `<p>Your receipt <strong>${input.receiptNumber}</strong> for <strong>${formatMoney(input.amount, input.currency)}</strong> was received on ${input.paidAt}.</p><p><a href="${url}">Download receipt PDF</a></p>`,
  })
}

function formatMoney(value: string, currency: string): string {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
