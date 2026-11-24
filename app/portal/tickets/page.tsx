'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Filter, ChevronDown, MoreHorizontal } from 'lucide-react';
import {
  listClientServiceTickets,
  createClientServiceTicket,
  addClientServiceTicketComment,
  getClientServiceTicket,
} from '@/app/actions/service-desk';

type Priority = 'low' | 'normal' | 'high' | 'critical' | 'urgent';

export default function ClientPortalTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [openTicket, setOpenTicket] = useState<any | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState<{
    title: string;
    description: string;
    priority: Priority;
  }>({ title: '', description: '', priority: 'normal' });

  async function loadData() {
    setLoading(true);
    try {
      const ticketsData = await listClientServiceTickets({ limit: 100 });
      setTickets(ticketsData);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredTickets = tickets.filter((t) => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!t.title.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newTicketForm.title.trim()) return;
    try {
      setSubmitting(true);
      await createClientServiceTicket({
        title: newTicketForm.title,
        description: newTicketForm.description,
        priority: newTicketForm.priority,
      });
      setShowNewTicket(false);
      setNewTicketForm({ title: '', description: '', priority: 'normal' });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddComment(ticketId: string) {
    if (!commentText.trim()) return;
    try {
      setSubmitting(true);
      await addClientServiceTicketComment({ ticketId, body: commentText });
      setCommentText('');
      if (openTicket?.ticket?.id === ticketId) {
        const ticket = await getClientServiceTicket(ticketId);
        setOpenTicket(ticket);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function openTicketDetails(ticket: any) {
    try {
      const data = await getClientServiceTicket(ticket.id);
      setOpenTicket(data);
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    }
  }

  const statusOptions = ['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Service Requests</h1>
          <p className="text-jt-muted text-sm">
            Track and manage your support requests
          </p>
        </div>
        <button className="primary-button" onClick={() => setShowNewTicket(true)}>
          <Plus size={14} /> New Request
        </button>
      </div>

      {showNewTicket && (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Create New Service Request</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleCreateTicket} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={newTicketForm.title}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, title: e.target.value })}
                    placeholder="Brief description of your issue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    className="w-full border border-jt-border rounded-lg bg-jt-surface px-3 py-2.5 text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={newTicketForm.priority}
                    onChange={(e) =>
                      setNewTicketForm({
                        ...newTicketForm,
                        priority: e.target.value as Priority,
                      })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                  value={newTicketForm.description}
                  onChange={(e) =>
                    setNewTicketForm({
                      ...newTicketForm,
                      description: e.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Detailed description of your issue..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="button-secondary flex-1"
                  onClick={() => setShowNewTicket(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button flex-1" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Filter Toolbar */}
      <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-jt-muted"
                size={16}
              />
              <input
                type="text"
                placeholder="Search requests..."
                className="w-full pl-10 pr-4 py-2.5 border border-jt-border rounded-lg bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <select
              className="border border-jt-border rounded-lg bg-jt-surface px-3 py-2.5 text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Ticket List */}
      {loading ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-8 flex items-center justify-center">
            <p className="text-sm text-jt-muted">Loading requests...</p>
          </div>
        </section>
      ) : filteredTickets.length === 0 ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-jt-muted mb-4">No service requests found.</p>
            <button
              className="primary-button mt-4"
              onClick={() => setShowNewTicket(true)}
            >
              <Plus size={14} /> Create Your First Request
            </button>
          </div>
        </section>
      ) : (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-jt-border/50 bg-jt-surface/50 sticky top-0 z-10">
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Request
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jt-border/50">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-jt-surface/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openTicketDetails(ticket)}
                        className="text-sm font-medium text-jt-primary underline underline-offset-4 hover:text-jt-teal-dark truncate block"
                      >
                        {ticket.title}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block ${
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
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block ${
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
                    <td className="px-4 py-3 text-sm text-jt-muted">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-muted">
                      {new Date(ticket.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openTicketDetails(ticket)}
                        className="row-action text-jt-primary hover:bg-jt-surface/50"
                        title="View"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Ticket Detail Modal */}
      {openTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="bg-jt-surface rounded-[var(--jt-radius)] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-jt-border/50"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6 border-b border-jt-border/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-jt-text">
                {openTicket.ticket?.title || 'Request Details'}
              </h2>
              <button
                onClick={() => setOpenTicket(null)}
                className="text-jt-muted hover:text-jt-text transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Status
                  </p>
                  <p className="font-medium">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                        openTicket.ticket?.status === 'open'
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : openTicket.ticket?.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : openTicket.ticket?.status === 'resolved'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : openTicket.ticket?.status === 'closed'
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : openTicket.ticket?.status === 'cancelled'
                          ? 'bg-rose-100 text-rose-700 border-rose-200'
                          : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      {openTicket.ticket?.status?.replace('_', ' ')}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Priority
                  </p>
                  <p className="font-medium">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                        ['critical', 'urgent'].includes(openTicket.ticket?.priority)
                          ? 'bg-rose-100 text-rose-700 border-rose-200'
                          : openTicket.ticket?.priority === 'high'
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : openTicket.ticket?.priority === 'normal'
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      {openTicket.ticket?.priority}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Created
                  </p>
                  <p className="font-medium text-jt-text">
                    {new Date(openTicket.ticket?.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Last Updated
                  </p>
                  <p className="font-medium text-jt-text">
                    {new Date(openTicket.ticket?.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider mb-2">
                  Description
                </p>
                <p className="text-jt-text whitespace-pre-wrap">
                  {openTicket.ticket?.description || 'No description'}
                </p>
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider mb-3">
                  Conversation
                </p>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                  {openTicket.comments?.map((comment: any) => (
                    <div
                      key={comment.id}
                      className="p-3.5 rounded-lg border border-jt-border bg-jt-surface"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-jt-text">
                          {comment.authorUserId === openTicket.ticket?.customerId
                            ? 'You'
                            : 'Support Team'}
                        </span>
                        <span className="text-[10px] text-jt-muted">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-jt-text whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                  {openTicket.events?.map((event: any) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg border border-blue-100 bg-blue-50"
                    >
                      <span className="text-[10px] font-semibold text-blue-700">
                        {event.eventType.replace('_', ' ')}
                      </span>
                      {event.fromValue && <span className="mx-1 text-jt-muted">→</span>}
                      {event.toValue && (
                        <span className="text-[10px] text-blue-700">{event.toValue}</span>
                      )}
                      <span className="text-[10px] text-jt-muted ml-1">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a reply..."
                    className="flex-1 border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    rows={3}
                  />
                  <button
                    onClick={() => openTicket.ticket && handleAddComment(openTicket.ticket.id)}
                    disabled={submitting || !commentText.trim()}
                    className="primary-button px-4"
                  >
                    {submitting ? 'Posting...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
