import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getDashboardData } from '@/app/actions/finance'
import { Dashboard } from '@/components/dashboard'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  // Check if the user is a platform owner
  const [userRow] = await db
    .select({ platformOwner: user.platformOwner })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (userRow?.platformOwner) {
    redirect('/platform')
  }

  // Ordinary business user - load business-scoped dashboard
  const data = await getDashboardData()
  return <Dashboard user={{ name: session.user.name, email: session.user.email }} data={data} />
}
