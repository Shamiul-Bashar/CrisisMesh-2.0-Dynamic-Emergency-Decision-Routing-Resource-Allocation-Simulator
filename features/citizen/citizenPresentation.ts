import type { StoredUser } from '../../core/auth/credentials';
import type { SimulationIncident } from '../../core/simulation/types';

export type CitizenMessage = {
  id: string;
  recipientId: string | 'all';
  senderId: string;
  senderName: string;
  subject: string;
  body: string;
  createdAt: number;
  read: boolean;
  type: 'individual' | 'broadcast';
};

export const lifecycleStages = [
  'Reported',
  'Processing',
  'Responder assigned',
  'En route',
  'Response completed',
  'Confirmation',
  'Closed',
] as const;

const statusCopy: Record<string, { label: string; guidance: string; tone: string; stage: number }> = {
  QUEUED: { label: 'Waiting for dispatch', guidance: 'Your report is in the emergency response queue.', tone: 'waiting', stage: 1 },
  TRIAGED: { label: 'Request being assessed', guidance: 'The response team is assessing your emergency.', tone: 'waiting', stage: 1 },
  PRIORITY_CALCULATED: { label: 'Preparing dispatch', guidance: 'Your request has been assessed and is ready for assignment.', tone: 'waiting', stage: 1 },
  ASSIGNED: { label: 'Responder assigned', guidance: 'A response unit has been assigned to your emergency.', tone: 'assigned', stage: 2 },
  EN_ROUTE: { label: 'Help is on the way', guidance: 'Your assigned response unit is travelling to the incident location.', tone: 'enroute', stage: 3 },
  REROUTE_REQUIRED: { label: 'Route being updated', guidance: 'The response team is finding another safe route.', tone: 'warning', stage: 3 },
  UNREACHABLE: { label: 'Response route temporarily unavailable', guidance: 'The response team is reviewing alternate assistance options.', tone: 'warning', stage: 2 },
  RESPONSE_COMPLETED: { label: 'Response completed', guidance: 'Field response is complete. Confirmation may be requested shortly.', tone: 'complete', stage: 4 },
  AWAITING_USER_CONFIRMATION: { label: 'Please confirm the outcome', guidance: 'Tell us whether the emergency has been resolved.', tone: 'confirmation', stage: 5 },
  ESCALATED: { label: 'Additional help requested', guidance: 'Your request has been returned for urgent reassessment.', tone: 'warning', stage: 1 },
  CLOSED: { label: 'Emergency closed', guidance: 'You confirmed that the emergency was resolved.', tone: 'closed', stage: 6 },
};

export function citizenStatus(status: string) {
  return statusCopy[status] ?? {
    label: status.replace(/_/g, ' ').toLowerCase().replace(/^./, value => value.toUpperCase()),
    guidance: 'Your emergency request is being monitored.',
    tone: 'waiting',
    stage: 0,
  };
}

export function incidentsOwnedBy(incidents: SimulationIncident[], userId: string | null) {
  if (!userId) return [];
  return incidents.filter(incident => incident.reportedByUserId === userId);
}

export function messagesVisibleTo(messages: CitizenMessage[], userId: string | null) {
  if (!userId) return [];
  return messages
    .filter(message => message.recipientId === userId || message.recipientId === 'all')
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function canManageIncident(incident: SimulationIncident, userId: string | null) {
  return Boolean(userId && incident.reportedByUserId === userId && incident.status === 'AWAITING_USER_CONFIRMATION');
}

export function isMeaningfulEscalationReason(reason: string) {
  return reason.trim().length >= 10;
}

export function safeCitizenProfile(user: StoredUser | null) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    phone: user.phone,
    email: user.email,
    accountStatus: user.accountStatus ?? 'Active',
  };
}
