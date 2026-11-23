'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'

export function AuthScreen({ authAvailable }: { authAvailable: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  async function handleForgotPassword() {
    const emailInput = formRef.current?.elements.namedItem('email')
    if (!(emailInput instanceof HTMLInputElement) || !emailInput.reportValidity()) return

    setError('')
    setResetMessage('')
    setPending(true)
    let requestFailed = false
    try {
      await authClient.requestPasswordReset({ email: emailInput.value.trim(), redirectTo: `${window.location.origin}/reset-password` })
    } catch {
      requestFailed = true
    } finally {
      setPending(false)
      if (requestFailed) setError('Password recovery could not be started. Please try again later.')
      else setResetMessage('If an account exists for that email, password recovery instructions will be sent when email delivery is configured.')
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    const name = String(form.get('name') || '').trim()

    try {
      const result = mode === 'sign-up'
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password })

      if (result.error) {
        const code = result.error.code || 'AUTH_FAILED'
        setError(`Sign-in failed (${code}). Check your details or contact the platform administrator.`)
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('The authentication service did not return a valid response. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return <main className="auth-screen">
    <section className="auth-brand-panel">
      <a className="brand-lockup brand-lockup-light" href="/" aria-label="JITHUB-TEQ home"><span className="brand-mark">J</span><span>JITHUB<span className="brand-dash">-</span>TEQ</span></a>
      <div className="auth-brand-copy"><span className="eyebrow">FINANCE, WITH CLARITY</span><h1>Make every<br/>transaction<br/><em>count.</em></h1><p>One clear view of your invoices, payments and the people behind them.</p></div>
      <div className="trust-note"><ShieldCheck size={17}/><span>Secure, private business workspace</span></div>
      <div className="auth-orbit orbit-one"/><div className="auth-orbit orbit-two"/>
    </section>
    <section className="auth-form-panel">
      <div className="auth-topline"><span>Beyond Technology, We Build Trust.</span><span>UGANDA · UGX</span></div>
      <div className="auth-card">
        <div className="auth-mobile-brand"><span className="brand-mark">J</span><strong>JITHUB-TEQ</strong></div>
        <div className="auth-heading"><span className="eyebrow">YOUR BUSINESS, IN BALANCE</span><h2>{mode === 'sign-in' ? 'Welcome back' : 'Create your workspace'}</h2><p>{mode === 'sign-in' ? 'Sign in to manage your financial operations.' : 'Get started with your business account.'}</p></div>
        {!authAvailable && <p className="auth-config-warning" role="alert">Sign-in is paused until a secure session key is configured. Replace <code>BETTER_AUTH_SECRET</code> in project Vars with a random value at least 32 characters long.</p>}
        <form ref={formRef} onSubmit={handleSubmit} className="auth-form">
          {mode === 'sign-up' && <label>Full name<input name="name" autoComplete="name" placeholder="Grace Nambasa" required minLength={2}/></label>}
          <label>Email address<span className="input-icon"><Mail size={17}/><input name="email" type="email" autoComplete="email" placeholder="name@business.com" required/></span></label>
          <label>Password<span className="input-icon"><LockKeyhole size={17}/><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" minLength={8} required/><button className="reveal-password" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center'}}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          {mode === 'sign-in' && (
  <div className="auth-options">
    <label className="remember-option">
      <input type="checkbox" name="remember"/>
      <span style={{width: 20, height: 20, display: 'grid', placeItems: 'center'}}><Check size={11}/></span>
      Remember me
    </label>
    <button type="button" className="text-button" onClick={handleForgotPassword} disabled={pending || !authAvailable}>
      Forgot password?
    </button>
  </div>
)}
          {error && <p className="form-error" role="alert">{error}</p>}
          {resetMessage && <p className="auth-config-warning" role="status">{resetMessage}</p>}
          <button className="primary-button auth-submit" disabled={pending || !authAvailable}>{pending ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}<ArrowRight size={17}/></button>
        </form>
        <p className="auth-switch">{mode === 'sign-in' ? 'New to JITHUB-TEQ?' : 'Already have an account?'} <button className="text-button" disabled={!authAvailable} onClick={() => {setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError('')}}>{mode === 'sign-in' ? 'Create account' : 'Sign in'}</button></p>
        <div className="auth-security"><ShieldCheck size={14}/>Your data is protected with encrypted sessions</div>
      </div>
      <p className="auth-footer">© 2026 JITHUB-TEQ Ltd <span>·</span> Beyond Technology, We Build Trust.</p>
    </section>
  </main>
}