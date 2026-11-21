import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JITHUB-TEQ | Receipting & Invoicing',
  description: 'A secure workspace for invoices, receipts, customer accounts and business reporting.',
  generator: 'JITHUB-TEQ',
  icons: {
    icon: '/jithub-teq-logo.png',
    apple: '/jithub-teq-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#10243A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
