'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { listBusinessMembers, inviteMember, updateMembershipRole, suspendMembership, removeMembership } from '@/app/actions/finance'
import { Plus } from 'lucide-react'
import { type BusinessRole } from '@/lib/permissions'

export default function BusinessMembersPage() {
  const params = useParams<{ id: string }>()
  const businessId = params?.id
  const router = useRouter()
  const [members, setMembers] = useState<any[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [inviteFormOpen, setInviteFormOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'cashier' as BusinessRole })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMembers()
  }, [businessId])

  async function loadMembers() {
    if (!businessId) return
    setMembersLoading(true)
    try {
      const rows = await listBusinessMembers({ businessId })
      setMembers(rows)
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  async function updateMemberRole(userId: string, role: BusinessRole) {
    setBusy(true)
    try {
      await updateMembershipRole({ businessId: businessId!, userId, role })
      setError('Member role updated.')
      await loadMembers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update member role.')
    } finally {
      setBusy(false)
    }
  }

  async function suspendMember(userId: string) {
    setBusy(true)
    try {
      await suspendMembership({ businessId: businessId!, userId })
      setError('Member suspended.')
      await loadMembers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not suspend member.')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(userId: string) {
    setBusy(true)
    try {
      await removeMembership({ businessId: businessId!, userId })
      setError('Member removed.')
      await loadMembers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove member.')
    } finally {
      setBusy(false)
    }
  }

  async function handleInviteSubmit() {
    setBusy(true)
    setError('')
    try {
      await inviteMember({ businessId: businessId!, email: inviteForm.email, role: inviteForm.role })
      setError('Invitation sent.')
      setInviteFormOpen(false)
      setInviteForm({ email: '', role: 'cashier' as BusinessRole })
      await loadMembers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send invitation.')
    } finally {
      setBusy(false)
    }
  }

  if (!businessId) return <div className="panel data-panel"><div className="panel-heading"><div><span className="panel-eyebrow">BUSINESS MEMBERSHIP</span><h2>Business Members</h2></div></div><div className="empty-rows"><p>No business selected.</p></div></div>

  return (
    <div className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">BUSINESS MEMBERSHIP</span>
          <h2>Business Members</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: 10 }}>
          <button className="primary-button" onClick={() => setInviteFormOpen(true)} disabled={membersLoading}>
            <Plus size={15}/> Invite member
          </button>
          <button className="button-secondary" onClick={() => router.push('/')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid currentColor' }}></span>Back to dashboard</span></span>
          </button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {membersLoading ? (
        <div className="empty-rows"><span className="empty-dot"><Plus size={17}/></span><p>Loading members…</p></div>
      ) : members.length === 0 ? (
        <div className="empty-rows"><span className="empty-dot"><span className="empty-icon">-</span></span><p>No members found.</p></div>
      ) : (
        <div className="invoice-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>MEMBER</th><th>EMAIL</th><th>ROLE</th><th>ACTIONS</th></tr>
            </thead>
            <tbody>
              {members.map((member: any) => (
                <tr key={member.userId}>
                  <td>
                    <span className="customer-avatar">{member.userName?.slice(0, 1).toUpperCase()}</span>
                    <span><strong>{member.userName}</strong><small>{member.userEmail}</small></span>
                  </td>
                  <td>{member.userEmail}</td>
                  <td><span className={`status-pill status-${member.role.replaceAll('_', '-')}`}>{member.role}</span></td>
                  <td>
                    {member.role !== 'owner' ? (
                      <>
                        <button className="row-action" onClick={() => updateMemberRole(member.userId, member.role === 'viewer' ? 'cashier' : 'viewer')}>
                          {member.role === 'viewer' ? 'Promote' : 'Demote'}
                        </button>
                        {member.role !== 'cashier' ? (
                          <button className="row-action" onClick={() => suspendMember(member.userId)}>Suspend</button>
                        ) : null}
                        <button className="row-action" onClick={() => removeMember(member.userId)}>Remove</button>
                      </>
                    ) : (
                      <span className="row-action">Owner</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EmptyRowsLabel({ label }: { label: string }) {
  return <div className="empty-rows"><span className="empty-dot"><span className="empty-icon">-</span></span><p>{label}</p></div>
}
