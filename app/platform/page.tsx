import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { businesses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getPlatformDashboardData } from '@/app/actions/finance';

interface PlatformBusiness {
  id: string;
  name: string;
  city: string | null;
  country: string;
  currency: string;
  status: string;
  createdAt: Date;
}

interface PlatformAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
}

interface PlatformSummary {
  totalBusinesses: number;
  totalUsers: number;
  totalInvoiced: number;
  totalReceived: number;
  totalOutstanding: number;
}

async function getPlatformData() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const data = await getPlatformDashboardData();
  return { session, data };
}

export default async function PlatformPage() {
  const { session, data } = await getPlatformData();

  return (
    <PlatformDashboard user={{ name: session.user.name, email: session.user.email }} data={data} />
  );
}

function PlatformDashboard({
  user,
  data,
}: {
  user: { name: string; email: string };
  data: {
    businesses: PlatformBusiness[];
    auditTrail: PlatformAuditEntry[];
    summary: PlatformSummary;
  };
}) {
  const money = (value: number) =>
    `UGX ${new Intl.NumberFormat('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value || 0)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Platform Administration</h1>
          <p className="text-jt-muted text-sm">JITHUB-TEQ Platform Owner Workspace</p>
        </div>
        <div className="flex gap-3">
          <a href="/sign-in" className="text-sm font-medium text-jt-primary underline underline-offset-4">
            Sign Out
          </a>
        </div>
      </div>

      {/* Platform Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                Total Businesses
              </p>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-sm">
                  {data.summary.totalBusinesses}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                Total Users
              </p>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <span className="text-green-600 font-semibold text-sm">
                  {data.summary.totalUsers}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                Total Invoiced
              </p>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <span className="text-indigo-600 font-semibold text-sm">
                  {money(data.summary.totalInvoiced)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                Total Outstanding
              </p>
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <span className="text-rose-600 font-semibold text-sm">
                  {money(data.summary.totalOutstanding)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Selection */}
      <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
        <div className="p-6 border-b border-jt-border/50">
          <h2 className="text-lg font-semibold text-jt-text">Registered Businesses</h2>
        </div>
        <div className="p-6">
          {data.businesses.length === 0 ? (
            <div className="p-4 rounded-lg border bg-muted text-muted-foreground">
              No businesses registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-jt-border/50 bg-jt-surface/50 sticky top-0 z-10">
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      City
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      Currency
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jt-border/50">
                  {data.businesses.map((b) => (
                    <tr key={b.id} className="hover:bg-jt-surface/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-jt-text truncate block">
                        {b.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[100px]">
                        {b.city || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-jt-text">{b.country}</td>
                      <td className="px-4 py-3 text-sm text-jt-text">{b.currency}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block ${
                            b.status === 'active'
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-rose-100 text-rose-700 border-rose-200'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/business/members/${b.id}`}
                          className="text-sm font-medium text-jt-primary underline underline-offset-4 hover:text-jt-teal-dark"
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
      </section>

      {/* Platform Audit Trail */}
      <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
        <div className="p-6 border-b border-jt-border/50">
          <h2 className="text-lg font-semibold text-jt-text">Platform Audit Trail</h2>
        </div>
        <div className="p-6">
          {data.auditTrail.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-jt-muted mb-4">No platform audit events yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-jt-border/50 bg-jt-surface/50 sticky top-0 z-10">
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      Entity Type
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                      Entity ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jt-border/50">
                  {data.auditTrail.map((entry) => (
                    <tr key={entry.id} className="hover:bg-jt-surface/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-jt-muted">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-jt-text">{entry.action}</td>
                      <td className="px-4 py-3 text-sm text-jt-text">{entry.entityType}</td>
                      <td className="px-4 py-3 text-sm text-jt-text">{entry.entityId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
