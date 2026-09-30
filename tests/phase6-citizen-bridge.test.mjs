import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const base = resolve('backend','build','crisismesh_simulation_cli');
const executable = existsSync(`${base}.exe`) ? `${base}.exe` : base;

test('citizen ownership protects confirmation and escalation lifecycle actions', () => {
  assert.ok(existsSync(executable),'Build crisismesh_simulation_cli before running Phase 6 tests.');
  const commands = [
    'REPORT|MEDICAL|LOC-007|4|4|1|Phase six resolved flow|user-a',
    'PROCESS_NEXT',
    'RESPONSE_COMPLETED|INC-201',
    'CONFIRM_RESOLVED|INC-201|user-b',
    'CONFIRM_RESOLVED|INC-201|user-a',
    'REPORT|FIRE|LOC-010|5|5|1|Phase six escalation flow|user-a',
    'PROCESS_NEXT',
    'RESPONSE_COMPLETED|INC-202',
    'ESCALATE|INC-202|user-b|Another citizen must not escalate this incident',
    'ESCALATE|INC-202|user-a|Fire remains active and more support is required',
  ];
  const process=spawnSync(executable,['--server'],{input:`${commands.join('\n')}\n`,encoding:'utf8',timeout:20000});
  assert.equal(process.status,0,process.stderr);
  const responses=process.stdout.trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(responses.length,commands.length);
  assert.equal(responses[2].state.incidents.find(item=>item.incidentId==='INC-201').status,'AWAITING_USER_CONFIRMATION');
  assert.equal(responses[3].ok,false,'another user cannot confirm the incident');
  assert.equal(responses[4].state.incidents.find(item=>item.incidentId==='INC-201').status,'CLOSED');
  assert.equal(responses[8].ok,false,'another user cannot escalate the incident');
  const escalated=responses[9].state.incidents.find(item=>item.incidentId==='INC-202');
  assert.equal(escalated.status,'QUEUED');
  assert.equal(escalated.assignedResponderId,'');
  assert.match(escalated.escalationReason,/more support/i);
});
