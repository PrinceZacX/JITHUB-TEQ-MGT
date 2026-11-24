'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  auditLogs,
  businesses,
  businessMemberships,
  user,
  serviceTickets,
  serviceTicketComments,
  serviceTicketEvents,
  serviceTicketAttachments,
  serviceLevelPolicies,
  businessInvitations,
  customers,
  documentSequences,
} from '@/lib/db/schema';
import { and, desc, eq, gte, lte, sql, inArray } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import {
  requireBusinessPermission,
  requireBusiness,
  insertAudit,
  allocateDocumentNumber,
  requireUser,
} from '@/app/actions/finance';
import { type BusinessRole, type BusinessPermission } from '@/lib/permissions';
import { loadEnv } from '@/lib/env';
import { sendVerificationEmail } from '@/lib/email';
import { withDbTimeout, DatabaseTimeoutError } from '@/lib/db/query-timeout';

/* ------------------------------------------------------------------ */
/* Business Invitations                                               */
/* ------------------------------------------------------------------ */

export async function createBusinessInvitation(input: {
  email: string;
  role?:
    | 'owner'
    | 'administrator'
    | 'finance_manager'
    | 'accountant'
    | 'sales_officer'
    | 'cashier'
    | 'viewer';
  expiresInDays?: number;
}) {
  const context = await requireBusinessPermission('membership.manage');
  loadEnv();

  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');

  const role = input.role || 'viewer';
  const expiresInDays = input.expiresInDays || 7;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  // Check if invitation already exists and is pending
  const [existing] = await db
    .select()
    .from(businessInvitations)
    .where(
      and(
        eq(businessInvitations.businessId, context.businessId),
        eq(businessInvitations.email, email),
        eq(businessInvitations.status, 'pending'),
      ),
    )
    .limit(1);
  if (existing) throw new Error('A pending invitation already exists for this email.');

  // Check if user is already a member
  const [membership] = await db
    .select()
    .from(businessMemberships)
    .where(
      and(
        eq(businessMemberships.businessId, context.businessId),
        eq(
          businessMemberships.userId,
          (await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1))[0]
            ?.id || 'none',
        ),
      ),
    )
    .limit(1);
  if (membership) throw new Error('This user is already a member of this business.');

  // Generate secure token
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const invitationId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(businessInvitations).values({
      id: invitationId,
      businessId: context.businessId,
      email,
      role,
      tokenHash,
      invitedBy: context.userId,
      status: 'pending',
      expiresAt,
    });
    await insertAudit(tx, context, {
      action: 'invitation.created',
      entityType: 'business_invitation',
      entityId: invitationId,
      details: { email, role, expiresAt: expiresAt.toISOString() },
    });
  });

  // Send invitation email
  const inviteUrl = `${process.env.BETTER_AUTH_URL || process.env.VERCEL_URL || 'https://jithub-teq-mgt.vercel.app'}/portal/invite/${token}`;
  await sendVerificationEmail(email, inviteUrl);

  revalidatePath('/service-desk/clients');
  return { id: invitationId, token }; // Return token once for email sending
}

export async function acceptBusinessInvitation(token: string) {
  loadEnv();
  const userId = await requireUser();

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const [invitation] = await db
    .select()
    .from(businessInvitations)
    .where(eq(businessInvitations.tokenHash, tokenHash))
    .limit(1);
  if (!invitation) throw new Error('Invalid or expired invitation token.');
  if (invitation.status !== 'pending')
    throw new Error('This invitation has already been used or revoked.');
  if (new Date() > new Date(invitation.expiresAt)) {
    await db
      .update(businessInvitations)
      .set({ status: 'expired' })
      .where(eq(businessInvitations.id, invitation.id));
    throw new Error('This invitation has expired.');
  }

  // Check if user already has membership
  const [existingMembership] = await db
    .select()
    .from(businessMemberships)
    .where(
      and(
        eq(businessMemberships.businessId, invitation.businessId),
        eq(businessMemberships.userId, userId),
      ),
    )
    .limit(1);

  await db.transaction(async (tx) => {
    if (existingMembership) {
      // Reactivate/update existing membership
      await tx
        .update(businessMemberships)
        .set({
          role: invitation.role,
          status: 'active',
          updatedAt: new Date(),
          deletedAt: null,
          deletedBy: null,
        })
        .where(eq(businessMemberships.id, existingMembership.id));
    } else {
      // Create new membership
      await tx.insert(businessMemberships).values({
        id: randomUUID(),
        businessId: invitation.businessId,
        userId,
        role: invitation.role,
        status: 'active',
      });
    }

    await tx
      .update(businessInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(businessInvitations.id, invitation.id));

    await insertAudit(
      tx,
      { userId, businessId: invitation.businessId },
      {
        action: 'invitation.accepted',
        entityType: 'business_invitation',
        entityId: invitation.id,
        details: { email: invitation.email, role: invitation.role },
      },
    );
  });

  revalidatePath('/portal');
  revalidatePath('/service-desk/clients');
  return { success: true, businessId: invitation.businessId };
}

