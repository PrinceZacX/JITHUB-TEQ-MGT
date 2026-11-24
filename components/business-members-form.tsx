'use client';

import { Plus } from 'lucide-react';
import { type BusinessRole } from '@/lib/permissions';

export function BusinessMembersForm({
  business,
  members,
  membersLoading,
  onLoadMembers,
  onInviteMember,
  onUpdateRole,
  onSuspendMember,
  onRemoveMember,
  onInviteFormOpen,
  inviteForm,
  setInviteForm,
  onInviteSubmit,
}: {
  business:
    | {
        id: string;
        name: string;
        currency: string;
        city: string;
        country: string;
        receiptPrefix: string;
        invoicePrefix: string;
      }
    | undefined;
  members: any[];
  membersLoading: boolean;
  onLoadMembers: () => void;
  onInviteMember: () => void;
  onUpdateRole: (businessId: string, userId: string, role: BusinessRole) => void;
  onSuspendMember: (businessId: string, userId: string) => void;
  onRemoveMember: (businessId: string, userId: string) => void;
  onInviteFormOpen: (open: boolean) => void;
  inviteForm: { email: string; role: BusinessRole };
  setInviteForm: (value: { email: string; role: BusinessRole }) => void;
  onInviteSubmit: (
    businessId: string,
    email: string,
    role: BusinessRole,
    invitationUrl: string,
  ) => void;
}) {
  return (
    <div className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">BUSINESS MEMBERSHIP</span>
          <h2>Business Members</h2>
        </div>
        <button className="primary-button" onClick={onInviteMember} disabled={membersLoading}>
          <Plus size={15} /> Invite member
        </button>
      </div>
      {membersLoading ? (
        <div className="empty-rows">
          <span className="empty-dot">
            <Plus size={17} />
          </span>
          <p>Loading members…</p>
        </div>
      ) : members.length === 0 ? (
        <div className="empty-rows">
          <span className="empty-dot">
            <span className="empty-icon">-</span>
          </span>
          <p>No members found.</p>
        </div>
      ) : (
        <div className="invoice-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>MEMBER</th>
                <th>EMAIL</th>
                <th>ROLE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member: any) => (
                <tr key={member.userId}>
                  <td>
                    <span className="customer-avatar">
                      {member.userName?.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{member.userName}</strong>
                      <small>{member.userEmail}</small>
                    </span>
                  </td>
                  <td>{member.userEmail}</td>
                  <td>
                    <span className={`status-pill status-${member.role.replaceAll('_', '-')}`}>
                      {member.role}
                    </span>
                  </td>
                  <td>
                    {member.role !== 'owner' ? (
                      <>
                        <button
                          className="row-action"
                          onClick={() =>
                            onUpdateRole(
                              business?.id!,
                              member.userId,
                              member.role === 'viewer' ? 'cashier' : 'viewer',
                            )
                          }
                        >
                          {member.role === 'viewer' ? 'Promote' : 'Demote'}
                        </button>
                        {member.role !== 'cashier' ? (
                          <button
                            className="row-action"
                            onClick={() => onSuspendMember(business?.id!, member.userId)}
                          >
                            Suspend
                          </button>
                        ) : null}
                        <button
                          className="row-action"
                          onClick={() => onRemoveMember(business?.id!, member.userId)}
                        >
                          Remove
                        </button>
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
  );
}
