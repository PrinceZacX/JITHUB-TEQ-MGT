'use client';

import { useEffect, useState } from 'react';
import { Plus, Mail, UserPlus, X, RefreshCw, Eye, Edit, Users } from 'lucide-react';
import {
  listBusinessInvitations,
  createBusinessInvitation,
  revokeBusinessInvitation,
  resendBusinessInvitation,
  listServiceDeskMembers,
} from '@/app/actions/service-desk';

export default function ServiceDeskClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openInviteForm, setOpenInviteForm] = useState(false);
  type InviteRole =
    | 'owner'
    | 'administrator'
    | 'finance_manager'
    | 'accountant'
    | 'sales_officer'
    | 'cashier'
    | 'viewer';

  const [inviteForm, setInviteForm] = useState<{
    email: string;
    role: InviteRole;
    expiresInDays: number;
  }>({ email: '', role: 'viewer', expiresInDays: 7 });
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [clientsData, invitesData] = await Promise.all([
        listServiceDeskMembers(),
        listBusinessInvitations(),
      ]);
      setClients(clientsData.filter((c) => c.status === 'active'));
      setInvitations(invitesData);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createBusinessInvitation(inviteForm);
      setOpenInviteForm(false);
      setInviteForm({ email: '', role: 'viewer', expiresInDays: 7 });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    if (!confirm('Revoke this invitation?')) return;
    try {
      await revokeBusinessInvitation(invitationId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invitation');
    }
  }

  async function handleResend(invitationId: string) {
    try {
      await resendBusinessInvitation(invitationId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to resend invitation');
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
  ];

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    suspended: 'bg-amber-100 text-amber-700 border-amber-200',
    removed: 'bg-rose-100 text-rose-700 border-rose-200',
    pending: 'bg-blue-100 text-blue-700 border-blue-200',
    accepted: 'bg-green-100 text-green-700 border-green-200',
    expired: 'bg-rose-100 text-rose-700 border-rose-200',
    revoked: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Client Management</h1>
          <p className="text-jt-muted text-sm">
            Manage client access and invitations to your service desk
          </p>
        </div>
        <button className="primary-button" onClick={() => setOpenInviteForm(true)}>
          <Plus size={14} /> Invite Client
        </button>
      </div>

      {openInviteForm && (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Invite New Client</h3>
          </div>
          <div className="p-4">
            <form onSubmit={handleInviteSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="client@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Role
                  </label>
                  <select
                    className="w-full border border-jt-border rounded-lg bg-jt-surface px-3 py-2.5 text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        role: e.target.value as InviteRole,
                      })
                    }
                  >
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    className="w-full border border-jt-border rounded-lg bg-jt-surface px-3 py-2.5 text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={inviteForm.expiresInDays}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        expiresInDays: parseInt(e.target.value) || 7,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="button-secondary flex-1"
                  onClick={() => setOpenInviteForm(false)}
                >
                  <X size={14} /> Cancel
                </button>
                <button type="submit" className="primary-button flex-1" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Client Members */}
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Active Client Members</h3>
          </div>
          <div className="p-4">
            {clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users size={32} className="text-jt-muted/50 mb-3" />
                <p className="text-sm text-jt-muted">No active client members yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-jt-border hover:border-jt-teal/30 transition-colors bg-jt-surface"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {client.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-jt-text truncate">{client.name}</p>
                        <p className="text-xs text-jt-muted truncate">{client.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusColors[client.role] || statusColors.active}`}
                      >
                        {client.role}
                        {client.status !== 'active' ? ` • ${client.status}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Pending Invitations */}
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Pending Invitations</h3>
          </div>
          <div className="p-4">
            {invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Mail size={32} className="text-jt-muted/50 mb-3" />
                <p className="text-sm text-jt-muted">No pending invitations.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-jt-border hover:border-jt-teal/30 transition-colors bg-jt-surface"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                        <Mail size={18} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-jt-text truncate">{inv.email}</p>
                        <p className="text-xs text-jt-muted truncate">
                          Role: {inv.role} • Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusColors[inv.status] || statusColors.pending}`}
                      >
                        {inv.status}
                      </span>
                      {inv.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleResend(inv.id)}
                            className="row-action text-jt-primary hover:bg-jt-surface/50"
                            title="Resend"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            className="row-action text-rose-600 hover:bg-rose-50"
                            title="Revoke"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