export async function revokeBusinessInvitation(invitationId: string) {
  const context = await requireBusinessPermission('membership.manage');
  loadEnv();

  const [invitation] = await db
    .select()
    .from(businessInvitations)
    .where(
      and(
        eq(businessInvitations.id, invitationId),
        eq(businessInvitations.businessId, context.businessId),
      ),
    )
    .limit(1);
  if (!invitation) throw new Error('Invitation not found.');
  if (invitation.status !== 'pending') throw new Error('Only pending invitations can be revoked.');

  await db.transaction(async (tx) => {
    await tx
      .update(businessInvitations)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(businessInvitations.id, invitationId));
    await insertAudit(tx, context, {
      action: 'invitation.revoked',
      entityType: 'business_invitation',
      entityId: invitationId,
      details: { email: invitation.email },
    });
  });

  revalidatePath('/service-desk/clients');
  return { success: true };
}

export async function resendBusinessInvitation(invitationId: string) {
  const context = await requireBusinessPermission('membership.manage');
  loadEnv();

  const [invitation] = await db
    .select()
    .from(businessInvitations)
    .where(
      and(
        eq(businessInvitations.id, invitationId),
        eq(businessInvitations.businessId, context.businessId),
      ),
    )
    .limit(1);
  if (!invitation) throw new Error('Invitation not found.');
  if (invitation.status !== 'pending') throw new Error('Only pending invitations can be resent.');

  // Generate new token
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(businessInvitations)
      .set({ tokenHash, expiresAt, updatedAt: new Date() })
      .where(eq(businessInvitations.id, invitationId));
    await insertAudit(tx, context, {
      action: 'invitation.resent',
      entityType: 'business_invitation',
      entityId: invitationId,
      details: { email: invitation.email },
    });
  });

  const inviteUrl = `${process.env.BETTER_AUTH_URL || process.env.VERCEL_URL || 'https://jithub-teq-mgt.vercel.app'}/portal/invite/${token}`;
  await sendVerificationEmail(invitation.email, inviteUrl);

  revalidatePath('/service-desk/clients');
  return { success: true };
}

export async function listBusinessInvitations() {
  const context = await requireBusinessPermission('membership.manage');
  loadEnv();

  const invitations = await db
    .select()
    .from(businessInvitations)
    .where(eq(businessInvitations.businessId, context.businessId))
    .orderBy(desc(businessInvitations.createdAt));

  return invitations.map((inv) => ({
    ...inv,
    tokenHash: undefined, // Never expose token hash
  }));
}

/* ------------------------------------------------------------------ */
/* Service Level Policies                                             */
/* ------------------------------------------------------------------ */

export async function createServiceLevelPolicy(input: {
  name: string;
  description?: string;
  responseMinutes: number;
  resolutionMinutes: number;
  isDefault?: boolean;
  appliesToPriorities?: ('low' | 'normal' | 'high' | 'critical' | 'urgent')[];
  businessHoursOnly?: boolean;
  timezone?: string;
}) {
  const context = await requireBusinessPermission('business.settings');
  loadEnv();

  if (!input.name || input.name.trim().length < 2)
    throw new Error('Policy name must be at least 2 characters.');
  if (input.responseMinutes < 1) throw new Error('Response time must be at least 1 minute.');
  if (input.resolutionMinutes < 1) throw new Error('Resolution time must be at least 1 minute.');

  const policyId = randomUUID();
  const appliesToPriorities = input.appliesToPriorities || [
    'low',
    'normal',
    'high',
    'critical',
    'urgent',
  ];
  const isDefault = input.isDefault || false;
  const businessHoursOnly = input.businessHoursOnly !== false;
  const timezone = input.timezone || 'Africa/Kampala';

  await db.transaction(async (tx) => {
    // If setting as default, unset other defaults
    if (isDefault) {
      await tx
        .update(serviceLevelPolicies)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(serviceLevelPolicies.businessId, context.businessId),
            eq(serviceLevelPolicies.isDefault, true),
          ),
        );
    }

    await tx.insert(serviceLevelPolicies).values({
      id: policyId,
      businessId: context.businessId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      responseMinutes: input.responseMinutes,
      resolutionMinutes: input.resolutionMinutes,
      isDefault,
      appliesToPriorities,
      businessHoursOnly,
      timezone,
    });
    await insertAudit(tx, context, {
      action: 'sla_policy.created',
      entityType: 'service_level_policy',
      entityId: policyId,
      details: { name: input.name.trim(), isDefault },
    });
  });

  revalidatePath('/service-desk/settings');
  return { id: policyId };
}

