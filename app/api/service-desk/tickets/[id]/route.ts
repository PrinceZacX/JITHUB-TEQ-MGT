import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { serviceTickets, serviceTicketComments, serviceTicketEvents, serviceTicketAttachments } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { requireBusinessPermission } from '@/app/actions/finance';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireBusinessPermission('service_ticket.read');

    const { id: ticketId } = await params;

    const [ticket] = await db
      .select()
      .from(serviceTickets)
      .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.businessId, context.businessId)))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

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

    return NextResponse.json({ ticket, comments, events, attachments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load ticket.' }, { status: 400 });
  }
}
