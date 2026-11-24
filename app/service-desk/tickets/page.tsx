'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Filter, ChevronDown, MoreHorizontal, X } from 'lucide-react';
import {
  listServiceTickets,
  updateServiceTicket,
  assignServiceTicket,
  resolveServiceTicket,
  closeServiceTicket,
  addServiceTicketComment,
  listServiceTicketComments,
  listServiceDeskMembers,
} from '@/app/actions/service-desk';

export default function ServiceDeskTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignee: '',
    search: '',
  });
  const [openTicket, setOpenTicket] = useState<any | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [ticketsData, membersData] = await Promise.all([
        listServiceTickets({ limit: 100 }),
        listServiceDeskMembers(),
      ]);
      setTickets(ticketsData);
      setMembers(membersData.filter((m) => m.status === 'active'));
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
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.assignee && t.assigneeUserId !== filters.assignee) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (
        !t.title.toLowerCase().includes(search) &&
        !t.customerId.toLowerCase().includes(search)
      )
        return false;
    }
    return true;
  });

  async function handleAction(ticketId: string, action: 'resolve' | 'close') {
    try {
      setSubmitting(true);
      if (action === 'resolve') await resolveServiceTicket(ticketId);
      else await closeServiceTicket(ticketId);
      await loadData();
      if (openTicket?.id === ticketId) setOpenTicket(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(ticketId: string, assigneeUserId: string) {
    try {
      setSubmitting(true);
      await assignServiceTicket(ticketId, assigneeUserId);
      await loadData();
      if (openTicket?.id === ticketId) setOpenTicket(null);
    } catch (err: any) {
      alert(err.message || 'Failed to assign ticket');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddComment(ticketId: string) {
    if (!commentText.trim()) return;
    try {
      setSubmitting(true);
      await addServiceTicketComment({
        ticketId,
        body: commentText,
        isInternal: commentInternal,
      });
      setCommentText('');
      setCommentInternal(false);
      if (openTicket?.id === ticketId) {
        const ticket = await getTicketDetails(ticketId);
        setOpenTicket(ticket);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function getTicketDetails(ticketId: string) {
    try {
      const response = await fetch(`/api/service-desk/tickets/${ticketId}`);
      return response.json();
    } catch {
      return null;
    }
  }

  async function openTicketDetails(ticket: any) {
    try {
      const response = await fetch(`/api/service-desk/tickets/${ticket.id}`);
      const data = await response.json();
      setOpenTicket(data);
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    }
  }

  const statusOptions = ['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled'];
  const priorityOptions = ['low', 'normal', 'high', 'critical', 'urgent'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Tickets</h1>
          <p className="text-jt-muted text-sm">
            Manage all service tickets and support requests
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => (window.location.href = '/service-desk/tickets/new')}
        >
          <Plus size={14} /> New Ticket
        </button>
      </div>

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
                placeholder="Search tickets..."
                className="w-full pl-10 pr-4 py-2.5 border border-jt-border rounded-lg bg-jt-surface text-sm"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <select
              className="border border-jt-border rounded-lg bg-jt-surface px-3 py-2.5 text-sm"
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
            <select
              className="border border-jt-border rounded-lg bg-jt-surface px-3 py-2.5 text-sm"
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            >
              <option value="">All Priorities</option>
              {priorityOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              className="border border-jt-border rounded-lg bg-jt-surface px-3 py-2.5 text-sm"
              value={filters.assignee}
              onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
            >
              <option value="">All Assignees</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.role})
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
            <p className="text-sm text-jt-muted">Loading tickets...</p>
          </div>
        </section>
      ) : filteredTickets.length === 0 ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-jt-muted mb-4">No tickets found.</p>
            <button
              className="primary-button"
              onClick={() => (window.location.href = '/service-desk/tickets/new')}
            >
              <Plus size={14} /> Create Ticket
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
                        className="text-sm font-medium text-jt-primary underline underline-offset-4 hover:text-jt-teal-dark"
                      >
                        {ticket.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-text truncate max-w-[120px]">
                      {ticket.customerId}
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
                    <td className="px-4 py-3">
                      <span className="text-sm truncate max-w-[100px] block">
                        {ticket.assigneeUserId
                          ? members.find((m) => m.userId === ticket.assigneeUserId)?.name ||
                            ticket.assigneeUserId
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-muted">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openTicketDetails(ticket)}
                          className="row-action text-jt-primary hover:bg-jt-surface/50"
                          title="View"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                          <button
                            onClick={() => handleAction(ticket.id, 'resolve')}
                            className="row-action text-green-600 hover:bg-green-50 disabled:opacity-50"
                            disabled={submitting}
                            title="Resolve"
                          >
                            <ChevronDown size={16} />
                          </button>
                        )}
                        {ticket.status !== 'closed' && (
                          <button
                            onClick={() => handleAction(ticket.id, 'close')}
                            className="row-action text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            disabled={submitting}
                            title="Close"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
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
                {openTicket.ticket?.title || 'Ticket Details'}
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
                    Assignee
                  </p>
                  <p className="font-medium text-jt-text">
                    {openTicket.ticket?.assigneeUserId
                      ? members.find((m) => m.userId === openTicket.ticket?.assigneeUserId)
                        ?.name || openTicket.ticket?.assigneeUserId
                      : 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Customer
                  </p>
                  <p className="font-medium text-jt-text truncate">
                    {openTicket.ticket?.customerId}
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
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Comments
                  </p>
                  {openTicket.ticket && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commentInternal}
                          onChange={(e) => setCommentInternal(e.target.checked)}
                          className="rounded border-jt-border text-jt-teal"
                        />
                        Internal
                      </label>
                    </div>
                  )}
                </div>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                  {openTicket.comments?.map((comment: any) => (
                    <div
                      key={comment.id}
                      className={`p-3.5 rounded-lg border ${
                        comment.isInternal
                          ? 'bg-amber-50 border-amber-100'
                          : 'bg-jt-surface border-jt-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-jt-text">
                          {comment.authorUserId}
                        </span>
                        <span className="text-[10px] text-jt-muted">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-jt-text whitespace-pre-wrap">
                        {comment.body}
                      </p>
                      {comment.isInternal && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded">
                          Internal
                        </span>
                      )}
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
                    placeholder="Add a comment..."
                    className="flex-1 border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    rows={3}
                  />
                  <button
                    onClick={() => openTicket.ticket && handleAddComment(openTicket.ticket.id)}
                    disabled={submitting || !commentText.trim()}
                    className="primary-button px-4"
                  >
                    {submitting ? 'Posting...' : 'Post Comment'}
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