export async function listServiceLevelPolicies() {
  const context = await requireBusinessPermission('reports.read');
  loadEnv();

  const policies = await db
    .select()
    .from(serviceLevelPolicies)
    .where(eq(serviceLevelPolicies.businessId, context.businessId))
    .orderBy(desc(serviceLevelPolicies.isDefault), desc(serviceLevelPolicies.createdAt));

  return policies;
}

export async function updateServiceLevelPolicy(input: {
  id: string;
  name?: string;
  description?: string;
  responseMinutes?: number;
  resolutionMinutes?: number;
  isDefault?: boolean;
  appliesToPriorities?: ('low' | 'normal' | 'high' | 'critical' | 'urgent')[];
  businessHoursOnly?: boolean;
  timezone?: string;
}) {
  const context = await requireBusinessPermission('business.settings');
  loadEnv();

  const [policy] = await db
    .select()
    .from(serviceLevelPolicies)
    .where(
      and(
        eq(serviceLevelPolicies.id, input.id),
        eq(serviceLevelPolicies.businessId, context.businessId),
      ),
    )
    .limit(1);
  if (!policy) throw new Error('Policy not found.');

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    if (!input.name || input.name.trim().length < 2)
      throw new Error('Policy name must be at least 2 characters.');
    updates.name = input.name.trim();
  }
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.responseMinutes !== undefined) {
    if (input.responseMinutes < 1) throw new Error('Response time must be at least 1 minute.');
    updates.responseMinutes = input.responseMinutes;
  }
  if (input.resolutionMinutes !== undefined) {
    if (input.resolutionMinutes < 1) throw new Error('Resolution time must be at least 1 minute.');
    updates.resolutionMinutes = input.resolutionMinutes;
  }
  if (input.isDefault !== undefined) updates.isDefault = input.isDefault;
  if (input.appliesToPriorities !== undefined)
    updates.appliesToPriorities = input.appliesToPriorities;
  if (input.businessHoursOnly !== undefined) updates.businessHoursOnly = input.businessHoursOnly;
  if (input.timezone !== undefined) updates.timezone = input.timezone;

  await db.transaction(async (tx) => {
    // If setting as default, unset other defaults
    if (input.isDefault === true) {
      await tx
        .update(serviceLevelPolicies)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(serviceLevelPolicies.businessId, context.businessId),
            eq(serviceLevelPolicies.isDefault, true),
          ),
        );
    }

    await tx
      .update(serviceLevelPolicies)
      .set(updates)
      .where(
        and(
          eq(serviceLevelPolicies.id, input.id),
          eq(serviceLevelPolicies.businessId, context.businessId),
        ),
      );

    await insertAudit(tx, context, {
      action: 'sla_policy.updated',
      entityType: 'service_level_policy',
      entityId: input.id,
      details: updates,
    });
  });

  revalidatePath('/service-desk/settings');
  return { success: true };
}

export async function deleteServiceLevelPolicy(policyId: string) {
  const context = await requireBusinessPermission('business.settings');
  loadEnv();

  const [policy] = await db
    .select()
    .from(serviceLevelPolicies)
    .where(
      and(
        eq(serviceLevelPolicies.id, policyId),
        eq(serviceLevelPolicies.businessId, context.businessId),
      ),
    )
    .limit(1);
  if (!policy) throw new Error('Policy not found.');
  if (policy.isDefault)
    throw new Error('Cannot delete the default policy. Set another policy as default first.');

  await db.transaction(async (tx) => {
    await tx.delete(serviceLevelPolicies).where(eq(serviceLevelPolicies.id, policyId));
    await insertAudit(tx, context, {
      action: 'sla_policy.deleted',
      entityType: 'service_level_policy',
      entityId: policyId,
      details: { name: policy.name },
    });
  });

  revalidatePath('/service-desk/settings');
  return { success: true };
}

/* ------------------------------------------------------------------ */
/* Service Tickets                                                    */
/* ------------------------------------------------------------------ */

