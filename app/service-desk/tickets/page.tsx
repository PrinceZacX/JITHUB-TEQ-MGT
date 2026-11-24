'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Filter, ChevronDown, MoreHorizontal } from 'lucide-react';
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
      if (!t.title.toLowerCase().includes(search) && !t.customerId.toLowerCase().includes(search))
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <button
          className="primary-button"
          onClick={() => (window.location.href = '/service-desk/tickets/new')}
        >
          <Plus size={14} /> New Ticket
        </button>
      </div>

      <div className="panel data-panel mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-jt-muted" size={16} />
            <input
              type="text"
              placeholder="Search tickets..."
              className="w-full pl-10 pr-4 py-2 border border-jt-border rounded-lg bg-jt-surface"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <select
            className="border border-jt-border rounded-lg bg-jt-surface px-4 py-2"
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
            className="border border-jt-border rounded-lg bg-jt-surface px-4 py-2"
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
            className="border border-jt-border rounded-lg bg-jt-surface px-4 py-2"
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

      {loading ? (
        <div className="panel data-panel">Loading tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="panel data-panel text-center py-12">
          <p className="text-jt-muted">No tickets found.</p>
        </div>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <button
                      onClick={() => openTicketDetails(ticket)}
                      className="font-medium text-jt-primary hover:underline text-left"
                    >
                      {ticket.title}
                    </button>
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
                  <td>
                    {ticket.assigneeUserId
                      ? members.find((m) => m.userId === ticket.assigneeUserId)?.name ||
                        ticket.assigneeUserId
                      : '—'}
                  </td>
                  <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openTicketDetails(ticket)} className="row-action">
                        View
                      </button>
                      {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                        <button
                          onClick={() => handleAction(ticket.id, 'resolve')}
                          className="row-action text-green-600"
                          disabled={submitting}
                        >
                          Resolve
                        </button>
                      )}
                      {ticket.status !== 'closed' && (
                        <button
                          onClick={() => handleAction(ticket.id, 'close')}
                          className="row-action text-gray-600"
                          disabled={submitting}
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-jt-bg rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-jt-border flex items-center justify-between">
              <h2 className="text-xl font-bold">{openTicket.ticket?.title || 'Ticket Details'}</h2>
              <button
                onClick={() => setOpenTicket(null)}
                className="text-jt-muted hover:text-jt-text"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-jt-muted text-sm">Status</p>
                  <p className="font-medium">
                    <span
                      className={`status-pill status-${openTicket.ticket?.status?.replace('_', '-')}`}
                    >
                      {openTicket.ticket?.status?.replace('_', ' ')}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-jt-muted text-sm">Priority</p>
                  <p className="font-medium">
                    <span
                      className={`status-pill ${['critical', 'urgent'].includes(openTicket.ticket?.priority) ? 'status-danger' : openTicket.ticket?.priority === 'high' ? 'status-warning' : 'status-info'}`}
                    >
                      {openTicket.ticket?.priority}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-jt-muted text-sm">Assignee</p>
                  <p className="font-medium">
                    {openTicket.ticket?.assigneeUserId
                      ? members.find((m) => m.userId === openTicket.ticket?.assigneeUserId)?.name ||
                        openTicket.ticket?.assigneeUserId
                      : 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-jt-muted text-sm">Customer</p>
                  <p className="font-medium">{openTicket.ticket?.customerId}</p>
                </div>
                <div>
                  <p className="text-jt-muted text-sm">Created</p>
                  <p className="font-medium">
                    {new Date(openTicket.ticket?.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-jt-muted text-sm mb-2">Description</p>
                <p className="whitespace-pre-wrap">
                  {openTicket.ticket?.description || 'No description'}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-jt-muted text-sm">Comments</p>
                  {openTicket.ticket && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={commentInternal}
                          onChange={(e) => setCommentInternal(e.target.checked)}
                        />
                        Internal
                      </label>
                    </div>
                  )}
                </div>
                <div className="space-y-3 mb-4">
                  {openTicket.comments?.map((comment: any) => (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-lg ${comment.isInternal ? 'bg-yellow-50 border border-yellow-200' : 'bg-jt-surface border border-jt-border'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{comment.authorUserId}</span>
                        <span className="text-jt-muted text-sm">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{comment.body}</p>
                      {comment.isInternal && (
                        <span className="text-xs text-yellow-700 font-medium">Internal</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 border border-jt-border rounded-lg p-3"
                    rows={3}
                  />
                  <button
                    onClick={() => openTicket.ticket && handleAddComment(openTicket.ticket.id)}
                    disabled={submitting || !commentText.trim()}
                    className="primary-button"
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
