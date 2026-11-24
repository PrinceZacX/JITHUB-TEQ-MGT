import { Headset, BriefcaseBusiness, Users, FileText } from 'lucide-react';

export const SERVICE_DESK_EMPTY_STATES: Record<
  string,
  {
    title: string;
    description: string;
    primaryAction?: { label: string; href: string };
    secondaryAction?: { label: string; href: string };
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
  }
> = {
  'Service Desk': {
    title: 'No service tickets yet',
    description: 'Create your first service ticket to start tracking support requests.',
    primaryAction: { label: 'Create ticket', href: '/service-desk/tickets/new' },
    secondaryAction: { label: 'Invite client', href: '/service-desk/clients' },
    icon: Headset,
    iconColor: 'bg-blue-100 text-blue-600',
  },
  'Client Portal': {
    title: 'No service requests yet',
    description: 'Submit your first service request to get support from our team.',
    primaryAction: { label: 'New request', href: '/portal/tickets/new' },
    icon: BriefcaseBusiness,
    iconColor: 'bg-indigo-100 text-indigo-600',
  },
  Clients: {
    title: 'No active client members yet',
    description: 'Invite your first client to start collaborating on service tickets.',
    primaryAction: { label: 'Invite client', href: '/service-desk/clients' },
    icon: Users,
    iconColor: 'bg-purple-100 text-purple-600',
  },
  default: {
    title: 'No results',
    description: 'Try adjusting your search or filters.',
    icon: FileText,
    iconColor: 'bg-jt-border text-jt-muted',
  },
};