export async function createServiceTicket(input: {
  customerId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical' | 'urgent';
  relatedInvoiceId?: string;
  relatedQuotationId?: string;
  relatedServiceOrderId?: string;
  slaPolicyId?: string;
}) {
  const context = await requireBusinessPermission('service_ticket.create');
  loadEnv();

  if (!input.title || input.title.trim().length < 3)
    throw new Error('Title must be at least 3 characters.');
  if (!input.customerId) throw new Error('Customer is required.');

  // Verify customer belongs to this business
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.businessId, context.businessId)))
    .limit(1);
  if (!customer) throw new Error('Customer not found or does not belong to this business.');

  const priority = input.priority || 'normal';
  const ticketId = randomUUID();
  const number = await allocateDocumentNumber(db, context.businessId, 'service_ticket');

  await db.transaction(async (tx) => {
    await tx.insert(serviceTickets).values({
      id: ticketId,
      businessId: context.businessId,
      customerId: input.customerId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: 'open',
      priority,
      relatedInvoiceId: input.relatedInvoiceId || null,
      relatedQuotationId: input.relatedQuotationId || null,
      relatedServiceOrderId: input.relatedServiceOrderId || null,
      slaPolicyId: input.slaPolicyId || null,
      createdBy: context.userId,
    });

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: context.businessId,
      ticketId,
      actorUserId: context.userId,
      eventType: 'created',
      fromValue: null,
      toValue: JSON.stringify({ status: 'open', priority }),
      metadata: { title: input.title.trim(), customerId: input.customerId },
    });

    await insertAudit(tx, context, {
      action: 'service_ticket.created',
      entityType: 'service_ticket',
      entityId: ticketId,
      details: {
        number,
        title: input.title.trim(),
        customerId: input.customerId,
        priority,
      },
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { id: ticketId, number };
}

export async function listServiceTickets(filters?: {
  status?: string;
  priority?: string;
  assigneeUserId?: string;
  customerId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const context = await requireBusinessPermission('service_ticket.read');
  loadEnv();

  const whereClauses = [eq(serviceTickets.businessId, context.businessId)];
  if (filters?.status) whereClauses.push(eq(serviceTickets.status, filters.status));
  if (filters?.priority) whereClauses.push(eq(serviceTickets.priority, filters.priority));
  if (filters?.assigneeUserId)
    whereClauses.push(eq(serviceTickets.assigneeUserId, filters.assigneeUserId));
  if (filters?.customerId) whereClauses.push(eq(serviceTickets.customerId, filters.customerId));
  if (filters?.search) {
    whereClauses.push(
      sql`${serviceTickets.title} ILIKE ${'%' + filters.search + '%'} OR ${serviceTickets.description} ILIKE ${'%' + filters.search + '%'}`,
    );
  }

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const tickets = await db
    .select({
      id: serviceTickets.id,
      businessId: serviceTickets.businessId,
      customerId: serviceTickets.customerId,
      title: serviceTickets.title,
      description: serviceTickets.description,
      status: serviceTickets.status,
      priority: serviceTickets.priority,
      assigneeUserId: serviceTickets.assigneeUserId,
      relatedInvoiceId: serviceTickets.relatedInvoiceId,
      relatedQuotationId: serviceTickets.relatedQuotationId,
      relatedServiceOrderId: serviceTickets.relatedServiceOrderId,
      slaPolicyId: serviceTickets.slaPolicyId,
      createdBy: serviceTickets.createdBy,
      createdAt: serviceTickets.createdAt,
      updatedAt: serviceTickets.updatedAt,
      resolvedAt: serviceTickets.resolvedAt,
      closedAt: serviceTickets.closedAt,
    })
    .from(serviceTickets)
    .where(and(...whereClauses))
    .orderBy(desc(serviceTickets.createdAt))
    .limit(limit)
    .offset(offset);

  return tickets;
}

export async function getServiceTicket(ticketId: string) {
  const context = await requireBusinessPermission('service_ticket.read');
  loadEnv();

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)))
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');

  // Get comments (exclude internal for non-staff)
  const isStaff = [
    'owner',
    'administrator',
    'finance_manager',
    'accountant',
    'sales_officer',
  ].includes(context.role as string);
  const comments = await db
    .select()
    .from(serviceTicketComments)
    .where(
      and(
        eq(serviceTicketComments.ticketId, ticketId),
        eq(serviceTicketComments.businessId, context.businessId),
        isStaff ? sql`true` : eq(serviceTicketComments.isInternal, false),
      ),
    )
    .orderBy(serviceTicketComments.createdAt);

  // Get events
  const events = await db
    .select()
    .from(serviceTicketEvents)
    .where(
      and(
        eq(serviceTicketEvents.ticketId, ticketId),
        eq(serviceTicketEvents.businessId, context.businessId),
      ),
    )
    .orderBy(serviceTicketEvents.createdAt);

  // Get attachments
  const attachments = await db
    .select()
    .from(serviceTicketAttachments)
    .where(
      and(
        eq(serviceTicketAttachments.ticketId, ticketId),
        eq(serviceTicketAttachments.businessId, context.businessId),
      ),
    )
    .orderBy(serviceTicketAttachments.createdAt);

  return { ticket, comments, events, attachments };
}

