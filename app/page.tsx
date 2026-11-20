import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDashboardData } from '@/app/actions/finance'
import { Dashboard } from '@/components/dashboard'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const data = await getDashboardData()
  return <Dashboard user={{ name: session.user.name, email: session.user.email }} data={data}/>
}
