import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ambulance, Crosshair, Expand, Flame, Home, Hospital, Layers, LifeBuoy, Pause, Play, Shield, Siren, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { SimulationState } from '../../core/simulation/types';
import AlgorithmPlayback from './AlgorithmPlayback';
import TraversalOverlay from './TraversalOverlay';
import { candidateEdges, geometryFor, incidentTone, roadStyle, routeGeometry, routeModels, selectionReasons, visibleIncidents, type PlaybackFrame, type Selection } from './mapPresentation';
import './tactical-map.css';

const layerNames = { hierarchy:'Road hierarchy',roadMetrics:'Distance & road condition',locations:'Network locations',districts:'Districts',facilities:'Facilities',responders:'Responders',incidents:'Incidents',congestion:'Congestion',risk:'Risk',blocked:'Blocked roads',candidates:'Candidate route alternatives',exploration:'Algorithm exploration',debug:'Node IDs / debug' };
const defaults = { hierarchy:true,roadMetrics:false,locations:true,districts:true,facilities:true,responders:true,incidents:true,congestion:false,risk:false,blocked:true,candidates:false,exploration:true,debug:false };
const facilityIcon = (type:string) => type==='FIRE_STATION'?Flame:type==='HOSPITAL'?Hospital:type==='POLICE_STATION'?Shield:type==='RESCUE_STATION'?LifeBuoy:Home;
const responderIcon = (type:string) => type==='FIRE_TRUCK'?Flame:type==='AMBULANCE'?Ambulance:type==='POLICE_UNIT'?Shield:LifeBuoy;
const readable=(value:string)=>value.replace(/_/g,' ');