export async function updateServiceTicket(input: {
  ticketId: string;
  title?: string;
  description?: string;
  status?: 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed' | 'cancelled';
  priority?: 'low' | 'normal' | 'high' | 'critical' | 'urgent';
  assigneeUserId?: string | null;
  slaPolicyId?: string | null;
}) {
  const context = await requireBusinessPermission('service_ticket.update');
  loadEnv();

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(
      and(eq(serviceTickets.id, input.ticketId), eq(serviceTickets.businessId, context.businessId)),
    )
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');

  const updates: Record<string, any> = { updatedAt: new Date() };
  const events: Array<{
    eventType: string;
    fromValue: string | null;
    toValue: string | null;
  }> = [];

  if (input.title !== undefined) {
    if (!input.title || input.title.trim().length < 3)
      throw new Error('Title must be at least 3 characters.');
    updates.title = input.title.trim();
    events.push({
      eventType: 'title_changed',
      fromValue: ticket.title,
      toValue: input.title.trim(),
    });
  }
  if (input.description !== undefined) {
    updates.description = input.description?.trim() || null;
    events.push({
      eventType: 'description_changed',
      fromValue: ticket.description,
      toValue: input.description?.trim() || null,
    });
  }
  if (input.status !== undefined) {
    const validStatuses = ['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled'];
    if (!validStatuses.includes(input.status)) throw new Error('Invalid status.');
    updates.status = input.status;
    events.push({
      eventType: 'status_changed',
      fromValue: ticket.status,
      toValue: input.status,
    });
    if (input.status === 'resolved' && ticket.status !== 'resolved')
      updates.resolvedAt = new Date();
    if (input.status === 'closed' && ticket.status !== 'closed') updates.closedAt = new Date();
  }
  if (input.priority !== undefined) {
    const validPriorities = ['low', 'normal', 'high', 'critical', 'urgent'];
    if (!validPriorities.includes(input.priority)) throw new Error('Invalid priority.');
    updates.priority = input.priority;
    events.push({
      eventType: 'priority_changed',
      fromValue: ticket.priority,
      toValue: input.priority,
    });
  }
  if (input.assigneeUserId !== undefined) {
    updates.assigneeUserId = input.assigneeUserId;
    events.push({
      eventType: 'assignee_changed',
      fromValue: ticket.assigneeUserId,
      toValue: input.assigneeUserId,
    });
  }
  if (input.slaPolicyId !== undefined) {
    updates.slaPolicyId = input.slaPolicyId;
    events.push({
      eventType: 'sla_changed',
      fromValue: ticket.slaPolicyId,
      toValue: input.slaPolicyId,
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(serviceTickets)
      .set(updates)
      .where(
        and(
          eq(serviceTickets.id, input.ticketId),
          eq(serviceTickets.businessId, context.businessId),
        ),
      );

    for (const event of events) {
      await tx.insert(serviceTicketEvents).values({
        id: randomUUID(),
        businessId: context.businessId,
        ticketId: input.ticketId,
        actorUserId: context.userId,
        eventType: event.eventType,
        fromValue: event.fromValue,
        toValue: event.toValue,
        metadata: {},
      });
    }

    await insertAudit(tx, context, {
      action: 'service_ticket.updated',
      entityType: 'service_ticket',
      entityId: input.ticketId,
      details: updates,
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { success: true };
}

export async function assignServiceTicket(ticketId: string, assigneeUserId: string) {
  const context = await requireBusinessPermission('service_ticket.assign');
  loadEnv();

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)))
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');

  // Verify assignee is a member of this business
  const [membership] = await db
    .select()
    .from(businessMemberships)
    .where(
      and(
        eq(businessMemberships.businessId, context.businessId),
        eq(businessMemberships.userId, assigneeUserId),
        eq(businessMemberships.status, 'active'),
      ),
    )
    .limit(1);
  if (!membership) throw new Error('Assignee is not an active member of this business.');

  await db.transaction(async (tx) => {
    await tx
      .update(serviceTickets)
      .set({ assigneeUserId, updatedAt: new Date() })
      .where(
        and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)),
      );

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: context.businessId,
      ticketId,
      actorUserId: context.userId,
      eventType: 'assigned',
      fromValue: ticket.assigneeUserId,
      toValue: assigneeUserId,
      metadata: {},
    });

    await insertAudit(tx, context, {
      action: 'service_ticket.assigned',
      entityType: 'service_ticket',
      entityId: ticketId,
      details: { assigneeUserId },
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { success: true };
}

export async function resolveServiceTicket(ticketId: string) {
  const context = await requireBusinessPermission('service_ticket.resolve');
  loadEnv();

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)))
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.status === 'resolved' || ticket.status === 'closed')
    throw new Error('Ticket is already resolved or closed.');

  await db.transaction(async (tx) => {
    await tx
      .update(serviceTickets)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)),
      );

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: context.businessId,
      ticketId,
      actorUserId: context.userId,
      eventType: 'resolved',
      fromValue: ticket.status,
      toValue: 'resolved',
      metadata: {},
    });

    await insertAudit(tx, context, {
      action: 'service_ticket.resolved',
      entityType: 'service_ticket',
      entityId: ticketId,
      details: {},
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { success: true };
}

export async function closeServiceTicket(ticketId: string) {
  const context = await requireBusinessPermission('service_ticket.close');
  loadEnv();

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)))
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.status === 'closed') throw new Error('Ticket is already closed.');

  await db.transaction(async (tx) => {
    await tx
      .update(serviceTickets)
      .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)),
      );

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: context.businessId,
      ticketId,
      actorUserId: context.userId,
      eventType: 'closed',
      fromValue: ticket.status,
      toValue: 'closed',
      metadata: {},
    });

    await insertAudit(tx, context, {
      action: 'service_ticket.closed',
      entityType: 'service_ticket',
      entityId: ticketId,
      details: {},
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { success: true };
}

export async function reopenServiceTicket(ticketId: string, reason?: string) {
  const context = await requireBusinessPermission('service_ticket.update');
  loadEnv();

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)))
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.status !== 'closed' && ticket.status !== 'resolved' && ticket.status !== 'cancelled')
    throw new Error('Only closed, resolved, or cancelled tickets can be reopened.');

  await db.transaction(async (tx) => {
    await tx
      .update(serviceTickets)
      .set({
        status: 'open',
        closedAt: null,
        resolvedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)),
      );

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: context.businessId,
      ticketId,
      actorUserId: context.userId,
      eventType: 'reopened',
      fromValue: ticket.status,
      toValue: 'open',
      metadata: { reason: reason || '' },
    });

    await insertAudit(tx, context, {
      action: 'service_ticket.reopened',
      entityType: 'service_ticket',
      entityId: ticketId,
      details: { previousStatus: ticket.status, reason: reason || '' },
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { success: true };
}

export async function escalateServiceTicket(
  ticketId: string,
  reason: string,
  newPriority?: 'high' | 'critical' | 'urgent',
) {
  const context = await requireBusinessPermission('service_ticket.update');
  loadEnv();

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)))
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.status === 'closed' || ticket.status === 'cancelled')
    throw new Error('Cannot escalate a closed or cancelled ticket.');

  const priority =
    newPriority ||
    (ticket.priority === 'normal' ? 'high' : ticket.priority === 'high' ? 'critical' : 'urgent');

  await db.transaction(async (tx) => {
    await tx
      .update(serviceTickets)
      .set({ priority, updatedAt: new Date() })
      .where(
        and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)),
      );

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: context.businessId,
      ticketId,
      actorUserId: context.userId,
      eventType: 'escalated',
      fromValue: ticket.priority,
      toValue: priority,
      metadata: { reason },
    });

    await insertAudit(tx, context, {
      action: 'service_ticket.escalated',
      entityType: 'service_ticket',
      entityId: ticketId,
      details: {
        previousPriority: ticket.priority,
        newPriority: priority,
        reason,
      },
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { success: true, newPriority: priority };
}

export async function addServiceTicketAttachment(input: {
  ticketId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageUrl: string;
}) {
  const context = await requireBusinessPermission('service_ticket.update');
  loadEnv();

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(
      and(eq(serviceTickets.id, input.ticketId), eq(serviceTickets.businessId, context.businessId)),
    )
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');

  // Validate file size (max 10MB)
  if (input.fileSize > 10 * 1024 * 1024) throw new Error('File size must not exceed 10MB.');

  // Validate file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (!allowedTypes.includes(input.fileType)) throw new Error('File type not allowed.');

  const attachmentId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(serviceTicketAttachments).values({
      id: attachmentId,
      businessId: context.businessId,
      ticketId: input.ticketId,
      filename: input.fileName,
      mimeType: input.fileType,
      sizeBytes: input.fileSize,
      storageUrl: input.storageUrl,
      uploadedBy: context.userId,
    });

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: context.businessId,
      ticketId: input.ticketId,
      actorUserId: context.userId,
      eventType: 'attachment_added',
      fromValue: null,
      toValue: input.fileName,
      metadata: { fileSize: input.fileSize, fileType: input.fileType },
    });

    await insertAudit(tx, context, {
      action: 'service_ticket.attachment_added',
      entityType: 'service_ticket',
      entityId: input.ticketId,
      details: { fileName: input.fileName, fileSize: input.fileSize },
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { id: attachmentId };
}

export async function addServiceTicketComment(input: {
  ticketId: string;
  body: string;
  isInternal?: boolean;
}) {
  const context = await requireBusinessPermission('service_ticket.create'); // Comments allowed if can create tickets
  loadEnv();

  if (!input.body || input.body.trim().length < 1) throw new Error('Comment cannot be empty.');

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(
      and(eq(serviceTickets.id, input.ticketId), eq(serviceTickets.businessId, context.businessId)),
    )
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');

  const isInternal = input.isInternal || false;
  // Only staff can create internal comments
  const isStaff = [
    'owner',
    'administrator',
    'finance_manager',
    'accountant',
    'sales_officer',
  ].includes(context.role as string);
  if (isInternal && !isStaff) throw new Error('Only staff can create internal comments.');

  const commentId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(serviceTicketComments).values({
      id: commentId,
      businessId: context.businessId,
      ticketId: input.ticketId,
      authorUserId: context.userId,
      body: input.body.trim(),
      isInternal,
    });

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: context.businessId,
      ticketId: input.ticketId,
      actorUserId: context.userId,
      eventType: 'comment_added',
      fromValue: null,
      toValue: isInternal ? 'internal' : 'public',
      metadata: { commentId },
    });

    await insertAudit(tx, context, {
      action: 'service_ticket.comment_added',
      entityType: 'service_ticket_comment',
      entityId: commentId,
      details: { ticketId: input.ticketId, isInternal },
    });
  });

  revalidatePath('/service-desk/tickets');
  revalidatePath('/portal/tickets');
  return { id: commentId };
}

