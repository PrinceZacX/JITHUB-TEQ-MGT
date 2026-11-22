import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { businesses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getPlatformDashboardData } from '@/app/actions/finance'

interface PlatformBusiness {
  id: string
  name: string
  city: string | null
  country: string
  currency: string
  status: string
  createdAt: Date
}

interface PlatformAuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  createdAt: Date
}

interface PlatformSummary {
  totalBusinesses: number
  totalUsers: number
  totalInvoiced: number
  totalReceived: number
  totalOutstanding: number
}

async function getPlatformData() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const data = await getPlatformDashboardData()
  return { session, data }
}

export default async function PlatformPage() {
  const { session, data } = await getPlatformData()

  return <PlatformDashboard user={{ name: session.user.name, email: session.user.email }} data={data} />
}

function PlatformDashboard({
  user,
  data,
}: {
  user: { name: string; email: string }
  data: {
    businesses: PlatformBusiness[]
    auditTrail: PlatformAuditEntry[]
    summary: PlatformSummary
  }
}) {
  const money = (value: number) => `UGX ${new Intl.NumberFormat('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value || 0)}`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Platform Administration</h1>
          <p className="text-muted-foreground">JITHUB-TEQ Platform Owner Workspace</p>
        </div>
        <div className="flex gap-2">
          <a href="/sign-in" className="button-secondary">Sign Out</a>
        </div>
      </div>

      {/* Platform Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg border bg-muted">
          <div className="text-xs text-muted-foreground mb-1">Total Businesses</div>
          <div className="text-2xl font-bold">{data.summary.totalBusinesses}</div>
        </div>
        <div className="p-4 rounded-lg border bg-muted">
          <div className="text-xs text-muted-foreground mb-1">Total Users</div>
          <div className="text-2xl font-bold">{data.summary.totalUsers}</div>
        </div>
        <div className="p-4 rounded-lg border bg-muted">
          <div className="text-xs text-muted-foreground mb-1">Total Invoiced</div>
          <div className="text-2xl font-bold">{money(data.summary.totalInvoiced)}</div>
        </div>
        <div className="p-4 rounded-lg border bg-muted">
          <div className="text-xs text-muted-foreground mb-1">Total Outstanding</div>
          <div className="text-2xl font-bold">{money(data.summary.totalOutstanding)}</div>
        </div>
      </div>

      {/* Business Selection */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-4">Registered Businesses</h2>
        {data.businesses.length === 0 ? (
          <div className="p-4 rounded-lg border bg-muted text-muted-foreground">
            No businesses registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="pb-2 text-sm font-medium text-muted-foreground">City</th>
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Country</th>
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Currency</th>
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.businesses.map((b) => (
                  <tr key={b.id} className="border-b hover:bg-muted/50">
                    <td className="py-3">{b.name}</td>
                    <td className="py-3">{b.city || '—'}</td>
                    <td className="py-3">{b.country}</td>
                    <td className="py-3">{b.currency}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        b.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <a
                        href={`/business/${b.id}`}
                        className="button-secondary text-sm"
                      >
                        Open Workspace
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Platform Audit Trail */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-4">Platform Audit Trail</h2>
        {data.auditTrail.length === 0 ? (
          <div className="p-4 rounded-lg border bg-muted text-muted-foreground">
            No platform audit events yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Action</th>
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Entity Type</th>
                  <th className="pb-2 text-sm font-medium text-muted-foreground">Entity ID</th>
                </tr>
              </thead>
              <tbody>
                {data.auditTrail.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="py-3">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="py-3">{entry.action}</td>
                    <td className="py-3">{entry.entityType}</td>
                    <td className="py-3">{entry.entityId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
