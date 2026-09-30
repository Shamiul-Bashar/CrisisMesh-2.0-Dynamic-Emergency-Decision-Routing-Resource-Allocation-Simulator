import type { AnalysisResponse, AuthoritativeNetwork, CandidateSummary, DispatchRecord, SimulationIncident, SimulationState } from '../../core/simulation/types';

export type MapNode = AuthoritativeNetwork['nodes'][number];
export type MapRoad = AuthoritativeNetwork['roads'][number];
export type Selection = { kind: 'incident' | 'road' | 'facility' | 'responder'; id: string } | null;
export const incidentTone = (status: string) => ['CLOSED', 'RESOLVED'].includes(status) ? 'hidden'
  : ['RESPONSE_COMPLETED', 'AWAITING_USER_CONFIRMATION'].includes(status) ? 'confirmation'
  : ['UNREACHABLE', 'ESCALATED', 'REROUTE_REQUIRED'].includes(status) ? 'hazard' : 'emergency';
export const visibleIncidents = (incidents: SimulationIncident[]) => incidents.filter(i => incidentTone(i.status) !== 'hidden');
export const roadStyle = (road: MapRoad) => ({
  width: { ARTERIAL: 6, PRIMARY: 4.5, SECONDARY: 3.2, LOCAL: 2.2 }[road.roadClass],
  status: road.blocked ? 'blocked' : 'open',
  congestion: road.congestion >= 6 ? 'high' : road.congestion >= 4 ? 'moderate' : 'normal',
  risk: road.risk >= 3 ? 'high' : road.risk >= 2 ? 'moderate' : 'low',
});
export function routeModels(state: SimulationState, selected: string | null) {
  return state.dispatches.filter(d => state.incidents.some(i => i.incidentId === d.incidentId && incidentTone(i.status) !== 'hidden')).map(d => ({
    dispatch: d, opacity: selected && selected !== d.incidentId ? .28 : 1,
    stale: d.stale || d.graphRevision !== state.network.graphRevision,
    movable: d.reachable && !d.stale && d.graphRevision === state.network.graphRevision &&
      state.incidents.some(i => i.incidentId === d.incidentId && ['ASSIGNED', 'EN_ROUTE'].includes(i.status)),
  }));
}
export const candidateEdges = (candidate: CandidateSummary) => candidate.reachable ? candidate.pathEdges : [];
export const selectionReasons: Record<DispatchRecord['selectionReason'], string> = {
  LOWEST_WEIGHTED_COST: 'Lowest weighted operational cost',
  ONLY_REACHABLE_UNIT: 'Only reachable compatible responder',
  LOWER_TRAVEL_TIME_TIEBREAK: 'Lower travel time resolved the tie',
  LOWER_DISTANCE_TIEBREAK: 'Lower distance resolved the tie',
  RESPONDER_ID_TIEBREAK: 'Deterministic responder ID tie-break',
  ASSIGNED_RESPONDER_REROUTE: 'Existing responder rerouted after network change',
};
export type RoadGeometry = { road: MapRoad; a: MapNode; b: MapNode; cx: number; cy: number; d: string };
export function geometryFor(network: AuthoritativeNetwork) {
  const nodes = new Map(network.nodes.map(n => [n.locationId, n]));
  const roads = new Map<string, RoadGeometry>();
  network.roads.forEach((road, index) => {
    const a = nodes.get(road.from), b = nodes.get(road.to);
    if (!a || !b) return;
    const dx = (b.x-a.x)*10, dy = (b.y-a.y)*8, length = Math.hypot(dx, dy) || 1;
    const bend = ((index % 3)-1)*Math.min(9, length*.08);
    const cx = (a.x+b.x)*5-dy/length*bend, cy = (a.y+b.y)*4+dx/length*bend;
    roads.set(road.roadId, { road, a, b, cx, cy, d: `M ${a.x*10} ${a.y*8} Q ${cx} ${cy} ${b.x*10} ${b.y*8}` });
  });
  const groups = new Map<string, MapNode[]>();
  for (const node of network.nodes) groups.set(node.zone, [...(groups.get(node.zone) ?? []), node]);
  const zones = [...groups].map(([name, members]) => ({
    name, x: members.reduce((sum,n)=>sum+n.x*10,0)/members.length,
    y: members.reduce((sum,n)=>sum+n.y*8,0)/members.length,
    minX: Math.min(...members.map(n=>n.x*10))-35, minY: Math.min(...members.map(n=>n.y*8))-28,
    width: (Math.max(...members.map(n=>n.x))-Math.min(...members.map(n=>n.x)))*10+70,
    height: (Math.max(...members.map(n=>n.y))-Math.min(...members.map(n=>n.y)))*8+56,
  }));
  return { nodes, roads, zones };
}
/** Orient the backend's ordered edges; never find or rank a route here. */
export function routeGeometry(pathNodes: string[], pathEdges: string[], roads: Map<string, RoadGeometry>) {
  if (pathNodes.length !== pathEdges.length+1 || !pathEdges.length) return '';
  const parts: string[] = [];
  for (let index=0;index<pathEdges.length;index++) {
    const edge=roads.get(pathEdges[index]);
    if (!edge) return '';
    const from=pathNodes[index], to=pathNodes[index+1];
    if (!((edge.a.locationId===from && edge.b.locationId===to)||(edge.b.locationId===from && edge.a.locationId===to))) return '';
    const a=edge.a.locationId===from?edge.a:edge.b, b=edge.a.locationId===from?edge.b:edge.a;
    if (!index) parts.push(`M ${a.x*10} ${a.y*8}`);
    parts.push(`Q ${edge.cx} ${edge.cy} ${b.x*10} ${b.y*8}`);
  }
  return parts.join(' ');
}
export type PlaybackFrame = {
  outdated: boolean; complete: boolean; visited: Set<string>; explored: Set<string>; branch: Set<string>;
  current: string; backtrack: boolean; finalEdges: string[]; event: AnalysisResponse['events'][number] | null;
  algorithm: string; source: string; destination: string; revision: number;
  frontier: Set<string>; visitOrder: string[]; levels: Map<string, number>; finalNodes: Set<string>;
  activeEdge: string; activeFrom: string; backtrackCount: number; playing: boolean; showOrder: boolean;
};
/** Project the consumed C++ events only. Never search neighbors, select routes or calculate costs. */
export function playbackFrame(analysis: AnalysisResponse | null, count: number, revision: number): PlaybackFrame {
  const frame: PlaybackFrame = { outdated: false, complete: false, visited: new Set(), explored: new Set(), branch: new Set(), current: '', backtrack: false, finalEdges: [], event: null,
    algorithm: '', source: '', destination: '', revision, frontier: new Set(), visitOrder: [], levels: new Map(), finalNodes: new Set(), activeEdge: '', activeFrom: '', backtrackCount: 0, playing: false, showOrder: true };
  if (!analysis?.result) return frame;
  frame.outdated=analysis.result.graphRevision!==revision;
  if (frame.outdated) return frame;
  frame.algorithm=analysis.result.algorithm;
  frame.source=analysis.result.source;
  frame.destination=analysis.result.destination;
  frame.levels.set(frame.source,0);
  const parentEdge = new Map<string,string>();
  for (const event of analysis.events.slice(0, Math.max(0,count))) {
    frame.event=event;
    frame.activeEdge='';frame.activeFrom='';
    const type=event.type.replace(/^(BFS|DFS)_/,'');
    if (event.nodeId && ['CURRENT_NODE','NODE_VISITED','NODE_EXTRACTED','DESTINATION_REACHED','SOURCE_EQUALS_DESTINATION'].includes(type)) {
      frame.current=event.nodeId; frame.visited.add(event.nodeId);
      frame.frontier.delete(event.nodeId);
    }
    if (['ENQUEUE','PUSH','NODE_DISCOVERED','EDGE_RELAXED','DISTANCE_UPDATED','SOURCE_SELECTED'].includes(type) && event.nodeId && !frame.visited.has(event.nodeId)) frame.frontier.add(event.nodeId);
    if (['DEQUEUE','POP'].includes(type)) frame.frontier.delete(event.nodeId);
    if (event.type==='BFS_NODE_DISCOVERED' && event.parentNodeId && frame.levels.has(event.parentNodeId)) frame.levels.set(event.nodeId,frame.levels.get(event.parentNodeId)!+1);
    if (event.edgeId && !['PATH_EDGE_SELECTED','COMPLETE'].includes(type)) {
      frame.explored.add(event.edgeId); frame.activeEdge=event.edgeId;
      frame.activeFrom=event.parentNodeId || (type==='EDGE_EXAMINED'?event.nodeId:frame.current);
    }
    if (event.type==='DFS_NODE_DISCOVERED') { parentEdge.set(event.nodeId,event.edgeId); if(event.edgeId)frame.branch.add(event.edgeId); }
    if (event.type==='DFS_BACKTRACK') {
      frame.activeEdge=parentEdge.get(event.nodeId) ?? '';frame.activeFrom=event.nodeId;
      frame.branch.delete(frame.activeEdge); frame.current=event.parentNodeId ?? '';frame.backtrackCount++;
    }
  }
  frame.visitOrder=[...frame.visited];
  frame.backtrack=frame.event?.type==='DFS_BACKTRACK';
  frame.complete=count>=analysis.events.length;
  if (frame.complete) {
    frame.activeEdge='';
    if (analysis.result.reachable) {frame.finalEdges=analysis.result.pathEdges;frame.finalNodes=new Set(analysis.result.pathNodes);}
  }
  return frame;
}
export function playbackEventText(frame: PlaybackFrame, name: (id: string) => string) {
  const event=frame.event;
  if(frame.outdated)return 'Network changed. Run analysis again.';
  if(!event)return 'Ready to play the recorded analysis.';
  const node=name(event.nodeId),type=event.type.replace(/^(BFS|DFS)_/,'');
  if(frame.backtrack)return event.parentNodeId?`Backtracking to ${name(event.parentNodeId)}`:'Backtracking complete at the source';
  switch(type) {
    case 'CURRENT_NODE': return `Exploring ${node}`;
    case 'NODE_EXTRACTED': case 'NODE_VISITED': return `Settled ${node}`;
    case 'ENQUEUE': return `Added ${node} to queue`;
    case 'DEQUEUE': return `Removed ${node} from queue`;
    case 'PUSH': return `Added ${node} to stack`;
    case 'POP': return `No unvisited neighbors at ${node}`;
    case 'NODE_DISCOVERED': return `Discovered ${node}`;
    case 'NODE_ALREADY_VISITED': return `${node} already discovered`;
    case 'EDGE_EXAMINED': return `Examining road ${event.edgeId}`;
    case 'EDGE_RELAXED': return `Relaxed edge ${event.edgeId}`;
    case 'DISTANCE_CHECKED': return `Checking tentative cost for ${node}`;
    case 'DISTANCE_UPDATED': return `Updated tentative cost for ${node}`;
    case 'PREDECESSOR_UPDATED': return `Updated predecessor for ${node}`;
    case 'SOURCE_SELECTED': return `Source: ${node}`;
    case 'SOURCE_EQUALS_DESTINATION': return 'Source and destination are identical';
    case 'DESTINATION_REACHED': return `Reached ${node}`;
    case 'UNREACHABLE': return 'Destination unreachable';
    case 'PATH_RECONSTRUCTION': return 'Reading the result path';
    case 'PATH_EDGE_SELECTED': return `Result path includes ${event.edgeId}`;
    case 'COMPLETE': return 'Analysis complete';
    case 'START': return 'Analysis started';
    default: return event.message || 'Analysis event';
  }
}
export const restartPlayback = () => 0;