export async function listServiceTicketComments(ticketId: string) {
  const context = await requireBusinessPermission('service_ticket.read');
  loadEnv();

  const isStaff = [
    'owner',
    'administrator',
    'finance_manager',
    'accountant',
    'sales_officer',
  ].includes(context.role as string);

  const comments = await db
    .select()
    .from(serviceTicketComments)
    .where(
      and(
        eq(serviceTicketComments.ticketId, ticketId),
        eq(serviceTicketComments.businessId, context.businessId),
        isStaff ? sql`true` : eq(serviceTicketComments.isInternal, false),
      ),
    )
    .orderBy(serviceTicketComments.createdAt);

  return comments;
}

/* ------------------------------------------------------------------ */
/* Client Portal - Service Tickets                                    */
/* ------------------------------------------------------------------ */

export async function createClientServiceTicket(input: {
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical' | 'urgent';
  relatedInvoiceId?: string;
  relatedQuotationId?: string;
}) {
  loadEnv();
  const userId = await requireUser();

  // Get user's business membership (client context)
  const [membership] = await db
    .select({
      businessId: businessMemberships.businessId,
      role: businessMemberships.role,
    })
    .from(businessMemberships)
    .where(and(eq(businessMemberships.userId, userId), eq(businessMemberships.status, 'active')))
    .limit(1);
  if (!membership) throw new Error('No active business membership.');

  // Client must have a customer record
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, membership.businessId), eq(customers.userId, userId)))
    .limit(1);
  if (!customer) throw new Error('No customer record found for your account. Contact support.');

  if (!input.title || input.title.trim().length < 3)
    throw new Error('Title must be at least 3 characters.');

  const priority = input.priority || 'normal';
  const ticketId = randomUUID();
  const number = await allocateDocumentNumber(db, membership.businessId, 'service_ticket');

  await db.transaction(async (tx) => {
    await tx.insert(serviceTickets).values({
      id: ticketId,
      businessId: membership.businessId,
      customerId: customer.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: 'open',
      priority,
      relatedInvoiceId: input.relatedInvoiceId || null,
      relatedQuotationId: input.relatedQuotationId || null,
      createdBy: userId,
    });

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: membership.businessId,
      ticketId,
      actorUserId: userId,
      eventType: 'created',
      fromValue: null,
      toValue: JSON.stringify({ status: 'open', priority }),
      metadata: { title: input.title.trim(), customerId: customer.id },
    });

    await insertAudit(
      tx,
      { userId, businessId: membership.businessId },
      {
        action: 'service_ticket.created',
        entityType: 'service_ticket',
        entityId: ticketId,
        details: {
          number,
          title: input.title.trim(),
          customerId: customer.id,
          priority,
          source: 'client_portal',
        },
      },
    );
  });

  revalidatePath('/portal/tickets');
  return { id: ticketId, number };
}

