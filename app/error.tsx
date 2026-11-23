'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const errorMessage = error.message.toLowerCase()
  const isDatabaseError =
    errorMessage.includes('database_url') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('password authentication failed')

  return (
    <div className="page-content">
      <div className="panel empty-panel error-panel" role="alert">
        <span className="empty-icon" aria-hidden="true">!</span>
        <h1>{isDatabaseError ? 'Workspace database unavailable' : "Something didn't load"}</h1>
        <p>
          {isDatabaseError
            ? 'The app cannot reach its configured PostgreSQL database. Restore the intended staging DATABASE_URL in this project’s environment settings, then retry. This request did not change your data.'
            : 'We couldn’t load this part of your workspace right now. Please try again, and if the problem continues, check your connection or sign in again.'}
        </p>
        <div className="heading-actions" style={{ marginTop: 8, justifyContent: 'center' }}>
          <button type="button" className="primary-button" onClick={() => reset()}>
            Try again
          </button>
          {!isDatabaseError && (
            <button type="button" className="button-secondary" onClick={() => window.location.assign('/sign-in')}>
              Go to sign-in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
