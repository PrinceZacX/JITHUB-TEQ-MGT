'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Filter, ChevronDown, MoreHorizontal } from 'lucide-react'
import { listClientServiceTickets, createClientServiceTicket, addClientServiceTicketComment, getClientServiceTicket } from '@/app/actions/service-desk'

type Priority = 'low' | 'normal' | 'high' | 'critical' | 'urgent'

export default function ClientPortalTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', search: '' })
  const [openTicket, setOpenTicket] = useState<any | null>(null)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [newTicketForm, setNewTicketForm] = useState<{ title: string; description: string; priority: Priority }>({ title: '', description: '', priority: 'normal' })

  async function loadData() {
    setLoading(true)
    try {
      const ticketsData = await listClientServiceTickets({ limit: 100 })
      setTickets(ticketsData)
    } catch (err) {
      console.error('Failed to load tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredTickets = tickets.filter(t => {
    if (filters.status && t.status !== filters.status) return false
    if (filters.search) {
      const search = filters.search.toLowerCase()
      if (!t.title.toLowerCase().includes(search)) return false
    }
    return true
  })

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!newTicketForm.title.trim()) return
    try {
      setSubmitting(true)
      await createClientServiceTicket({
        title: newTicketForm.title,
        description: newTicketForm.description,
        priority: newTicketForm.priority,
      })
      setShowNewTicket(false)
      setNewTicketForm({ title: '', description: '', priority: 'normal' })
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddComment(ticketId: string) {
    if (!commentText.trim()) return
    try {
      setSubmitting(true)
      await addClientServiceTicketComment({ ticketId, body: commentText })
      setCommentText('')
      if (openTicket?.ticket?.id === ticketId) {
        const ticket = await getClientServiceTicket(ticketId)
        setOpenTicket(ticket)
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  async function openTicketDetails(ticket: any) {
    try {
      const data = await getClientServiceTicket(ticket.id)
      setOpenTicket(data)
    } catch (err) {
      console.error('Failed to load ticket details:', err)
    }
  }

  const statusOptions = ['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled']

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Service Requests</h1>
        <button className="primary-button" onClick={() => setShowNewTicket(true)}>
          <Plus size={14} /> New Request
        </button>
      </div>

      {showNewTicket && (
        <div className="panel data-panel mb-6">
          <h3 className="text-lg font-medium mb-4">Create New Service Request</h3>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                required
                className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
                value={newTicketForm.title}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, title: e.target.value })}
                placeholder="Brief description of your issue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
                value={newTicketForm.description}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                rows={4}
                placeholder="Detailed description of your issue..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
                value={newTicketForm.priority}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value as Priority })}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" className="button-secondary" onClick={() => setShowNewTicket(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? 'Creating...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel data-panel mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-jt-muted" size={16} />
            <input
              type="text"
              placeholder="Search requests..."
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
            {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="panel data-panel">Loading requests...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="panel data-panel text-center py-12">
          <p className="text-jt-muted">No service requests found.</p>
          <button className="primary-button mt-4" onClick={() => setShowNewTicket(true)}>
            <Plus size={14} /> Create Your First Request
          </button>
        </div>
      ) : (
        <div className="invoice-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created</th>
                <th>Updated</th>
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
                  <td>
                    <span className={`status-pill status-${ticket.status.replace('_', '-')}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${['critical','urgent'].includes(ticket.priority) ? 'status-danger' : ticket.priority === 'high' ? 'status-warning' : 'status-info'}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                  <td>{new Date(ticket.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <button 
                      onClick={() => openTicketDetails(ticket)}
                      className="row-action"
                    >
                      View
                    </button>
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
              <h2 className="text-xl font-bold">{openTicket.ticket?.title || 'Request Details'}</h2>
              <button onClick={() => setOpenTicket(null)} className="text-jt-muted hover:text-jt-text">
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-jt-muted text-sm">Status</p>
                  <p className="font-medium">
                    <span className={`status-pill status-${openTicket.ticket?.status?.replace('_', '-')}`}>
                      {openTicket.ticket?.status?.replace('_', ' ')}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-jt-muted text-sm">Priority</p>
                  <p className="font-medium">
                    <span className={`status-pill ${['critical','urgent'].includes(openTicket.ticket?.priority) ? 'status-danger' : openTicket.ticket?.priority === 'high' ? 'status-warning' : 'status-info'}`}>
                      {openTicket.ticket?.priority}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-jt-muted text-sm">Created</p>
                  <p className="font-medium">{new Date(openTicket.ticket?.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-jt-muted text-sm">Last Updated</p>
                  <p className="font-medium">{new Date(openTicket.ticket?.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-jt-muted text-sm mb-2">Description</p>
                <p className="whitespace-pre-wrap">{openTicket.ticket?.description || 'No description'}</p>
              </div>

              <div className="mb-6">
                <p className="text-jt-muted text-sm mb-3">Conversation</p>
                <div className="space-y-3 mb-4">
                  {openTicket.comments?.map((comment: any) => (
                    <div key={comment.id} className="p-4 rounded-lg bg-jt-surface border border-jt-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{comment.authorUserId === openTicket.ticket?.customerId ? 'You' : 'Support Team'}</span>
                        <span className="text-jt-muted text-sm">{new Date(comment.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  ))}
                  {openTicket.events?.map((event: any) => (
                    <div key={event.id} className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm">
                      <span className="font-medium text-blue-700">{event.eventType.replace('_', ' ')}</span>
                      {event.fromValue && <span className="mx-2">→</span>}
                      {event.toValue && <span className="text-blue-700">{event.toValue}</span>}
                      <span className="text-jt-muted ml-2">{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a reply..."
                    className="flex-1 border border-jt-border rounded-lg p-3"
                    rows={3}
                  />
                  <button
                    onClick={() => openTicket.ticket && handleAddComment(openTicket.ticket.id)}
                    disabled={submitting || !commentText.trim()}
                    className="primary-button"
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
  )
}