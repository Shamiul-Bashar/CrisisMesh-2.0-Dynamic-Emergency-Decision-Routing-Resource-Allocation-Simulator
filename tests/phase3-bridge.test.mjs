import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('Phase 3 live HTTP bridge serves authoritative city, dispatch and graph analysis', { timeout: 60000 }, async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'error' });
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    const request = async (body, ok = true) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/simulation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(data.ok, ok, data.error);
      assert.ok(Array.isArray(data.events));
      assert.ok(Object.hasOwn(data, 'state') && Object.hasOwn(data, 'result'));
      return data;
    };
    const initial = await request({ action: 'STATE' });
    assert.equal(initial.state.network.nodes.length, 24);
    assert.equal(initial.state.network.roads.length, 42);
    assert.equal(initial.state.facilities.length, 14);
    assert.equal(initial.state.responders.length, 12);
    const report = { action: 'REPORT', type: 'FIRE', locationId: 'LOC-007', severity: 5, urgency: 5, victimCount: 1, description: 'Phase 3 bridge smoke' };
    await request(report, false);
    const reported = await request({ ...report, reportedByUserId: 'citizen-smoke' });
    const dispatched = await request({ action: 'PROCESS_NEXT' });
    const record = dispatched.state.dispatches[0];
    assert.equal(record.incidentId, reported.result.incident.incidentId);
    assert.equal(record.responderId, record.candidateSummaries[0].responderId);
    assert.equal(record.candidateSummaries.length, 3);
    const repeated = await request({ action: 'STATE' });
    assert.deepEqual(repeated.state.dispatches, dispatched.state.dispatches);
    for (const algorithm of ['BFS', 'DFS', 'DIJKSTRA']) {
      const analysis = await request({ action: `ANALYZE_${algorithm}`, source: 'LOC-003', destination: 'LOC-007' });
      assert.equal(analysis.result.algorithm, algorithm);
      assert.equal(analysis.result.reachable, true);
      assert.equal(analysis.result.graphRevision, analysis.state.network.graphRevision);
      assert.ok(analysis.events.length > 0);
      for (const event of analysis.events) assert.equal(event.graphRevision, analysis.result.graphRevision);
      if (algorithm === 'BFS') assert.equal(analysis.result.minimumHops, analysis.result.pathEdges.length);
      if (algorithm === 'DIJKSTRA') assert.ok(analysis.result.weightedCost > 0);
    }
    for (const edgeId of ['R-019', 'R-020', 'R-021']) await request({ action: 'BLOCK', edgeId });
    const blocked = await request({ action: 'STATE' });
    assert.equal(blocked.state.network.graphRevision, initial.state.network.graphRevision + 3);
    for (const algorithm of ['BFS', 'DFS', 'DIJKSTRA']) {
      const analysis = await request({ action: `ANALYZE_${algorithm}`, source: 'LOC-003', destination: 'LOC-007' });
      assert.equal(analysis.result.reachable, false);
      if (algorithm === 'BFS') assert.equal(analysis.result.minimumHops, null);
      if (algorithm === 'DFS') assert.ok(analysis.events.some(e => e.type === 'DFS_BACKTRACK'));
    }
    const recovered = await request({ action: 'UNBLOCK', edgeId: 'R-019' });
    assert.equal(recovered.state.incidents[0].status, 'EN_ROUTE');
    assert.equal(recovered.state.dispatches[0].graphRevision, recovered.state.network.graphRevision);
    const summary = {
      facilities: Object.fromEntries([...new Set(initial.state.facilities.map(f => f.category))].map(type => [type, initial.state.facilities.filter(f => f.category === type).length])),
      responders: Object.fromEntries([...new Set(initial.state.responders.map(r => r.type))].map(type => [type, initial.state.responders.filter(r => r.type === type).length])),
      congestion: { normal: initial.state.network.roads.filter(r => r.congestion <= 3).length, moderate: initial.state.network.roads.filter(r => r.congestion >= 4 && r.congestion <= 5).length, high: initial.state.network.roads.filter(r => r.congestion >= 6).length },
      risk: [1, 2, 3].map(level => initial.state.network.roads.filter(r => r.risk === level).length),
    };
    console.log('Authoritative city distribution:', JSON.stringify(summary));
  } finally {
    await server.close();
  }
});
