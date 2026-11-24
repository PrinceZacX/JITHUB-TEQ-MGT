'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { createBusiness } from '@/app/actions/finance';

export function NoBusinessPrompt({ message }: { message: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    city: 'Kampala',
    country: 'Uganda',
    currency: 'UGX',
    email: '',
    phone: '',
    address: '',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createBusiness({
        name: form.name,
        city: form.city,
        country: form.country,
        currency: form.currency,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create business.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-form-panel" style={{ margin: '0 auto', maxWidth: 560 }}>
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow">GET STARTED</span>
            <h2>Create your business</h2>
            <p>
              You do not have an active business workspace yet. Create one to start managing
              invoices, payments and receipts.
            </p>
          </div>
          <p className="form-error" role="status">
            {message}
          </p>

          {!open ? (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button className="primary-button" onClick={() => setOpen(true)}>
                Create a business
              </button>
              <button
                className="button-secondary"
                onClick={async () => {
                  await authClient.signOut();
                  router.push('/sign-in');
                  router.refresh();
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="auth-form" style={{ marginTop: 16 }}>
              <label>
                Business name
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="JITHUB-TEQ Ltd"
                />
              </label>
              <label>
                City
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </label>
              <label>
                Country
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </label>
              <label>
                Currency
                <input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@business.com"
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                Address
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? 'Creating…' : 'Create business'}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <p className="auth-footer">
            Contact your administrator if you expected access to an existing workspace.
          </p>
        </div>
      </section>
    </main>
  );
}
