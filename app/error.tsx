'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-content">
      <div className="panel empty-panel error-panel" role="alert">
        <span className="empty-icon" aria-hidden="true">
          !
        </span>
        <h1>Something didn&apos;t load</h1>
        <p>
          We couldn&apos;t load this part of your workspace right now. Your data is safe. Please try
          again, and if the problem continues, check your connection or sign in again.
        </p>
        <div className="heading-actions" style={{ marginTop: 8, justifyContent: 'center' }}>
          <button type="button" className="primary-button" onClick={() => reset()}>
            Try again
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => window.location.assign('/sign-in')}
          >
            Go to sign-in
          </button>
        </div>
      </div>
    </div>
  );
}