export default function TacticalMap({state, selection, onSelection, analysisOpen, onAnalysisClose, paused=false}:{
  state:SimulationState; selection:Selection; onSelection:(selection:Selection)=>void;
  analysisOpen:boolean; onAnalysisClose:()=>void; paused?:boolean;
}) {
  const [layers,setLayers]=useState(defaults),[layerMenu,setLayerMenu]=useState(false),[legend,setLegend]=useState(false);
  const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[motion,setMotion]=useState(false);
  const [frame,setFrame]=useState<PlaybackFrame|null>(null);
  const host=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null);
  const drag=useRef<{x:number;y:number;px:number;py:number;moved:boolean}|null>(null);
  const geometry=useMemo(()=>geometryFor(state.network),[state.network]);
  const supplementalLocations=useMemo(()=>state.network.nodes.filter(node=>
    !state.facilities.some(facility=>facility.locationId===node.locationId&&facility.name===node.name)
  ),[state.network.nodes,state.facilities]);
  const selectedId=selection?.kind==='incident'?selection.id:null;
  const selectedRoad=selection?.kind==='road'?state.network.roads.find(road=>road.roadId===selection.id):undefined;
  const nodeName=(id:string)=>state.network.nodes.find(node=>node.locationId===id)?.name ?? id;
  const routes=useMemo(()=>routeModels(state,selectedId),[state,selectedId]);
  const dispatch=state.dispatches.find(d=>d.incidentId===selectedId);
  const dispatchStale=Boolean(dispatch&&(dispatch.stale||dispatch.graphRevision!==state.network.graphRevision));
  const receiveFrame=useCallback((next:PlaybackFrame|null)=>setFrame(next),[]);
  const zoomBy=(amount:number)=>setZoom(z=>Math.max(.8,Math.min(2.8,z+amount)));
  const fit=()=>{setZoom(1);setPan({x:0,y:0});};
  const fullscreen=async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await host.current?.requestFullscreen();};
  const [fullscreenError,setFullscreenError]=useState('');
  useEffect(()=>{if(!analysisOpen)setFrame(null);},[analysisOpen]);
  const activate=(next:Selection)=>({onClick:(event:React.MouseEvent)=>{event.stopPropagation();onSelection(next);},onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelection(next);}}});
  const currentFrame=frame && !frame.outdated ? frame : null;
  // If a polling snapshot changes revision, hide old exploration before the playback effect runs.
  const safeFrame=currentFrame?.revision!==state.network.graphRevision?null:currentFrame;
  const activeAnalysis=layers.exploration&&safeFrame?.playing;
  const analysisOpacity=(id:string)=>activeAnalysis && safeFrame &&
    !safeFrame.visited.has(id) && !safeFrame.frontier.has(id) &&
    safeFrame.current!==id && safeFrame.destination!==id && !safeFrame.finalNodes.has(id) ? .55 : 1;
  const incidentList=visibleIncidents(state.incidents);
  const moving=motion&&!paused;
  return <div className={`tm-root ${analysisOpen ? 'analyzing' : ''}`} ref={host}>
    <div className="tm-map-heading"><div><span>CRISIS CITY / LIVE OPERATIONS</span><h1>Tactical overview</h1></div><div className="tm-revision"><i/> NETWORK REV {state.network.graphRevision}<small>{state.network.roads.length} roads · {state.graph.blockedRoads} blocked · {incidentList.length} open incidents</small></div></div>
    <div className={`tm-canvas-area ${activeAnalysis?'traversal-playing':''}`}>
      <svg ref={svg} className="tm-svg" viewBox="60 38 920 722" aria-label="Authoritative emergency operations city map"
        onPointerDown={e=>{if((e.target as Element).closest('[data-map-item]'))return;drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{const d=drag.current;if(!d)return;const scale=svg.current?.getScreenCTM()?.a||1;const dx=(e.clientX-d.x)/scale,dy=(e.clientY-d.y)/scale;if(Math.abs(dx)+Math.abs(dy)>3)d.moved=true;setPan({x:Math.max(-600,Math.min(600,d.px+dx)),y:Math.max(-480,Math.min(480,d.py+dy))});}}
        onPointerUp={()=>{if(drag.current&&!drag.current.moved)onSelection(null);drag.current=null;}}
        onPointerCancel={()=>{drag.current=null;}}
        onWheel={e=>{zoomBy(e.deltaY<0?.1:-.1);}}
        onKeyDown={e=>{if(e.key==='Escape')onSelection(null);}}>
        <defs><pattern id="tm-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#162731" strokeWidth=".5"/></pattern></defs>
        <rect x="-1000" y="-1000" width="3000" height="3000" fill="#0a151e"/>
        <g transform={`translate(${500+pan.x} ${400+pan.y}) scale(${zoom}) translate(-500 -400)`}>
          <rect x="80" y="60" width="880" height="680" fill="url(#tm-grid)" opacity=".55" pointerEvents="none"/>
          {/* Decorative blocks have no routing or operational meaning. */}
          <g className="tm-blocks" aria-hidden="true">{state.network.nodes.map(n=><g key={n.locationId} transform={`translate(${n.x*10} ${n.y*8})`}><rect x="18" y="-34" width="22" height="15" rx="2"/><rect x="44" y="-34" width="12" height="24" rx="2"/><rect x="-43" y="17" width="16" height="25" rx="2"/></g>)}</g>
          {layers.districts && <g className="tm-zones" pointerEvents="none">{geometry.zones.map(z=><g key={z.name}><rect x={z.minX} y={z.minY} width={z.width} height={z.height} rx="22"/><text x={z.x} y={z.minY+15} textAnchor="middle">{z.name} DISTRICT</text></g>)}</g>}
          <g className="tm-roads">{[...geometry.roads.values()].map(({road,d,cx,cy},roadIndex)=>{
            const style=roadStyle(road),width=layers.hierarchy?style.width:3;
            return <g key={road.roadId} data-map-item role="button" tabIndex={0} style={{opacity:activeAnalysis&&!road.blocked&&!safeFrame?.explored.has(road.roadId)? .45:1}} aria-label={`Inspect road ${road.roadId}, ${style.status}`} className={selection?.kind==='road'&&selection.id===road.roadId?'tm-road selected':'tm-road'} {...activate({kind:'road',id:road.roadId})}>
              <title>{road.roadId} · {road.roadClass} · {road.distance} km · {road.travelTime} min · congestion {road.congestion} · risk {road.risk} · capacity {road.capacity} · {style.status}</title>
              <path d={d} className="tm-road-hit"/>
              <path d={d} className="tm-road-casing" strokeWidth={width+4}/>
              <path d={d} className={`tm-road-base ${road.roadClass.toLowerCase()} ${road.blocked?'closed':''}`} strokeWidth={width}/>
              {layers.congestion&&!road.blocked&&style.congestion!=='normal'&&<path d={d} className={`tm-congestion ${style.congestion}`} strokeWidth={width*.62}/>}
              {layers.risk&&style.risk!=='low'&&<path d={d} className={`tm-risk ${style.risk}`} strokeWidth={width+6}/>}
              {road.blocked&&layers.blocked&&<><path d={d} className="tm-closed" strokeWidth={width+1}/><g className="tm-closure-symbol" transform={`translate(${cx},${cy})`}><rect x="-7" y="-7" width="14" height="14" rx="2"/><path d="M-3-3L3 3M3-3L-3 3"/></g></>}
              {layers.roadMetrics&&<g className={`tm-road-metric ${road.blocked?'blocked':'open'} ${selection?.kind==='road'&&selection.id===road.roadId?'selected':''}`} transform={`translate(${cx} ${cy+((roadIndex%3)-1)*12})`} pointerEvents="none">
                <rect x="-31" y="-10" width="62" height="20" rx="4"/>
                <text className="tm-road-distance" x="0" y="-1" textAnchor="middle">{road.distance.toFixed(1)} km</text>
                <text className="tm-road-state" x="0" y="7" textAnchor="middle">{road.blocked?'BLOCKED':'OPEN'}</text>
              </g>}
            </g>;
          })}</g>
          {layers.locations&&<g className="tm-network-locations" pointerEvents="none" aria-hidden="true">{supplementalLocations.map((node,index)=>{
            const hasFacility=state.facilities.some(facility=>facility.locationId===node.locationId);
            const intersection=node.category==='INTERSECTION';
            const endpoint=safeFrame?.source===node.locationId?'source':safeFrame?.destination===node.locationId?'destination':'';
            const important=Boolean(endpoint||safeFrame?.current===node.locationId||safeFrame?.finalNodes.has(node.locationId));
            const showLabel=!intersection||zoom>1.35||important;
            const shiftX=hasFacility?-17:0, shiftY=hasFacility?-18:0;
            const labelRight=node.x<78;
            const labelY=(index%2===0?-12:16);
            return <g key={`network-${node.locationId}`} className={`tm-network-location ${node.category.toLowerCase()} ${node.status.toLowerCase()} ${endpoint} ${important?'important':''}`}
              transform={`translate(${node.x*10+shiftX} ${node.y*8+shiftY})`} style={{opacity:analysisOpacity(node.locationId)}}>
              <title>{node.name} · {readable(node.category)} · {node.status}</title>
              {intersection?<><circle className="tm-location-ring" r="6"/><circle className="tm-location-core-dot" r="2.4"/></>:<><circle className="tm-location-ring" r="7"/><path className="tm-location-core" d="M0-4L4 0 0 4 -4 0Z"/></>}
              <text className={`tm-location-label ${showLabel?'visible':''}`} x={labelRight?10:-10} y={labelY} textAnchor={labelRight?'start':'end'}>{node.name}</text>
            </g>;
          })}</g>}
          {layers.candidates&&dispatch&&!dispatchStale&&<g className="tm-candidate-routes" pointerEvents="none">{dispatch.candidateSummaries.filter(c=>c.responderId!==dispatch.responderId).map(c=><path key={c.responderId} d={routeGeometry(c.pathNodes,candidateEdges(c),geometry.roads)} />)}</g>}
          <g className="tm-dispatch-routes" pointerEvents="none">{routes.map(({dispatch:d,opacity,stale})=><path key={d.incidentId} data-incident-route={d.incidentId} d={d.reachable?routeGeometry(d.pathNodes,d.pathEdges,geometry.roads):''} className={`tm-route ${stale?'stale':''} ${selectedId===d.incidentId?'focused':''}`} style={{opacity}} />)}</g>
          {layers.debug&&state.network.nodes.map(n=><g key={n.locationId} className="tm-debug"><circle cx={n.x*10} cy={n.y*8} r="3"/><text x={n.x*10+7} y={n.y*8+3}>{n.locationId}</text></g>)}
          {layers.facilities&&state.facilities.map(f=>{
            const n=geometry.nodes.get(f.locationId);if(!n)return null;const Icon=facilityIcon(f.category);
            const colocated=state.facilities.filter(x=>x.locationId===f.locationId),index=colocated.findIndex(x=>x.facilityId===f.facilityId);
            const x=n.x*10+(index-(colocated.length-1)/2)*25,y=n.y*8;
            const available=state.responders.filter(r=>r.baseFacilityId===f.facilityId&&r.availability==='AVAILABLE').length;
            return <g key={f.facilityId} data-map-item role="button" tabIndex={0} style={{opacity:analysisOpacity(f.locationId)}} aria-label={`Inspect facility ${f.name}`} className={`tm-facility ${f.category.toLowerCase()} ${selection?.id===f.facilityId?'selected':''}`} transform={`translate(${x} ${y})`} {...activate({kind:'facility',id:f.facilityId})}>
              <title>{f.name} · {readable(f.category)} · {n.name} · {available} available base units</title><rect x="-11" y="-11" width="22" height="22" rx="4"/><Icon x="-7" y="-7" width="14" height="14" strokeWidth="1.8"/>
              <text className={`tm-marker-label ${zoom>1.4?'visible':''}`} x="15" y="-13">{f.name}</text>
            </g>;
          })}
          {layers.responders&&state.responders.map(r=>{
            const n=geometry.nodes.get(r.locationId);if(!n)return null;const Icon=responderIcon(r.type);
            const group=state.responders.filter(x=>x.locationId===r.locationId),index=group.findIndex(x=>x.responderId===r.responderId);
            const focus=!selectedId||r.assignedIncidentId===selectedId;
            return <g key={r.responderId} data-map-item role="button" tabIndex={0} aria-label={`Inspect responder ${r.responderId}`} transform={`translate(${n.x*10+(index-(group.length-1)/2)*20} ${n.y*8+25})`} className={`tm-responder ${r.assignedIncidentId?'assigned':''}`} style={{opacity:(focus?1:.4)*analysisOpacity(r.locationId)}} {...activate({kind:'responder',id:r.responderId})}>
              <title>{r.responderId} · {readable(r.type)} · {r.availability} · {r.assignedIncidentId??'Unassigned'} · {n.name}</title><rect x="-8" y="-8" width="16" height="16" rx="3"/><Icon x="-6" y="-6" width="12" height="12"/><text className="tm-marker-label" x="12" y="5">{r.responderId}</text>
            </g>;
          })}
          {layers.incidents&&incidentList.map(i=>{
            const n=geometry.nodes.get(i.locationId);if(!n)return null;
            const group=incidentList.filter(x=>x.locationId===i.locationId),index=group.findIndex(x=>x.incidentId===i.incidentId);
            return <g key={i.incidentId} data-map-item data-incident={i.incidentId} role="button" tabIndex={0} aria-label={`Focus incident ${i.incidentId}, ${readable(i.status)}`} transform={`translate(${n.x*10+index*27} ${n.y*8-27})`} style={{opacity:selectedId&&selectedId!==i.incidentId? .42:1}} className={`tm-incident ${incidentTone(i.status)} ${selectedId===i.incidentId?'selected':''}`} {...activate({kind:'incident',id:i.incidentId})}>
              <title>{i.incidentId} · {i.type} · priority {i.priorityScore} · {readable(i.status)} · {n.name} · {i.assignedResponderId||'Unassigned'}</title>
              <circle className="tm-incident-ring" r="17"/><path className="tm-incident-core" d="M0-12L12 0 0 12 -12 0Z"/><Siren x="-6.5" y="-6.5" width="13" height="13"/><text className={`tm-marker-label ${selectedId===i.incidentId?'visible':''}`} x="18" y="4">{i.incidentId}{incidentTone(i.status)==='confirmation'?' · Awaiting confirmation':''}</text>
            </g>;
          })}
          {moving&&layers.responders&&routes.filter(r=>r.movable).map(({dispatch:d,opacity})=>{
            const path=routeGeometry(d.pathNodes,d.pathEdges,geometry.roads);return path?<g key={`${d.incidentId}-${d.dispatchSequence}`} className="tm-moving" opacity={opacity} pointerEvents="none"><circle r="4"/><animateMotion dur="18s" repeatCount="indefinite" path={path}/></g>:null;
          })}
          {layers.exploration&&safeFrame&&<TraversalOverlay frame={safeFrame} nodes={geometry.nodes} roads={geometry.roads}/>}
        </g>
      </svg>
      <div className="tm-tools" aria-label="Map controls">
        <button title="Zoom in" aria-label="Zoom in" onClick={()=>zoomBy(.2)}><ZoomIn size={17}/></button><button title="Zoom out" aria-label="Zoom out" onClick={()=>zoomBy(-.2)}><ZoomOut size={17}/></button>
        <button title="Fit map" aria-label="Fit map" onClick={fit}><Crosshair size={17}/></button><button title="Fullscreen map" aria-label="Fullscreen map" onClick={()=>fullscreen().catch(()=>setFullscreenError('Fullscreen is unavailable in this browser.'))}><Expand size={17}/></button>
        <button title="Map layers" aria-label="Map layers" aria-expanded={layerMenu} onClick={()=>setLayerMenu(!layerMenu)}><Layers size={17}/></button>
      </div>
      {layerMenu&&<div className="tm-layer-menu"><b>Map layers</b>{Object.entries(layerNames).map(([key,label])=><label key={key}><input type="checkbox" checked={layers[key as keyof typeof layers]} onChange={()=>setLayers(prev=>({...prev,[key]:!prev[key as keyof typeof layers]}))}/>{label}</label>)}</div>}
      {selectedRoad&&<div className={`tm-road-readout ${selectedRoad.blocked?'blocked':'open'}`} role="status">
        <header><span>{selectedRoad.roadId}</span><b>{selectedRoad.blocked?'BLOCKED':'OPEN'}</b></header>
        <strong>{nodeName(selectedRoad.from)} → {nodeName(selectedRoad.to)}</strong>
        <div><span>Distance<b>{selectedRoad.distance.toFixed(2)} km</b></span><span>Travel<b>{selectedRoad.travelTime.toFixed(1)} min</b></span><span>Congestion<b>{selectedRoad.congestion}</b></span><span>Risk<b>{selectedRoad.risk}</b></span></div>
        {selectedRoad.blocked&&<small>Unavailable to the routing engine until reopened.</small>}
      </div>}
      {dispatch&&<div className={`tm-route-summary ${dispatchStale?'stale':dispatch.reachable?'reachable':'unreachable'}`} role="status">
        <header><span>SELECTED C++ ROUTE</span><b>{dispatchStale?'STALE':dispatch.reachable?'ACTIVE':'UNREACHABLE'}</b></header>
        <strong>{nodeName(dispatch.origin)} → {nodeName(dispatch.destination)}</strong>
        <div><span>Distance<b>{dispatch.distance.toFixed(2)} km</b></span><span>Travel<b>{dispatch.estimatedTravelTime.toFixed(1)} min</b></span><span>Roads<b>{dispatch.pathEdges.length}</b></span><span>Cost<b>{dispatch.weightedCost.toFixed(2)}</b></span></div>
        <small>{selectionReasons[dispatch.selectionReason]}</small>
      </div>}
      <div className="tm-map-foot"><button aria-pressed={motion} onClick={()=>setMotion(!motion)}>{motion?<Pause size={13}/>:<Play size={13}/>} Simulated route progress</button><span>{zoom.toFixed(1)}× · FICTIONAL CITY</span></div>
      {selection&&<button className="tm-clear" onClick={()=>onSelection(null)}><X size={13}/> Clear selection</button>}
      {fullscreenError&&<p className="tm-fs-error" role="status">{fullscreenError}</p>}
      <div className="tm-legend"><button aria-expanded={legend} onClick={()=>setLegend(!legend)}><Layers size={13}/> Map legend</button>{legend&&<div><span><Flame size={13}/> Fire</span><span><Hospital size={13}/> Medical</span><span><Shield size={13}/> Police</span><span><LifeBuoy size={13}/> Rescue</span><span><Home size={13}/> Shelter</span><span className="tm-red">◇ Active incident</span><span>◇ Cyan: confirmation</span><span>━ Solid road: open</span><span>▣ Badge: distance / status</span><span>◆ Network location</span><span>━ Cyan: selected route</span><span>┄ Candidate / stale snapshot</span><span className="tm-amber">━ Congestion: 4–5 moderate, 6+ high</span><span className="tm-violet">┄ Risk: 2 moderate, 3 high</span><span className="tm-red">× Dashed red: blocked road</span><span>● Exploration / current frontier</span></div>}</div>
      {analysisOpen&&<AlgorithmPlayback state={state} dispatch={dispatch} onFrame={receiveFrame} onClose={onAnalysisClose}/>}
    </div>
  </div>;
}
