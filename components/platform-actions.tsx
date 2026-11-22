'use client'

import { authClient } from '@/lib/auth-client'

export function PlatformSignOutButton() {
  async function signOut() {
    const result = await authClient.signOut()
    if (!result.error) window.location.assign('/sign-in')
  }

  return (
    <button type="button" className="button-secondary" onClick={signOut}>
      Sign Out
    </button>
  )
}

export function OpenBusinessWorkspaceLink({ businessId }: { businessId: string }) {
  return (
    <a className="button-secondary text-sm" href={`/business/${encodeURIComponent(businessId)}`}>
      Open Workspace
    </a>
  )
}