export async function listClientServiceTickets(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  loadEnv();
  const userId = await requireUser();

  const [membership] = await db
    .select({ businessId: businessMemberships.businessId })
    .from(businessMemberships)
    .where(and(eq(businessMemberships.userId, userId), eq(businessMemberships.status, 'active')))
    .limit(1);
  if (!membership) return [];

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, membership.businessId), eq(customers.userId, userId)))
    .limit(1);
  if (!customer) return [];

  const whereClauses = [
    eq(serviceTickets.businessId, membership.businessId),
    eq(serviceTickets.customerId, customer.id),
  ];
  if (filters?.status) whereClauses.push(eq(serviceTickets.status, filters.status));

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const tickets = await db
    .select({
      id: serviceTickets.id,
      title: serviceTickets.title,
      description: serviceTickets.description,
      status: serviceTickets.status,
      priority: serviceTickets.priority,
      createdAt: serviceTickets.createdAt,
      updatedAt: serviceTickets.updatedAt,
      resolvedAt: serviceTickets.resolvedAt,
      closedAt: serviceTickets.closedAt,
    })
    .from(serviceTickets)
    .where(and(...whereClauses))
    .orderBy(desc(serviceTickets.createdAt))
    .limit(limit)
    .offset(offset);

  return tickets;
}

