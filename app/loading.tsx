export default function Loading() {
  return (
    <div className="app-shell" aria-busy="true" aria-live="polite">
      <aside className="app-sidebar" aria-hidden="true">
        <div className="brand-lockup"><span className="brand-mark">J</span><span>JITHUB<span className="brand-dash">-</span>TEQ</span></div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>JITHUB-TEQ</span><span className="breadcrumb-slash">/</span><strong>Loading</strong></div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="skeleton-line skeleton-line-short" aria-hidden="true" />
              <div className="skeleton-line skeleton-line-heading" style={{ marginTop: 12, height: 28 }} aria-hidden="true" />
              <div className="skeleton-line" style={{ marginTop: 10, width: '55%' }} aria-hidden="true" />
            </div>
          </div>
          <section className="metric-grid" aria-label="Loading dashboard">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="metric-card skeleton-card">
                <div className="skeleton-line skeleton-line-short" />
                <div className="skeleton-line skeleton-line-value" />
                <div className="skeleton-line skeleton-line-note" />
              </div>
            ))}
          </section>
          <section className="dashboard-grid">
            <div className="panel trend-panel">
              <div className="skeleton-line skeleton-line-short" />
              <div className="skeleton-block" style={{ marginTop: 16 }} />
            </div>
            <div className="panel action-panel">
              <div className="skeleton-line skeleton-line-short" />
              <div className="skeleton-block" style={{ marginTop: 16 }} />
            </div>
          </section>
          <span className="sr-only">Loading your workspace…</span>
        </div>
      </main>
    </div>
  )
}
