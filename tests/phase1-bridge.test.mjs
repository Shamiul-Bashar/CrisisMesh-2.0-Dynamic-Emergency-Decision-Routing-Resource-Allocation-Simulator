import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const base = resolve('backend', 'build', 'crisismesh_simulation_cli');
const executable = existsSync(`${base}.exe`) ? `${base}.exe` : base;

test('simulation CLI commands share the authoritative response envelope', () => {
  assert.ok(existsSync(executable), 'Build crisismesh_simulation_cli before running Phase 1 tests.');
  const commands = [
    'STATE',
    'REPORT|FIRE|LOC-007|5|5|2|Phase one contract test|citizen-42',
    'PROCESS_NEXT',
    'BLOCK|R-001',
    'UNBLOCK|R-001',
    'BLOCK|R-002',
    'UNDO_BLOCK',
    'SET_RESPONDER|POLICE-UNIT-01|BUSY',
    'RESPONSE_COMPLETED|INC-201',
    'ESCALATE|INC-201|citizen-42|More help required',
    'PROCESS_NEXT',
    'RESPONSE_COMPLETED|INC-201',
    'CONFIRM_RESOLVED|INC-201|citizen-42',
    'REPORT|MEDICAL|LOC-010|3|3|1|Legacy resolve contract|citizen-42',
    'RESOLVE|INC-202',
    'RESET',
    'UNKNOWN_COMMAND',
  ];
  const process = spawnSync(executable, ['--server'], {
    input: `${commands.join('\n')}\n`, encoding: 'utf8', timeout: 20_000,
  });
  assert.equal(process.status, 0, process.stderr);
  const responses = process.stdout.trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(responses.length, commands.length);

  for (const response of responses) {
    assert.equal(typeof response.ok, 'boolean');
    assert.ok(Array.isArray(response.events));
    assert.ok(Object.hasOwn(response, 'state'));
    assert.ok(Object.hasOwn(response, 'result'));
    if (response.ok) assert.equal(response.state.engine, 'ONLINE');
    else {
      assert.equal(response.state, null);
      assert.equal(typeof response.error, 'string');
    }
  }

  assert.equal(responses[0].ok, true);
  assert.ok(responses[0].state);
  assert.equal(responses[0].state.engine, 'ONLINE');
  assert.deepEqual(responses.at(-1).events, []);
});
