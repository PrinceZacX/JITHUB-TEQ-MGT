'use client'

import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function NoBusinessPrompt({ message }: { message: string }) {
  const router = useRouter()
  return (
    <main className="auth-screen">
      <section className="auth-form-panel" style={{ margin: '0 auto', maxWidth: 560 }}>
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow">GET STARTED</span>
            <h2>Create your business</h2>
            <p>You do not have an active business workspace yet. Create one to start managing invoices, payments and receipts.</p>
          </div>
          <p className="form-error" role="status">{message}</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="button-secondary" onClick={async () => { await authClient.signOut(); router.push('/sign-in'); router.refresh() }}>Sign out</button>
          </div>
          <p className="auth-footer">Contact your administrator if you expected access to an existing workspace.</p>
        </div>
      </section>
    </main>
  )
}
