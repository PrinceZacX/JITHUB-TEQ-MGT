'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  TicketPlus,
  FileText as FileTextIcon,
  Settings,
  Building2,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
  listServiceTickets,
  listServiceLevelPolicies,
  listBusinessInvitations,
} from '@/app/actions/service-desk';

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
      const slaBreaches = 0; // TODO: Calculate from SLA

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
      color: 'bg-blue-500',
      href: '/service-desk/tickets?status=open',
    },
    {
      label: 'In Progress',
      value: stats.inProgressTickets,
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      href: '/service-desk/tickets?status=in_progress',
    },
    {
      label: 'Resolved Today',
      value: stats.resolvedToday,
      icon: CheckCircle,
      color: 'bg-green-500',
      href: '/service-desk/tickets?status=resolved',
    },
    {
      label: 'Pending Invitations',
      value: stats.pendingInvitations,
      icon: Users,
      color: 'bg-purple-500',
      href: '/service-desk/clients',
    },
    {
      label: 'Active Clients',
      value: stats.activeClients,
      icon: Building2,
      color: 'bg-indigo-500',
      href: '/service-desk/clients',
    },
    {
      label: 'SLA Breaches',
      value: stats.slaBreaches,
      icon: Clock,
      color: 'bg-red-500',
      href: '/service-desk/tickets',
    },
  ];

  const quickActions = [
    {
      label: 'Create Ticket',
      href: '/service-desk/tickets/new',
      icon: TicketPlus,
      color: 'bg-blue-600',
    },
    {
      label: 'Invite Client',
      href: '/service-desk/clients/invite',
      icon: Users,
      color: 'bg-green-600',
    },
    {
      label: 'Manage SLA Policies',
      href: '/service-desk/settings',
      icon: Settings,
      color: 'bg-purple-600',
    },
    {
      label: 'View All Tickets',
      href: '/service-desk/tickets',
      icon: FileTextIcon,
      color: 'bg-indigo-600',
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Service Desk Dashboard</h1>
          <p className="text-jt-muted text-sm">Internal management portal</p>
        </div>
        <div className="flex gap-2">
          <Link href="/portal" className="button-secondary">
            <span className="text-xs">Client Portal →</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {statCards.map(() => (
            <div key={Math.random()} className="panel data-panel animate-pulse">
              <div className="h-4 bg-jt-border rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-jt-border rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {statCards.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="panel data-panel hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-jt-muted text-sm">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.color} text-white`}>
                    <stat.icon size={24} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="panel data-panel">
              <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="p-4 rounded-lg border border-jt-border hover:border-jt-primary transition-colors"
                  >
                    <div className={`p-3 rounded-lg ${action.color} text-white mb-2`}>
                      <action.icon size={24} />
                    </div>
                    <p className="font-medium">{action.label}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel data-panel">
              <h3 className="text-lg font-medium mb-4">SLA Policies</h3>
              {policies.length === 0 ? (
                <p className="text-jt-muted text-sm">
                  No SLA policies configured.{' '}
                  <Link href="/service-desk/settings" className="text-jt-primary underline">
                    Create one
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-2">
                  {policies.slice(0, 3).map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between p-3 bg-jt-surface rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        <p className="text-jt-muted text-sm">
                          Response: {policy.responseMinutes}min • Resolution:{' '}
                          {policy.resolutionMinutes}min
                          {policy.isDefault && ' • Default'}
                        </p>
                      </div>
                      <span
                        className={`status-pill ${policy.isDefault ? 'status-success' : 'status-info'}`}
                      >
                        {policy.isDefault ? 'Default' : 'Active'}
                      </span>
                    </div>
                  ))}
                  {policies.length > 3 && (
                    <Link
                      href="/service-desk/settings"
                      className="text-jt-primary text-sm underline"
                    >
                      View all {policies.length} policies
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="panel data-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Recent Tickets</h3>
              <Link href="/service-desk/tickets" className="text-jt-primary text-sm underline">
                View All
              </Link>
            </div>
            {recentTickets.length === 0 ? (
              <p className="text-jt-muted text-center py-8">
                No tickets yet.{' '}
                <Link href="/service-desk/tickets/new" className="text-jt-primary underline">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <div className="invoice-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Assignee</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <Link
                            href={`/service-desk/tickets/${ticket.id}`}
                            className="font-medium text-jt-primary hover:underline"
                          >
                            {ticket.title}
                          </Link>
                        </td>
                        <td>{ticket.customerId}</td>
                        <td>
                          <span className={`status-pill status-${ticket.status.replace('_', '-')}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${['critical', 'urgent'].includes(ticket.priority) ? 'status-danger' : ticket.priority === 'high' ? 'status-warning' : 'status-info'}`}
                          >
                            {ticket.priority}
                          </span>
                        </td>
                        <td>{ticket.assigneeUserId || '—'}</td>
                        <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
