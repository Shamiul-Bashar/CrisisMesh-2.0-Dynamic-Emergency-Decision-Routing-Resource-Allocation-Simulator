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
};
export function playbackFrame(analysis: AnalysisResponse | null, count: number, revision: number): PlaybackFrame {
  const frame: PlaybackFrame = { outdated: false, complete: false, visited: new Set(), explored: new Set(), branch: new Set(), current: '', backtrack: false, finalEdges: [], event: null };
  if (!analysis?.result) return frame;
  frame.outdated=analysis.result.graphRevision!==revision;
  if (frame.outdated) return frame;
  const parentEdge = new Map<string,string>();
  for (const event of analysis.events.slice(0, Math.max(0,count))) {
    frame.event=event;
    if (event.nodeId && /CURRENT_NODE|NODE_VISITED|NODE_EXTRACTED|DESTINATION_REACHED/.test(event.type)) {
      frame.current=event.nodeId; frame.visited.add(event.nodeId);
    }
    if (event.edgeId) frame.explored.add(event.edgeId);
    if (event.type==='DFS_NODE_DISCOVERED') { parentEdge.set(event.nodeId,event.edgeId); frame.branch.add(event.edgeId); }
    if (event.type==='DFS_BACKTRACK') { frame.branch.delete(parentEdge.get(event.nodeId) ?? ''); frame.current=event.parentNodeId ?? ''; }
  }
  frame.backtrack=frame.event?.type==='DFS_BACKTRACK';
  frame.complete=count>=analysis.events.length;
  if (frame.complete && analysis.result.reachable) frame.finalEdges=analysis.result.pathEdges;
  return frame;
}
export const restartPlayback = () => 0;
