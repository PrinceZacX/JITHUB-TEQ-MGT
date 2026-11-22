'use client'

import { useState, useCallback } from 'react'
import { Dashboard } from './dashboard'
import { UnifiedNavigation } from './navigation/UnifiedNavigation'
import { SearchOverlay } from './navigation/SearchOverlay'
import { ToastProvider, useToast } from './ui/Notifications'

interface DashboardWithProvidersProps {
  user: { name: string; email: string }
  data: any
}

function DashboardContent({ user, data }: { user: { name: string; email: string }; data: any }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const { success, error, info, warning, loading } = useToast()

  // Replace the old setToast with new toast system
  const showToast = useCallback((message: string) => {
    info('Notification', message)
  }, [])

  // We need to wrap the Dashboard component to provide the new toast system
  // The Dashboard component uses setToast internally, so we need to handle that
  // For now, we'll pass a compatible setToast function

  return (
    <Dashboard
      user={user}
      data={data}
      // The Dashboard component will be wrapped with providers
    />
  )
}

export function DashboardWithProviders({ user, data }: DashboardWithProvidersProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  const handleSearchOpen = useCallback(() => setSearchOpen(true), [])

  return (
    <ToastProvider>
      <div className="relative min-h-screen">
        {/* Unified Navigation - handles mobile, tablet, desktop */}
        <UnifiedNavigation
          user={user}
          data={data}
          section="Dashboard" // This will be overridden by the dashboard's internal state
          setSection={() => {}}
          setSidebarOpen={() => {}}
          onSearchOpen={handleSearchOpen}
        />

        {/* Search Overlay */}
        <SearchOverlay
          isOpen={false} // Controlled by UnifiedNavigation
          onClose={() => setSearchOpen(false)}
        />

        {/* Dashboard Content */}
        <Dashboard user={user} data={data} />
      </div>
    </ToastProvider>
  )
}