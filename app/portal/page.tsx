'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TicketPlus,
  FileText,
  Building2,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText as FileTextIcon,
} from 'lucide-react';
import { listClientServiceTickets } from '@/app/actions/service-desk';

export default function ClientPortalDashboardPage() {
  const [stats, setStats] = useState({
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    totalTickets: 0,
  });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const tickets = await listClientServiceTickets({ limit: 50 });

      const open = tickets.filter((t) => t.status === 'open').length;
      const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
      const resolved = tickets.filter(
        (t) => t.status === 'resolved' || t.status === 'closed',
      ).length;

      setStats({
        openTickets: open,
        inProgressTickets: inProgress,
        resolvedTickets: resolved,
        totalTickets: tickets.length,
      });
      setRecentTickets(tickets.slice(0, 5));
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
      label: 'Open',
      value: stats.openTickets,
      icon: FileTextIcon,
      color: 'bg-blue-500',
    },
    {
      label: 'In Progress',
      value: stats.inProgressTickets,
      icon: AlertTriangle,
      color: 'bg-yellow-500',
    },
    {
      label: 'Resolved',
      value: stats.resolvedTickets,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      label: 'Total',
      value: stats.totalTickets,
      icon: FileText,
      color: 'bg-indigo-500',
    },
  ];

  const quickActions = [
    {
      label: 'New Request',
      href: '/portal/tickets/new',
      icon: TicketPlus,
      color: 'bg-blue-600',
    },
    {
      label: 'View All Tickets',
      href: '/portal/tickets',
      icon: FileTextIcon,
      color: 'bg-indigo-600',
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Client Portal</h1>
          <p className="text-jt-muted text-sm">Your service dashboard</p>
        </div>
        <div className="flex gap-2">
          <Link href="/service-desk" className="button-secondary">
            <span className="text-xs">Internal Portal →</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map(() => (
            <div key={Math.random()} className="panel data-panel animate-pulse">
              <div className="h-4 bg-jt-border rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-jt-border rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statCards.map((stat) => (
              <div key={stat.label} className="panel data-panel">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-jt-muted text-sm">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.color} text-white`}>
                    <stat.icon size={24} />
                  </div>
                </div>
              </div>
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
              <h3 className="text-lg font-medium mb-4">Need Help?</h3>
              <p className="text-jt-muted text-sm mb-4">
                Contact our support team for assistance with your service requests, billing
                questions, or technical issues.
              </p>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Email:</strong> support@jithub-teq.com
                </p>
                <p>
                  <strong>Phone:</strong> +256 414 123 456
                </p>
                <p>
                  <strong>Hours:</strong> Mon-Fri, 8:00 AM - 6:00 PM EAT
                </p>
              </div>
            </div>
          </div>

          <div className="panel data-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Recent Service Requests</h3>
              <Link href="/portal/tickets" className="text-jt-primary text-sm underline">
                View All
              </Link>
            </div>
            {recentTickets.length === 0 ? (
              <div className="text-center py-12">
                <FileTextIcon size={48} className="mx-auto text-jt-muted mb-4" />
                <p className="text-jt-muted mb-4">No service requests yet.</p>
                <Link href="/portal/tickets/new" className="primary-button inline-flex">
                  <TicketPlus size={14} className="mr-2" /> Create Your First Request
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/portal/tickets/${ticket.id}`}
                    className="block p-4 bg-jt-surface rounded-lg border border-jt-border hover:border-jt-primary transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{ticket.title}</p>
                        <p className="text-jt-muted text-sm">
                          {ticket.description?.slice(0, 100) || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`status-pill ${['critical', 'urgent'].includes(ticket.priority) ? 'status-danger' : ticket.priority === 'high' ? 'status-warning' : 'status-info'}`}
                        >
                          {ticket.priority}
                        </span>
                        <span className={`status-pill status-${ticket.status.replace('_', '-')}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-jt-muted text-sm">
                      Created: {new Date(ticket.createdAt).toLocaleDateString()}
                      {ticket.updatedAt !== ticket.createdAt && (
                        <> • Updated: {new Date(ticket.updatedAt).toLocaleDateString()}</>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
