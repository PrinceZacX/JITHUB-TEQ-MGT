'use client';

import { useEffect, useState } from 'react';
import { Plus, Mail, UserPlus, X } from 'lucide-react';
import {
  createBusinessInvitation,
  revokeBusinessInvitation,
  resendBusinessInvitation,
  listServiceDeskMembers,
} from '@/app/actions/service-desk';
import {
  listBusinesses,
  listBusinessMembers as listBizMembers,
  inviteMember,
  updateMembershipRole,
  suspendMembership,
  removeMembership,
} from '@/app/actions/finance';
import Link from 'next/link';

type InviteRole = 'owner' | 'administrator' | 'finance_manager' | 'accountant' | 'sales_officer' | 'cashier' | 'viewer';

type Member = {
  id: string;
  userId: string | null;
  role: string;
  status: string;
  deletedAt: Date | null;
  userName: string | null;
  userEmail: string | null;
};

type Business = {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string;
  currency: string | null;
  status: string;
  createdAt: Date;
};

export default async function BusinessMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: businessId } = await params;
  const [business, setBusiness] = useState<Business | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [openInviteForm, setOpenInviteForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  type InviteForm = {
    email: string;
    role: InviteRole;
  };
  const [inviteForm, setInviteForm] = useState<InviteForm>({ email: '', role: 'viewer' });
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const businesses = await listBusinesses();
      const biz = businesses.find((b) => b.id === businessId);
      if (biz) {
        setBusiness({
          id: biz.id,
          name: biz.name,
          legalName: biz.legalName || null,
          email: biz.email || null,
          phone: biz.phone || null,
          city: biz.city || null,
          country: biz.country,
          currency: biz.currency || null,
          status: biz.status,
          createdAt: biz.createdAt,
        });
      }
      const membersData = await listBizMembers({ businessId });
      setMembers(
        membersData.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          status: m.status,
          deletedAt: m.deletedAt,
          userName: m.userName || null,
          userEmail: m.userEmail || null,
        })),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load business members.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [businessId]);

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await inviteMember({ businessId, email: inviteForm.email, role: inviteForm.role });
      setOpenInviteForm(false);
      setInviteForm({ email: '', role: 'viewer' });
      setSuccess('Invitation sent successfully.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateRole(userId: string, newRole: string) {
    setError(null);
    try {
      await updateMembershipRole({ businessId, userId, role: newRole as InviteRole });
      setSuccess('Member role updated.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update member role.');
    }
  }

  async function handleSuspend(userId: string) {
    setError(null);
    try {
      await suspendMembership({ businessId, userId });
      setSuccess('Member suspended.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to suspend member.');
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Are you sure you want to remove this member? This cannot be undone.')) return;
    setError(null);
    try {
      await removeMembership({ businessId, userId });
      setSuccess('Member removed.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member.');
    }
  }

  const roleOptions: { value: InviteRole; label: string }[] = [
    { value: 'owner', label: 'Owner (full access)' },
    { value: 'administrator', label: 'Administrator' },
    { value: 'finance_manager', label: 'Finance Manager' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'sales_officer', label: 'Sales Officer' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'viewer', label: 'Viewer (read-only)' },
  ];

  const statusConfig: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: 'bg-green-100 text-green-700 border-green-200' },
    suspended: { label: 'Suspended', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    removed: { label: 'Removed', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    pending: { label: 'Pending', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-jt-text">Business Members</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-jt-muted">Loading members...</p>
        </div>
      </div>
    );
  }

  if (error && !business && !members.length) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-jt-text">Business Members</h1>
        </div>
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Business Members</h1>
          <p className="text-jt-muted text-sm">
            Manage team access and permissions for {business?.name || 'this business'}
          </p>
        </div>
        <button className="primary-button" onClick={() => setOpenInviteForm(true)}>
          <Plus size={14} /> Invite Member
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm">
          {success}
        </div>
      )}

      {business && (
        <>
          <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
            <div className="p-6 border-b border-jt-border/50">
              <h2 className="text-lg font-semibold text-jt-text">{business.name}</h2>
              <p className="text-sm text-jt-muted mt-1">
                {business.email || 'No email'} · {business.city || 'No city'}{business.country ? `, ${business.country}` : ''}
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-jt-muted uppercase tracking-wider mb-3">
                    Business Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-jt-muted">Legal Name</span>
                      <span className="text-jt-text">{business.legalName || '—'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-jt-muted">Currency</span>
                      <span className="text-jt-text">{business.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-jt-muted">Phone</span>
                      <span className="text-jt-text">{business.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-jt-muted">Status</span>
                      <span
                        className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${
                          business.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                      >
                        {business.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-jt-muted uppercase tracking-wider mb-3">
                    Member Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-jt-muted">Total Members</span>
                      <span className="text-jt-text font-medium">{members.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-jt-muted">Active</span>
                      <span className="text-jt-text font-medium text-green-600">
                        {members.filter((m) => m.status === 'active').length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-jt-muted">Suspended</span>
                      <span className="text-jt-text font-medium text-amber-600">
                        {members.filter((m) => m.status === 'suspended').length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
            <div className="p-6 border-b border-jt-border/50">
              <h3 className="text-lg font-semibold text-jt-text">Team Members</h3>
            </div>
            <div className="p-6">
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-jt-muted mb-4">No team members yet.</p>
                  <button
                    className="primary-button"
                    onClick={() => setOpenInviteForm(true)}
                  >
                    <Plus size={14} /> Invite First Member
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-jt-border/50 bg-jt-surface/50 sticky top-0 z-10">
                        <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                          Member
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-jt-border/50">
                      {members.map((member) => (
                        <tr key={member.id} className="hover:bg-jt-surface/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                <span className="text-blue-600 font-medium text-xs">
                                  {member.userName?.charAt(0) || 'U'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-jt-text truncate">
                                  {member.userName || 'Unknown User'}
                                </p>
                                <p className="text-xs text-jt-muted truncate">
                                  {member.userEmail || '—'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="border border-jt-border rounded-lg px-3 py-2 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                              value={member.role as InviteRole}
                              onChange={(e) =>
                                handleUpdateRole(member.userId ?? '', e.target.value as InviteRole)
                              }
                              disabled={member.role === 'owner'}
                            >
                              {roleOptions.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            {member.role === 'owner' && (
                              <span className="ml-2 text-[10px] text-jt-muted">Owner</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block ${
                                statusConfig[member.status]?.color ||
                                statusConfig.pending.color
                              }`}
                            >
                              {statusConfig[member.status]?.label || member.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-1">
                              {member.role !== 'owner' && member.status === 'active' && (
                                <button
                                  onClick={() => handleSuspend(member.userId ?? '')}
                                  className="row-action text-amber-600 hover:bg-amber-50"
                                  title="Suspend member"
                                >
                                  Suspend
                                </button>
                              )}
                              {member.role !== 'owner' && (
                                <button
                                  onClick={() => handleRemove(member.userId ?? '')}
                                  className="row-action text-rose-600 hover:bg-rose-50"
                                  title="Remove member"
                                >
                                  Remove
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
            </div>
          </section>
        </>
      )}

      {openInviteForm && (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Invite New Member</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleInviteSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    placeholder="name@business.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Role
                  </label>
                  <select
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as InviteRole })}
                  >
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4">
                <p className="text-xs text-jt-muted mb-2">Role descriptions:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {roleOptions.map((r) => (
                    <div key={r.value} className="flex items-start gap-2 p-2 rounded-lg border border-jt-border/50 bg-jt-surface/50">
                      <span className="text-[10px] font-semibold text-jt-muted">{r.value}</span>
                      <span className="text-[10px] text-jt-muted">{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="button-secondary flex-1"
                  onClick={() => setOpenInviteForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button flex-1" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
