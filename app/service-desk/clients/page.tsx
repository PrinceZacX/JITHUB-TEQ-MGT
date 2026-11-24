'use client'

import { useEffect, useState } from 'react'
import { Plus, Mail, UserPlus, X, RefreshCw, MoreHorizontal, Eye, Edit } from 'lucide-react'
import { listBusinessInvitations, createBusinessInvitation, revokeBusinessInvitation, resendBusinessInvitation, listServiceDeskMembers } from '@/app/actions/service-desk'

export default function ServiceDeskClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openInviteForm, setOpenInviteForm] = useState(false)
  type InviteRole = 'owner' | 'administrator' | 'finance_manager' | 'accountant' | 'sales_officer' | 'cashier' | 'viewer'

const [inviteForm, setInviteForm] = useState<{ email: string; role: InviteRole; expiresInDays: number }>({ email: '', role: 'viewer', expiresInDays: 7 })
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [clientsData, invitesData] = await Promise.all([
        listServiceDeskMembers(),
        listBusinessInvitations(),
      ])
      setClients(clientsData.filter(c => c.status === 'active'))
      setInvitations(invitesData)
    } catch (err) {
      console.error('Failed to load clients:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createBusinessInvitation(inviteForm)
      setOpenInviteForm(false)
      setInviteForm({ email: '', role: 'viewer', expiresInDays: 7 })
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to send invitation')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(invitationId: string) {
    if (!confirm('Revoke this invitation?')) return
    try {
      await revokeBusinessInvitation(invitationId)
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invitation')
    }
  }

  async function handleResend(invitationId: string) {
    try {
      await resendBusinessInvitation(invitationId)
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to resend invitation')
    }
  }

  const roleOptions = [
    { value: 'viewer', label: 'Viewer (read-only)' },
    { value: 'cashier', label: 'Cashier (payments)' },
    { value: 'sales_officer', label: 'Sales Officer' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'finance_manager', label: 'Finance Manager' },
    { value: 'administrator', label: 'Administrator' },
    { value: 'owner', label: 'Owner (full access)' },
  ]

  const statusColors: Record<string, string> = {
    active: 'status-success',
    suspended: 'status-warning',
    removed: 'status-danger',
    pending: 'status-info',
    accepted: 'status-success',
    expired: 'status-danger',
    revoked: 'status-gray',
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Client Management</h1>
        <button className="primary-button" onClick={() => setOpenInviteForm(true)}>
          <Plus size={14} /> Invite Client
        </button>
      </div>

      {openInviteForm && (
        <div className="panel data-panel mb-6">
          <h3 className="text-lg font-medium mb-4">Invite New Client</h3>
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as InviteRole })}
                >
                  {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expires In (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
                  value={inviteForm.expiresInDays}
                  onChange={(e) => setInviteForm({ ...inviteForm, expiresInDays: parseInt(e.target.value) || 7 })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="button-secondary" onClick={() => setOpenInviteForm(false)}>
                <X size={14} /> Cancel
              </button>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel data-panel">
          <h3 className="text-lg font-medium mb-4">Active Client Members</h3>
          {clients.length === 0 ? (
            <p className="text-jt-muted text-center py-8">No active client members yet.</p>
          ) : (
            <div className="space-y-3">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-4 bg-jt-surface rounded-lg border border-jt-border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-jt-primary/10 flex items-center justify-center">
                      <span className="text-jt-primary font-medium">{client.name?.charAt(0) || 'U'}</span>
                    </div>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-jt-muted text-sm">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`status-pill ${statusColors[client.status] || 'status-info'}`}>
                      {client.role}
                    </span>
                    <span className={`status-pill ${statusColors[client.status] || 'status-info'}`}>
                      {client.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel data-panel">
          <h3 className="text-lg font-medium mb-4">Pending Invitations</h3>
          {invitations.length === 0 ? (
            <p className="text-jt-muted text-center py-8">No pending invitations.</p>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 bg-jt-surface rounded-lg border border-jt-border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Mail size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-jt-muted text-sm">
                        Role: {inv.role} • Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-pill ${statusColors[inv.status] || 'status-info'}`}>
                      {inv.status}
                    </span>
                    {inv.status === 'pending' && (
                      <>
                        <button onClick={() => handleResend(inv.id)} className="row-action" title="Resend">
                          <RefreshCw size={14} />
                        </button>
                        <button onClick={() => handleRevoke(inv.id)} className="row-action text-red-600" title="Revoke">
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}