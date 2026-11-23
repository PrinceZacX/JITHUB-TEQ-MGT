import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getDashboardData } from '@/app/actions/finance'
import { Dashboard } from '@/components/dashboard'
import { NoBusinessPrompt } from '@/components/no-business-prompt'

export default async function Page() {
  const session = await getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  // Platform owners can still access the workspace dashboard directly.
  // (Platform administration remains available at /platform.)

  // Ordinary business user - load business-scoped dashboard
  try {
    const data = await getDashboardData()
    return <Dashboard user={{ name: session.user.name, email: session.user.email }} data={data} />
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load your workspace.'
    if (message.toLowerCase().includes('not a member of an active business') ||
        message.toLowerCase().includes('please select a business')) {
      return <NoBusinessPrompt message={message} />
    }
    throw error
  }
}
