'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  TicketPlus,
  FileText as FileTextIcon,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { listClientServiceTickets } from '@/app/actions/service-desk';
import { StatCard } from '@/components/service-desk/StatCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

export default function ClientPortalDashboardPage() {
  const [stats, setStats] = useState({
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    totalTickets: 0,
  });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      trend: { label: 'vs last week', value: 0, positive: true },
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
      trend: { label: 'vs last week', value: 0, positive: true },
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
      color: 'bg-jt-teal text-white',
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
                Client Portal
              </span>
            </div>
            <h1 className="text-[34px] font-semibold text-jt-text-strong tracking-tight leading-none mb-2 text-balance">
              Client Portal
            </h1>
            <p className="text-jt-muted leading-relaxed max-w-2xl">
              Track your service requests, view ticket history, and stay connected with our support
              team — all in one place.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/service-desk"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-jt-primary underline underline-offset-4 hover:bg-jt-surface-soft rounded-lg transition-colors"
            >
              <span>Internal Portal</span>
              <span className="text-[10px]">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial="hidden"
              animate={mounted ? 'visible' : 'hidden'}
              variants={statVariants}
              className="h-24 border border-jt-border/50 rounded-[var(--jt-radius-lg)] bg-jt-surface-soft jt-shimmer"
            />
          ))
        ) : (
          statCards.map((stat, i) => (
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
          ))
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Quick Actions + Contact Info (spanning 8 cols) */}
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
                Start a new service request or check your tickets.
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

          {/* Contact Info */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 400 }}
            className="border border-jt-border bg-jt-surface rounded-[var(--jt-radius-lg)] shadow-sm overflow-hidden"
          >
            <CardHeader className="border-b border-jt-border/50 pb-4">
              <CardTitle className="text-lg">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-sm text-jt-muted mb-4 leading-relaxed">
                Contact our support team for assistance with your service requests, billing questions,
                or technical issues.
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Clock size={14} className="text-jt-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-jt-text">Email</p>
                    <p className="text-sm text-jt-muted">support@jithub-teq.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock size={14} className="text-jt-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-jt-text">Phone</p>
                    <p className="text-sm text-jt-muted">+256 414 123 456</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock size={14} className="text-jt-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-jt-text">Hours</p>
                    <p className="text-sm text-jt-muted">Mon-Fri, 8:00 AM - 6:00 PM EAT</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </motion.section>
        </div>

        {/* Right: Recent Service Requests (spanning 4 cols) */}
        <div className="lg:col-span-4 space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 500 }}
            className="border border-jt-border bg-jt-surface rounded-[var(--jt-radius-lg)] shadow-sm overflow-hidden"
          >
            <CardHeader className="border-b border-jt-border/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recent Service Requests</CardTitle>
                <Link
                  href="/portal/tickets"
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
                    <FileTextIcon size={32} className="text-jt-muted/50 mb-3" />
                    <CardTitle className="text-base mb-1">No service requests yet</CardTitle>
                    <CardDescription className="text-center max-w-xs">
                      Submit your first request and we'll get back to you promptly.
                    </CardDescription>
                    <Link
                      href="/portal/tickets"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-jt-primary underline underline-offset-4"
                    >
                      Create Your First Request <span className="text-[10px]">→</span>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        href={`/portal/tickets/${ticket.id}`}
                        className="block p-4 rounded-xl border border-jt-border bg-jt-surface hover:border-jt-teal/30 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-jt-text truncate">
                              {ticket.title}
                            </p>
                            <p className="text-xs text-jt-muted truncate leading-none">
                              {ticket.description?.slice(0, 100) || 'No description'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
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
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-jt-muted">
                          Created: {new Date(ticket.createdAt).toLocaleDateString()}
                          {ticket.updatedAt !== ticket.createdAt && (
                            <span className="ml-2">• Updated: {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
