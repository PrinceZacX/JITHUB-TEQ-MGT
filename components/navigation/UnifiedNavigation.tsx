'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MobileBottomNav } from './MobileBottomNav'
import { TabletNavRail } from './TabletNavRail'
import { DesktopSidebar } from './DesktopSidebar'

interface UnifiedNavigationProps {
  user: { name: string; email: string }
  data: any
  section: string
  setSection: (section: string) => void
  setSidebarOpen: (open: boolean) => void
  badgeCounts?: Record<string, number>
  onSearchOpen?: () => void
}

export function UnifiedNavigation({
  user,
  data,
  section,
  setSection,
  setSidebarOpen,
  badgeCounts = {},
  onSearchOpen,
}: UnifiedNavigationProps) {
  const pathname = usePathname()
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth
      if (width < 640) setViewport('mobile')
      else if (width < 1024) setViewport('tablet')
      else setViewport('desktop')
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  // Handle section changes from navigation components
  const handleSectionChange = (newSection: string) => {
    setSection(newSection)
  }

  // For mobile/tablet, we need to handle section changes from the nav components
  // The desktop sidebar handles this internally via the parent's setSection

  return (
    <>
      {/* Mobile: Bottom Navigation */}
      <MobileBottomNav
        badgeCounts={badgeCounts}
        className="lg:hidden"
      />

      {/* Tablet: Navigation Rail */}
      <TabletNavRail
        badgeCounts={badgeCounts}
        onSearchOpen={() => { /* TODO: open search */ }}
        className="hidden lg:block tablet:block max-lg:hidden"
      />

      {/* Desktop: Sidebar */}
      <DesktopSidebar
        user={user}
        data={data}
        section={section}
        setSection={setSection}
        setSidebarOpen={() => {}}
        className="hidden lg:block"
      />
    </>
  )
}

export { NavigationConfig } from './NavigationConfig'
export type { NavigationItem } from './NavigationConfig'
export { NAVIGATION_CONFIG, BREAKPOINTS, NAVIGATION_STRUCTURE, SEARCH_CONFIG, EMPTY_STATES, WORKFLOW_STEPS } from './NavigationConfig'