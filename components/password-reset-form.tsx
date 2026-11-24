'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export function PasswordResetForm({ token }: { token?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');

    if (!token) {
      setPending(false);
      setError('This reset link is invalid or expired. Request a new one from the sign-in page.');
      return;
    }

    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (result.error) {
      setError('This reset link is invalid or expired. Request a new one from the sign-in page.');
      return;
    }
    setMessage('Your password has been updated. You can now sign in.');
    window.setTimeout(() => router.push('/sign-in'), 900);
  }

  return (
    <main className="auth-screen">
      <section className="auth-brand-panel">
        <a className="brand-lockup brand-lockup-light" href="/" aria-label="JITHUB-TEQ home">
          <span className="brand-mark">J</span>
          <span>
            JITHUB<span className="brand-dash">-</span>TEQ
          </span>
        </a>
        <div className="auth-brand-copy">
          <span className="eyebrow">ACCOUNT SECURITY</span>
          <h1>
            Protect your
            <br />
            business
            <br />
            <em>access.</em>
          </h1>
          <p>Choose a strong password to secure your financial workspace.</p>
        </div>
        <div className="trust-note">
          <ShieldCheck size={17} />
          <span>Secure, private business workspace</span>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-topline">
          <span>Beyond Technology, We Build Trust.</span>
          <span>UGANDA · UGX</span>
        </div>
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow">PASSWORD RECOVERY</span>
            <h2>Choose a new password</h2>
            <p>Use at least 8 characters for your new password.</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              New password
              <span className="input-icon">
                <LockKeyhole size={17} />
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="auth-config-warning" role="status">
                {message}
              </p>
            )}
            <button className="primary-button auth-submit" disabled={pending}>
              {pending ? 'Please wait…' : 'Update password'}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            <a className="text-button" href="/sign-in">
              Return to sign in
            </a>
          </p>
          <div className="auth-security">
            <ShieldCheck size={14} />
            Your data is protected with encrypted sessions
          </div>
        </div>
        <p className="auth-footer">
          © 2026 JITHUB-TEQ Ltd <span>·</span> Beyond Technology, We Build Trust.
        </p>
      </section>
    </main>
  );
}
