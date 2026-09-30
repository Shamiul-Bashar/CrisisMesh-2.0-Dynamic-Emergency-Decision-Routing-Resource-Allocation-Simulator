import { routeGeometry, type MapNode, type PlaybackFrame, type RoadGeometry } from './mapPresentation';

export default function TraversalOverlay({ frame, nodes, roads }: {
  frame: PlaybackFrame; nodes: Map<string, MapNode>; roads: Map<string, RoadGeometry>;
}) {
  if (!frame.algorithm) return null;
  const active = roads.get(frame.activeEdge);
  const target = active && (active.a.locationId === frame.activeFrom ? active.b.locationId : active.b.locationId === frame.activeFrom ? active.a.locationId : '');
  const activePath = active && target && !active.road.blocked
    ? routeGeometry([frame.activeFrom, target], [frame.activeEdge], roads) : '';
  return <g className={`tm-traversal ${frame.algorithm.toLowerCase()} ${frame.playing?'playing':''} ${frame.complete?'complete':''}`} pointerEvents="none" aria-hidden="true">
    {[...frame.explored].map(id => {
      const road = roads.get(id);
      return road && !road.road.blocked ? <path key={id} d={road.d} className={frame.branch.has(id)?'tr-branch':'tr-explored'}/> : null;
    })}
    {frame.finalEdges.map(id => {
      const road = roads.get(id);
      return road && !road.road.blocked ? <path key={`final-${id}`} d={road.d} className="tr-final"/> : null;
    })}
    {activePath && <g className={frame.backtrack?'tr-backtracking':''}>
      <path d={activePath} className="tr-active"/>
      <path key={`${frame.event?.step}-${frame.activeEdge}`} d={activePath} className="tr-direction"/>
    </g>}
    {[...nodes.values()].map(node => {
      const id = node.locationId, current = id === frame.current && !frame.complete;
      const destination = id === frame.destination, visited = frame.visited.has(id), frontier = frame.frontier.has(id) && !visited;
      const final = frame.finalNodes.has(id), order = frame.visitOrder.indexOf(id) + 1;
      const level = frame.levels.get(id);
      return <g key={id} transform={`translate(${node.x*10} ${node.y*8})`} className={`tr-node ${visited?'visited':''} ${frontier?'frontier':''} ${destination?'destination':''} ${final?'final-node':''} ${current?'current':''} ${current&&frame.backtrack?'returning':''}`} data-analysis-node={id}>
        <title>{node.name}{current?' · Current':''}{destination?' · Destination':''}{order?` · Visit ${order}`:''}</title>
        {(visited||frontier||destination||current||final) ? <circle className="tr-node-ring" r={current?17:destination?15:12}/> : <circle className="tr-unvisited" r="2.5"/>}
        {destination&&<><path className="tr-destination-mark" d="M-5-22L0-17L5-22"/><text className="tr-label" y="-29" textAnchor="middle">DESTINATION</text></>}
        {current&&<><circle className="tr-pulse" r="18"/><circle className="tr-pulse second" r="18"/><text className="tr-label" y="38" textAnchor="middle">{frame.backtrack?'BACKTRACK':'CURRENT'}{frame.algorithm==='BFS'&&level!==undefined?` · HOP ${level}`:''}</text></>}
        {frame.showOrder&&order>0&&<g className="tr-order" transform="translate(14 -15)"><circle r="8"/><text textAnchor="middle" dominantBaseline="central">{order}</text></g>}
      </g>;
    })}
  </g>;
}
