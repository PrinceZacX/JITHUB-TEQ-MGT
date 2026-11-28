'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  TicketPlus,
  FileText as FileTextIcon,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle,
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
      color: 'bg-blue-100 text-blue-600 border border-blue-200',
    },
    {
      label: 'In Progress',
      value: stats.inProgressTickets,
      icon: AlertTriangle,
      color: 'bg-amber-100 text-amber-600 border border-amber-200',
    },
    {
      label: 'Resolved',
      value: stats.resolvedTickets,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600 border border-green-200',
    },
    {
      label: 'Total',
      value: stats.totalTickets,
      icon: Building2,
      color: 'bg-indigo-100 text-indigo-600 border border-indigo-200',
    },
  ];

  const quickActions = [
    {
      label: 'New Request',
      href: '/portal/tickets',
      icon: TicketPlus,
      color: 'bg-blue-600 text-white',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Client Portal</h1>
          <p className="text-jt-muted text-sm">Your service dashboard</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/service-desk"
            className="text-sm font-medium text-jt-primary underline underline-offset-4"
          >
            Internal Portal →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface animate-pulse"
            >
              <div className="h-4 w-3/4 rounded-full bg-jt-border mb-3"></div>
              <div className="h-8 w-1/2 rounded-full bg-jt-border"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-jt-muted uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}
                  >
                    <stat.icon size={20} />
                  </div>
                </div>
                <p className="mt-4 text-3xl font-bold text-jt-text">{stat.value}</p>
              </div>
            </div>
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
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform`}
                >
                  <action.icon size={20} />
                </div>
                <p className="text-sm font-medium text-jt-text group-hover:text-jt-teal-dark transition-colors">
                  {action.label}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Contact Info */}
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Need Help?</h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-jt-muted mb-4">
              Contact our support team for assistance with your service requests, billing questions,
              or technical issues.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <Clock size={14} className="text-jt-muted mt-0.5" />
                <div>
                  <p className="text-sm text-jt-text">Email:</p>
                  <p className="text-sm text-jt-muted">support@jithub-teq.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={14} className="text-jt-muted mt-0.5" />
                <div>
                  <p className="text-sm text-jt-text">Phone:</p>
                  <p className="text-sm text-jt-muted">+256 414 123 456</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={14} className="text-jt-muted mt-0.5" />
                <div>
                  <p className="text-sm text-jt-text">Hours:</p>
                  <p className="text-sm text-jt-muted">Mon-Fri, 8:00 AM - 6:00 PM EAT</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Recent Service Requests */}
      <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
        <div className="p-6 border-b border-jt-border/50 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-jt-text">Recent Service Requests</h3>
          <Link
            href="/portal/tickets"
            className="text-sm font-medium text-jt-primary underline underline-offset-4"
          >
            View All
          </Link>
        </div>
        <div className="space-y-3">
          {recentTickets.length === 0 ? (
            <div className="p-8 text-center">
              <FileTextIcon size={32} className="text-jt-muted/50 mb-3" />
              <p className="text-sm text-jt-muted mb-4">No service requests yet.</p>
              <Link href="/portal/tickets" className="primary-button inline-flex">
                <TicketPlus size={14} className="mr-2" /> Create Your First Request
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/portal/tickets/${ticket.id}`}
                  className="block p-4 rounded-lg border border-jt-border bg-jt-surface hover:border-jt-teal/30 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-jt-text truncate">{ticket.title}</p>
                      <p className="text-xs text-jt-muted truncate">
                        {ticket.description?.slice(0, 100) || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-jt-muted">
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
      </section>
    </div>
  );
}
