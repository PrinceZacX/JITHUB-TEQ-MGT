'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      trend: { label: 'vs yesterday', value: 0, positive: true },
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
      trend: { label: 'vs yesterday', value: 0, positive: true },
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
      color: 'bg-jt-teal text-white',
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

  const statVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-12">
      {/* Hero header */}
      <div className="jt-reveal jt-delay-1">
        <div className="flex items-start justify-between gap-4 md:flex-row">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-jt-teal/10 text-jt-teal text-[10px] font-bold tracking-wider uppercase">
                Service Desk
              </span>
            </div>
            <h1 className="text-[34px] font-semibold text-jt-text-strong tracking-tight leading-none mb-2 text-balance">
              Service Desk Dashboard
            </h1>
            <p className="text-jt-muted leading-relaxed max-w-2xl">
              Internal management portal — monitor tickets, SLA policies, and client invitations
              across your workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-jt-primary underline underline-offset-4 hover:bg-jt-surface-soft rounded-lg transition-colors"
            >
              <span>Client Portal</span>
              <span className="text-[10px]">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards - staggered motion */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                initial="hidden"
                animate={mounted ? 'visible' : 'hidden'}
                variants={statVariants}
                className="h-24 border border-jt-border/50 rounded-[var(--jt-radius-lg)] bg-jt-surface-soft jt-shimmer"
              />
            ))
          : statCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial="hidden"
                animate={mounted ? 'visible' : 'hidden'}
                variants={statVariants}
                transition={{ delay: i * 60 }}
                className="relative overflow-hidden border border-jt-border bg-jt-surface rounded-[var(--jt-radius-lg)] p-6"
              >
                <StatCard {...stat} />
                <div className="absolute inset-x-0 bottom-0 h-0.5 w-1/3 bg-gradient-to-r from-transparent via-jt-teal to-transparent" />
              </motion.div>
            ))}
      </div>

      {/* Main content grid - asymmetric layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Quick Actions + SLA (spanning 8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Quick Actions */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 300 }}
            className="border border-jt-border bg-jt-surface rounded-[var(--jt-radius-lg)] shadow-sm overflow-hidden"
          >
            <CardHeader className="border-b border-jt-border/50 pb-4">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>
                Common service desk operations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-lg border border-jt-border bg-jt-surface/50',
                      'hover:border-jt-teal/40 hover:bg-white transition-all group',
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                      <span className={cn(action.color, 'text-xs')}>
                        <action.icon size={16} />
                      </span>
                    </div>
                    <p className="text-xs font-medium text-jt-text group-hover:text-jt-teal-dark transition-colors leading-none">
                      {action.label}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </motion.section>

          {/* SLA Policies */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 400 }}
            className="border border-jt-border bg-jt-surface rounded-[var(--jt-radius-lg)] shadow-sm overflow-hidden"
          >
            <CardHeader className="border-b border-jt-border/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">SLA Policies</CardTitle>
                <Link
                  href="/service-desk/settings"
                  className="text-xs font-medium text-jt-primary underline underline-offset-4"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {policies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileTextIcon size={32} className="text-jt-muted/50 mb-3" />
                  <CardTitle className="text-base mb-1">No SLA policies configured</CardTitle>
                  <CardDescription className="text-center max-w-xs">
                    Set up response and resolution time targets for your tickets.
                  </CardDescription>
                  <Link
                    href="/service-desk/settings"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-jt-primary underline underline-offset-4"
                  >
                    Create one <span className="text-[10px]">→</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {policies.slice(0, 3).map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-jt-border/50 bg-jt-surface/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-jt-text truncate">{policy.name}</p>
                        <p className="text-xs text-jt-muted truncate leading-none">
                          Response: {policy.responseMinutes}min &bull; Resolution: {policy.resolutionMinutes}min
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
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
                      className="block text-sm font-medium text-jt-primary underline underline-offset-4 text-center mt-2"
                    >
                      View all {policies.length} policies
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </motion.section>
        </div>

        {/* Right: Recent Tickets (spanning 4 cols) */}
        <div className="lg:col-span-4 space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 500 }}
            className="border border-jt-border bg-jt-surface rounded-[var(--jt-radius-lg)] shadow-sm overflow-hidden"
          >
            <CardHeader className="border-b border-jt-border/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recent Tickets</CardTitle>
                <Link
                  href="/service-desk/tickets"
                  className="text-xs font-medium text-jt-primary underline underline-offset-4"
                >
                  View All
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                {recentTickets.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-jt-muted">
                      No tickets yet.
                      <Link
                        href="/service-desk/tickets/new"
                        className="ml-1 text-jt-primary underline underline-offset-4 font-medium"
                      >
                        Create one
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm divide-y divide-jt-border/50">
                    <thead>
                      <tr className="border-b border-jt-border/50 bg-jt-surface/50 sticky top-0 z-10">
                        <th className="px-4 py-3 text-[10px] font-semibold text-jt-muted uppercase tracking-wider">
                          Ticket
                        </th>
                        <th className="px-4 py-3 text-[10px] font-semibold text-jt-muted uppercase tracking-wider text-right">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
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
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
