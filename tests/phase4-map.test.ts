import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateEdges, geometryFor, incidentTone, playbackFrame, restartPlayback, roadStyle, routeGeometry, routeModels, visibleIncidents } from '../features/command-center/mapPresentation.ts';
import type { AnalysisResponse, SimulationState, AuthoritativeNetwork, CandidateSummary } from '../core/simulation/types.ts';
const network: AuthoritativeNetwork = {graphRevision:4,nodes:[{locationId:'A',name:'A',zone:'CENTRAL',category:'CIVIC',x:10,y:20,status:'OPEN'},{locationId:'B',name:'B',zone:'CENTRAL',category:'CIVIC',x:20,y:30,status:'OPEN'}],roads:[{roadId:'R',from:'A',to:'B',distance:2,travelTime:3,risk:2,congestion:6,capacity:20,blocked:false,roadClass:'ARTERIAL'}]};
const candidate={reachable:true,pathNodes:['A','B'],pathEdges:['R']} as CandidateSummary;
function state(){return {network,incidents:[{incidentId:'I1',status:'EN_ROUTE'},{incidentId:'I2',status:'EN_ROUTE'}],dispatches:[{incidentId:'I1',reachable:true,graphRevision:4,stale:false,candidateSummaries:[candidate]},{incidentId:'I2',reachable:true,graphRevision:4,stale:false,candidateSummaries:[candidate]}]} as SimulationState;}
function analysis(algorithm='BFS'){return {ok:true,state:null,result:{algorithm,graphRevision:4,reachable:true,pathEdges:['R'],pathNodes:['A','B']},events:[{type:'NODE_VISITED',nodeId:'A',edgeId:'',graphRevision:4,step:1,algorithm,message:'visit'},{type:'COMPLETE',nodeId:'B',edgeId:'R',graphRevision:4,step:2,algorithm,message:'done'}]} as AnalysisResponse;}
test('closed incidents are excluded',()=>{const s=state();s.incidents[0].status='CLOSED';assert.deepEqual(visibleIncidents(s.incidents).map(i=>i.incidentId),['I2']);});
test('awaiting confirmation is visible and calm',()=>{const s=state();s.incidents[0].status='AWAITING_USER_CONFIRMATION';assert.equal(visibleIncidents(s.incidents).length,2);assert.equal(incidentTone(s.incidents[0].status),'confirmation');});
test('multiple dispatches have separate models',()=>assert.deepEqual(routeModels(state(),null).map(r=>r.dispatch.incidentId),['I1','I2']));
test('selection dims but preserves other dispatch',()=>assert.deepEqual(routeModels(state(),'I1').map(r=>r.opacity),[1,.28]));
test('stale dispatch cannot move',()=>{const s=state();s.dispatches[0].stale=true;s.dispatches[1].graphRevision=3;assert.ok(routeModels(s,null).every(r=>r.stale&&!r.movable));});
test('candidate edges preserve backend identity and ordering',()=>assert.equal(candidateEdges(state().dispatches[0].candidateSummaries[0]),candidate.pathEdges));
test('unreachable candidate draws no route',()=>assert.deepEqual(candidateEdges({...candidate,reachable:false}),[]));
test('road hierarchy follows authoritative class',()=>assert.ok(roadStyle(network.roads[0]).width>roadStyle({...network.roads[0],roadClass:'LOCAL'}).width));
test('blocked status overrides open',()=>assert.equal(roadStyle({...network.roads[0],blocked:true}).status,'blocked'));
test('congestion and risk map deterministically',()=>{assert.deepEqual(roadStyle(network.roads[0]),{width:6,status:'open',congestion:'high',risk:'moderate'});assert.deepEqual(roadStyle(network.roads[0]),roadStyle(network.roads[0]));});
test('revision change invalidates and clears playback',()=>{const f=playbackFrame(analysis(),2,5);assert.ok(f.outdated);assert.equal(f.explored.size,0);assert.deepEqual(f.finalEdges,[]);});
test('BFS final path is backend result, not exploration',()=>{const a=analysis();assert.equal(playbackFrame(a,2,4).finalEdges,a.result!.pathEdges);assert.deepEqual(playbackFrame(a,1,4).finalEdges,[]);});
test('DFS backtrack removes current branch and returns parent',()=>{const a=analysis('DFS');a.events=[{...a.events[0],type:'DFS_NODE_DISCOVERED',nodeId:'B',edgeId:'R',parentNodeId:'A'},{...a.events[1],type:'DFS_BACKTRACK',nodeId:'B',parentNodeId:'A'}];const f=playbackFrame(a,2,4);assert.ok(f.backtrack);assert.equal(f.current,'A');assert.equal(f.branch.size,0);});
test('Dijkstra final path is backend result',()=>{const a=analysis('DIJKSTRA');assert.equal(playbackFrame(a,2,4).finalEdges,a.result!.pathEdges);});
test('restart produces deterministic empty frame',()=>{assert.equal(restartPlayback(),0);assert.deepEqual(playbackFrame(analysis(),restartPlayback(),4),playbackFrame(analysis(),0,4));});
test('presentation movement and geometry never mutate state',()=>{const s=state(),before=JSON.stringify(s);routeModels(s,'I1');const g=geometryFor(network);assert.ok(routeGeometry(['B','A'],['R'],g.roads).startsWith('M 200 240'));assert.equal(routeGeometry(['A','C'],['R'],g.roads),'');assert.equal(JSON.stringify(s),before);});
test('completed and unreachable routes never move',()=>{const s=state();s.incidents[0].status='AWAITING_USER_CONFIRMATION';s.dispatches[1].reachable=false;assert.ok(routeModels(s,null).every(r=>!r.movable));});
test('unreachable analysis never exposes a final route',()=>{const a=analysis();a.result!.reachable=false;assert.deepEqual(playbackFrame(a,2,4).finalEdges,[]);});
