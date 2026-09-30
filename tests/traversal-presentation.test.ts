import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPanel, defaultPanelPosition } from '../features/command-center/floatingPanelGeometry.ts';
import { playbackEventText, playbackFrame } from '../features/command-center/mapPresentation.ts';
import type { AnalysisEvent, AnalysisResponse } from '../core/simulation/types.ts';

const event = (type: string, nodeId: string, edgeId = '', parentNodeId = ''): AnalysisEvent =>
  ({ type, nodeId, edgeId, parentNodeId, algorithm: 'BFS', step: 1, graphRevision: 4, message: '' });
const trace = (events: AnalysisEvent[], algorithm = 'BFS'): AnalysisResponse => ({ ok: true, state: null,
  result: { algorithm, graphRevision: 4, source: 'A', destination: 'C', reachable: true,
    pathNodes: ['A','C'], pathEdges: ['AC'] }, events } as AnalysisResponse);

test('dragging clamps to all corners with an inset', () => {
  const bounds={width:800,height:600,panelWidth:326,panelHeight:350};
  assert.deepEqual(clampPanel({x:-500,y:-500},bounds),{x:12,y:12});
  assert.deepEqual(clampPanel({x:9999,y:-50},bounds),{x:462,y:12});
  assert.deepEqual(clampPanel({x:-50,y:9999},bounds),{x:12,y:238});
  assert.deepEqual(defaultPanelPosition(bounds),{x:462,y:238});
});
test('resize and restore reclamp a previously valid position', () => {
  const bounds={width:410,height:400,panelWidth:326,panelHeight:370};
  assert.deepEqual(clampPanel({x:462,y:238},bounds),{x:72,y:18});
  assert.deepEqual(clampPanel({x:NaN,y:Infinity},bounds),{x:72,y:18});
});
test('oversized panels never produce negative coordinates', () => {
  assert.deepEqual(clampPanel({x:20,y:20},{width:20,height:20,panelWidth:100,panelHeight:100}),{x:0,y:0});
});
test('BFS frontier, visit order and hop levels follow consumed events only', () => {
  const a=trace([event('BFS_CURRENT_NODE','A'),event('BFS_NODE_DISCOVERED','B','AB','A'),event('BFS_ENQUEUE','B'),event('BFS_CURRENT_NODE','B'),event('BFS_COMPLETE','C')]);
  const before=JSON.stringify(a), f=playbackFrame(a,3,4);
  assert.deepEqual([...f.frontier],['B']);assert.deepEqual(f.visitOrder,['A']);assert.equal(f.levels.get('B'),1);
  assert.deepEqual(playbackFrame(a,4,4).visitOrder,['A','B']);assert.equal(playbackFrame(a,4,4).frontier.size,0);
  assert.equal(JSON.stringify(a),before);
});
test('already-discovered and duplicate visit events never invent visit order', () => {
  const a=trace([event('BFS_CURRENT_NODE','A'),event('BFS_NODE_ALREADY_VISITED','B','AB','A'),event('BFS_CURRENT_NODE','A'),event('BFS_COMPLETE','C')]);
  const f=playbackFrame(a,3,4);assert.deepEqual(f.visitOrder,['A']);assert.equal(f.current,'A');
});
test('DFS backtracking recovers the consumed parent edge and reverses direction', () => {
  const a=trace([event('DFS_CURRENT_NODE','A'),event('DFS_NODE_DISCOVERED','B','AB','A'),event('DFS_CURRENT_NODE','B'),event('DFS_BACKTRACK','B','','A'),event('DFS_COMPLETE','C')],'DFS');
  const f=playbackFrame(a,4,4);
  assert.equal(f.activeEdge,'AB');assert.equal(f.activeFrom,'B');assert.equal(f.current,'A');assert.equal(f.backtrackCount,1);assert.equal(f.branch.size,0);
  assert.equal(playbackEventText(f,id=>id==='A'?'Central Hub':id),'Backtracking to Central Hub');
});
test('Dijkstra tentative nodes do not become settled on relaxation', () => {
  const a=trace([event('NODE_EXTRACTED','A'),event('EDGE_RELAXED','B','AB'),event('NODE_EXTRACTED','B'),event('COMPLETE','C')],'DIJKSTRA');
  const f=playbackFrame(a,2,4);assert.deepEqual([...f.frontier],['B']);assert.deepEqual(f.visitOrder,['A']);assert.equal(f.activeFrom,'A');
  assert.equal(playbackFrame(a,3,4).frontier.size,0);
});
test('completion shows only the authoritative path and stops active-edge motion', () => {
  const a=trace([event('BFS_CURRENT_NODE','A'),event('BFS_EDGE_EXAMINED','A','AB'),event('BFS_COMPLETE','C')]);
  const f=playbackFrame(a,3,4);assert.deepEqual(f.finalEdges,['AC']);assert.deepEqual([...f.finalNodes],['A','C']);assert.equal(f.activeEdge,'');
});
test('revision invalidation clears all new visual state', () => {
  const f=playbackFrame(trace([event('BFS_NODE_DISCOVERED','B','AB','A')]),1,5);
  assert.ok(f.outdated);assert.equal(f.frontier.size,0);assert.equal(f.finalNodes.size,0);assert.equal(f.destination,'');assert.equal(f.activeEdge,'');assert.deepEqual(f.visitOrder,[]);
});
test('Dijkstra source equals destination has a single numbered result node', () => {
  const a=trace([event('SOURCE_EQUALS_DESTINATION','A'),event('COMPLETE','A')],'DIJKSTRA');
  a.result!.destination='A';a.result!.pathNodes=['A'];a.result!.pathEdges=[];
  const f=playbackFrame(a,2,4);assert.deepEqual(f.visitOrder,['A']);assert.deepEqual([...f.finalNodes],['A']);
});
