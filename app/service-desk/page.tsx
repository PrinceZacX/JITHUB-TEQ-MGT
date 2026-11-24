'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Users,
  TicketPlus,
  FileText as FileTextIcon,
  Settings,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
  listServiceTickets,
  listServiceLevelPolicies,
  listBusinessInvitations,
} from '@/app/actions/service-desk';
import { StatCard } from '@/components/service-desk/StatCard';

export default function ServiceDeskDashboardPage() {
  const [stats, setStats] = useState({
    openTickets: 0,
    inProgressTickets: 0,
    resolvedToday: 0,
    pendingInvitations: 0,
    activeClients: 0,
    slaBreaches: 0,
  });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [tickets, policiesData, invitations] = await Promise.all([
        listServiceTickets({ limit: 50 }),
        listServiceLevelPolicies(),
        listBusinessInvitations(),
      ]);

      const open = tickets.filter((t) => t.status === 'open').length;
      const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
      const resolved = tickets.filter(
        (t) =>
          t.status === 'resolved' &&
          t.resolvedAt &&
          new Date(t.resolvedAt).toDateString() === new Date().toDateString(),
      ).length;
      const pendingInvites = invitations.filter((i) => i.status === 'pending').length;
      const activeClients = new Set(tickets.map((t) => t.customerId)).size;
      const slaBreaches = 0;

      setStats({
        openTickets: open,
        inProgressTickets: inProgress,
        resolvedToday: resolved,
        pendingInvitations: pendingInvites,
        activeClients,
        slaBreaches,
      });
      setRecentTickets(tickets.slice(0, 5));
      setPolicies(policiesData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const statCards = [
    {
      label: 'Open Tickets',
      value: stats.openTickets,
      icon: FileTextIcon,
      color: 'bg-blue-100 text-blue-600 border border-blue-200',
      href: '/service-desk/tickets?status=open',
    },
    {
      label: 'In Progress',
      value: stats.inProgressTickets,
      icon: AlertTriangle,
      color: 'bg-amber-100 text-amber-600 border border-amber-200',
      href: '/service-desk/tickets?status=in_progress',
    },
    {
      label: 'Resolved Today',
      value: stats.resolvedToday,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600 border border-green-200',
      href: '/service-desk/tickets?status=resolved',
    },
    {
      label: 'Pending Invitations',
      value: stats.pendingInvitations,
      icon: Users,
      color: 'bg-purple-100 text-purple-600 border border-purple-200',
      href: '/service-desk/clients',
    },
    {
      label: 'Active Clients',
      value: stats.activeClients,
      icon: Building2,
      color: 'bg-indigo-100 text-indigo-600 border border-indigo-200',
      href: '/service-desk/clients',
    },
    {
      label: 'SLA Breaches',
      value: stats.slaBreaches,
      icon: Clock,
      color: 'bg-rose-100 text-rose-600 border border-rose-200',
      href: '/service-desk/tickets',
    },
  ];

  const quickActions = [
    {
      label: 'Create Ticket',
      href: '/service-desk/tickets/new',
      icon: TicketPlus,
      color: 'bg-blue-600 text-white',
    },
    {
      label: 'Invite Client',
      href: '/service-desk/clients',
      icon: Users,
      color: 'bg-green-600 text-white',
    },
    {
      label: 'Manage SLA Policies',
      href: '/service-desk/settings',
      icon: Settings,
      color: 'bg-purple-600 text-white',
    },
    {
      label: 'View All Tickets',
      href: '/service-desk/tickets',
      icon: FileTextIcon,
      color: 'bg-indigo-600 text-white',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Service Desk Dashboard</h1>
          <p className="text-jt-muted text-sm">Internal management portal</p>
        </div>
        <div className="flex gap-3">
          <Link href="/portal" className="text-sm font-medium text-jt-primary underline underline-offset-4">
            Client Portal →
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface animate-pulse">
              <div className="h-4 w-3/4 rounded-full bg-jt-border mb-3"></div>
              <div className="h-8 w-1/2 rounded-full bg-jt-border"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Quick Actions</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border border-jt-border bg-jt-surface',
                  'hover:bg-jt-surface/50 hover:border-jt-teal/30 transition-all group',
                )}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform`}>
                  <action.icon size={20} />
                </div>
                <p className="text-sm font-medium text-jt-text group-hover:text-jt-teal-dark transition-colors">
                  {action.label}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* SLA Policies */}
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-jt-text">SLA Policies</h3>
              <Link
                href="/service-desk/settings"
                className="text-sm font-medium text-jt-primary underline underline-offset-4"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="p-4">
            {policies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileTextIcon size={32} className="text-jt-muted/50 mb-3" />
                <p className="text-sm text-jt-muted">
                  No SLA policies configured.{' '}
                  <Link
                    href="/service-desk/settings"
                    className="text-jt-primary underline underline-offset-4 font-medium"
                  >
                    Create one
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {policies.slice(0, 3).map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-jt-border/50 bg-jt-surface/50"
                  >
                    <div>
                      <p className="text-sm font-medium text-jt-text truncate">
                        {policy.name}
                      </p>
                      <p className="text-xs text-jt-muted truncate">
                        Response: {policy.responseMinutes}min • Resolution:
                        {policy.resolutionMinutes}min
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        policy.isDefault
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {policy.isDefault ? 'Default' : 'Active'}
                    </span>
                  </div>
                ))}
                {policies.length > 3 && (
                  <Link
                    href="/service-desk/settings"
                    className="block text-sm font-medium text-jt-primary underline underline-offset-4 text-center"
                  >
                    View all {policies.length} policies
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Recent Tickets */}
      <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
        <div className="p-6 border-b border-jt-border/50 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-jt-text">Recent Tickets</h3>
          <Link
            href="/service-desk/tickets"
            className="text-sm font-medium text-jt-primary underline underline-offset-4"
          >
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          {recentTickets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-jt-muted">
                No tickets yet.{' '}
                <Link
                  href="/service-desk/tickets/new"
                  className="text-jt-primary underline underline-offset-4 font-medium"
                >
                  Create one
                </Link>
                .
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-jt-border/50">
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Assignee
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jt-border/50">
                {recentTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-jt-surface/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/service-desk/tickets/${ticket.id}`}
                        className="text-sm font-medium text-jt-primary underline underline-offset-4 truncate"
                      >
                        {ticket.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[120px]">
                      {ticket.customerId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          ticket.status === 'open'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : ticket.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : ticket.status === 'resolved'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : ticket.status === 'closed'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : ticket.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          ['critical', 'urgent'].includes(ticket.priority)
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : ticket.priority === 'high'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : ticket.priority === 'normal'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[100px]">
                      {ticket.assigneeUserId || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-muted">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
