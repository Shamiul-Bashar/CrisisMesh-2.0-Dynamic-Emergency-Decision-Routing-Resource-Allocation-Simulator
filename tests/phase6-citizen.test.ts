import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredUser } from '../core/auth/credentials.ts';
import type { SimulationIncident } from '../core/simulation/types.ts';
import {
  canManageIncident,
  citizenStatus,
  incidentsOwnedBy,
  isMeaningfulEscalationReason,
  messagesVisibleTo,
  safeCitizenProfile,
  type CitizenMessage,
} from '../features/citizen/citizenPresentation.ts';

const incident = (incidentId: string, owner: string, status = 'QUEUED'): SimulationIncident => ({
  incidentId,
  type: 'MEDICAL',
  locationId: 'LOC-007',
  severity: 4,
  urgency: 4,
  victimCount: 1,
  priorityScore: 88,
  status,
  requiredResponderType: 'AMBULANCE',
  assignedResponderId: '',
  reportedSequence: Number(incidentId.replace(/\D/g, '')),
  reportedByUserId: owner,
});

test('citizen incident presentation contains only the authenticated owner records', () => {
  const all = [incident('INC-201','user-a'),incident('INC-202','user-b'),incident('INC-203','user-a','CLOSED')];
  assert.deepEqual(incidentsOwnedBy(all,'user-a').map(item=>item.incidentId),['INC-201','INC-203']);
  assert.deepEqual(incidentsOwnedBy(all,'user-b').map(item=>item.incidentId),['INC-202']);
  assert.deepEqual(incidentsOwnedBy(all,null),[]);
});

test('citizen inbox includes broadcasts and own direct messages only', () => {
  const messages: CitizenMessage[] = [
    {id:'own',recipientId:'user-a',senderId:'author',senderName:'Author',subject:'Direct',body:'A',createdAt:2,read:false,type:'individual'},
    {id:'other',recipientId:'user-b',senderId:'author',senderName:'Author',subject:'Private',body:'B',createdAt:3,read:false,type:'individual'},
    {id:'all',recipientId:'all',senderId:'author',senderName:'CrisisMesh',subject:'Broadcast',body:'All',createdAt:4,read:false,type:'broadcast'},
  ];
  assert.deepEqual(messagesVisibleTo(messages,'user-a').map(message=>message.id),['all','own']);
  assert.deepEqual(messagesVisibleTo(messages,'user-b').map(message=>message.id),['all','other']);
});

test('confirmation controls are available only to the reporting owner at the confirmation stage', () => {
  const awaiting = incident('INC-201','user-a','AWAITING_USER_CONFIRMATION');
  assert.equal(canManageIncident(awaiting,'user-a'),true);
  assert.equal(canManageIncident(awaiting,'user-b'),false);
  assert.equal(canManageIncident({...awaiting,status:'CLOSED'},'user-a'),false);
  assert.equal(citizenStatus(awaiting.status).label,'Please confirm the outcome');
});

test('additional-help requests require a meaningful reason before calling the bridge', () => {
  assert.equal(isMeaningfulEscalationReason(''),false);
  assert.equal(isMeaningfulEscalationReason('Too short'),false);
  assert.equal(isMeaningfulEscalationReason('The responder has not arrived'),true);
});

test('closed incidents have citizen-friendly history presentation', () => {
  assert.equal(citizenStatus('CLOSED').label,'Emergency closed');
  assert.equal(citizenStatus('EN_ROUTE').label,'Help is on the way');
  assert.equal(citizenStatus('ESCALATED').label,'Additional help requested');
});

test('safe citizen profile retains identity without credential fields', () => {
  const user: StoredUser = {id:'user-a',name:'Citizen A',username:'citizen-a',phone:'01700000000',email:'a@example.test',passwordHash:'secret-hash',accountStatus:'Active'};
  const profile = safeCitizenProfile(user);
  assert.equal(profile?.id,user.id);
  assert.equal(profile?.username,user.username);
  assert.equal(Object.hasOwn(profile!,'passwordHash'),false);
  assert.equal(Object.hasOwn(profile!,'password'),false);
  assert.equal(Object.hasOwn(profile!,'otp'),false);
});