export async function getClientServiceTicket(ticketId: string) {
  loadEnv();
  const userId = await requireUser();

  const [membership] = await db
    .select({ businessId: businessMemberships.businessId })
    .from(businessMemberships)
    .where(and(eq(businessMemberships.userId, userId), eq(businessMemberships.status, 'active')))
    .limit(1);
  if (!membership) throw new Error('No active business membership.');

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, membership.businessId), eq(customers.userId, userId)))
    .limit(1);
  if (!customer) throw new Error('No customer record found.');

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.id, ticketId),
        eq(serviceTickets.businessId, membership.businessId),
        eq(serviceTickets.customerId, customer.id),
      ),
    )
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');

  // Get public comments only (no internal)
  const comments = await db
    .select()
    .from(serviceTicketComments)
    .where(
      and(
        eq(serviceTicketComments.ticketId, ticketId),
        eq(serviceTicketComments.businessId, membership.businessId),
        eq(serviceTicketComments.isInternal, false),
      ),
    )
    .orderBy(serviceTicketComments.createdAt);

  // Get events
  const events = await db
    .select()
    .from(serviceTicketEvents)
    .where(
      and(
        eq(serviceTicketEvents.ticketId, ticketId),
        eq(serviceTicketEvents.businessId, membership.businessId),
      ),
    )
    .orderBy(serviceTicketEvents.createdAt);

  return { ticket, comments, events };
}

export async function addClientServiceTicketComment(input: { ticketId: string; body: string }) {
  loadEnv();
  const userId = await requireUser();

  const [membership] = await db
    .select({ businessId: businessMemberships.businessId })
    .from(businessMemberships)
    .where(and(eq(businessMemberships.userId, userId), eq(businessMemberships.status, 'active')))
    .limit(1);
  if (!membership) throw new Error('No active business membership.');

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, membership.businessId), eq(customers.userId, userId)))
    .limit(1);
  if (!customer) throw new Error('No customer record found.');

  const [ticket] = await db
    .select()
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.businessId, membership.businessId),
        eq(serviceTickets.customerId, customer.id),
      ),
    )
    .limit(1);
  if (!ticket) throw new Error('Ticket not found.');

  if (!input.body || input.body.trim().length < 1) throw new Error('Comment cannot be empty.');

  const commentId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(serviceTicketComments).values({
      id: commentId,
      businessId: membership.businessId,
      ticketId: input.ticketId,
      authorUserId: userId,
      body: input.body.trim(),
      isInternal: false,
    });

    await tx.insert(serviceTicketEvents).values({
      id: randomUUID(),
      businessId: membership.businessId,
      ticketId: input.ticketId,
      actorUserId: userId,
      eventType: 'comment_added',
      fromValue: null,
      toValue: 'public',
      metadata: { commentId },
    });

    await insertAudit(
      tx,
      { userId, businessId: membership.businessId },
      {
        action: 'service_ticket.comment_added',
        entityType: 'service_ticket_comment',
        entityId: commentId,
        details: { ticketId: input.ticketId, source: 'client_portal' },
      },
    );
  });

  revalidatePath('/portal/tickets');
  return { id: commentId };
}

export async function listServiceDeskMembers() {
  const context = await requireBusinessPermission('service_ticket.read');
  loadEnv();

  const rows = await db
    .select({
      id: businessMemberships.id,
      userId: businessMemberships.userId,
      role: businessMemberships.role,
      status: businessMemberships.status,
      deletedAt: businessMemberships.deletedAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(businessMemberships)
    .innerJoin(user, eq(user.id, businessMemberships.userId))
    .where(
      and(
        eq(businessMemberships.businessId, context.businessId),
        sql`${businessMemberships.deletedAt} IS NULL`,
      ),
    )
    .orderBy(desc(businessMemberships.createdAt));
  return rows;
}

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

export async function listCustomers() {
  const context = await requireBusinessPermission('service_ticket.read');
  loadEnv();

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .where(eq(customers.businessId, context.businessId))
    .orderBy(desc(customers.createdAt));
  return rows;
}
