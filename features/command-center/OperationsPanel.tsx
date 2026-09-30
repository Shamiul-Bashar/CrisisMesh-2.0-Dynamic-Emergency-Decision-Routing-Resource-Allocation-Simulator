import { useMemo, useState } from 'react';
import { Activity, Clock3, Pause, Play, RefreshCw, RotateCcw, Users } from 'lucide-react';
import { simulationRequest } from '../../core/simulation/api';
import type { SimulationState } from '../../core/simulation/types';

type PanelTab = 'OVERVIEW' | 'RESPONDERS' | 'RESOURCES' | 'EVENTS';

const readable = (value: string) => value.replace(/_/g, ' ');
const eventTone = (type: string) => /BLOCK|UNREACHABLE|ESCALAT/.test(type) ? 'warning'
  : /CLOSED|RESOLVED|CONFIRMED/.test(type) ? 'positive'
  : /REPORT|ASSIGN|DISPATCH|ROUTE|REROUTE|RESPONSE/.test(type) ? 'operational' : '';

export default function OperationsPanel({ state, paused, processing, onTogglePaused, onProcessNext, onUndoBlock, onRefresh, onSelectIncident }: {
  state: SimulationState; paused: boolean; processing: boolean;
  onTogglePaused: () => void; onProcessNext: () => Promise<unknown>; onUndoBlock: () => Promise<unknown>;
  onRefresh: () => Promise<unknown>; onSelectIncident: (incidentId: string) => void;
}) {
  const [tab,setTab]=useState<PanelTab>('OVERVIEW');
  const [typeFilter,setTypeFilter]=useState('ALL'),[statusFilter,setStatusFilter]=useState('ALL');
  const [saving,setSaving]=useState<string|null>(null),[error,setError]=useState('');
  const types=useMemo(()=>['ALL',...new Set(state.responders.map(r=>r.type))],[state.responders]);
  const statuses=useMemo(()=>['ALL',...new Set(state.responders.map(r=>r.availability))],[state.responders]);
  const responders=state.responders.filter(r=>(typeFilter==='ALL'||r.type===typeFilter)&&(statusFilter==='ALL'||r.availability===statusFilter));
  const events=(state.eventHistory||state.recentEvents).slice(-40).reverse();
  const setAvailability=async(responderId:string,availability:string)=>{
    setSaving(responderId);setError('');
    try{await simulationRequest({action:'SET_RESPONDER',responderId,availability});await onRefresh();}
    catch(e){setError(e instanceof Error?e.message:'Unable to update responder');}
    finally{setSaving(null);}
  };
  return <div className="eoc-ops-panel">
    <nav className="eoc-panel-tabs" aria-label="Operations information">
      {(['OVERVIEW','RESPONDERS','RESOURCES','EVENTS'] as const).map(item=><button key={item} aria-pressed={tab===item} onClick={()=>setTab(item)}>{item}</button>)}
    </nav>
    {tab==='OVERVIEW'&&<div className="eoc-panel-body">
      <div className="eoc-status-grid"><span>Active<b>{state.analytics.activeIncidents}</b></span><span>Available units<b>{state.analytics.availableResponders}</b></span><span>Blocked roads<b>{state.graph.blockedRoads}</b></span><span>Open shelter beds<b>{state.shelters.reduce((sum,s)=>sum+s.availableCapacity,0)}</b></span></div>
      <section className="eoc-next"><div><small>NEXT PRIORITY ACTION</small>{state.nextDispatch?<><b>{state.nextDispatch.incidentId}</b><span>Priority {state.nextDispatch.priority} · C++ Max Heap</span></>:<span>No incident waiting for dispatch.</span>}</div><button disabled={processing||!state.nextDispatch} onClick={()=>void onProcessNext()}>{processing?'Processing…':'Process next'}</button></section>
      <section><div className="eoc-section-head"><b>Active dispatches</b><span>{state.activeDispatches.length}</span></div><div className="eoc-dispatch-list">{state.activeDispatches.map(d=><button key={d.incidentId} onClick={()=>onSelectIncident(d.incidentId)}><span><b>{d.incidentId}</b><small>{d.responderId} · {readable(d.status)}</small></span><em>{d.distance.toFixed(1)} km</em></button>)}{!state.activeDispatches.length&&<p className="eoc-empty">No active dispatches. New C++ assignments appear here.</p>}</div></section>
      <section className="eoc-engine-summary"><span><Activity size={14}/> Decision authority<b>C++ engine</b></span><span><Clock3 size={14}/> Graph topology<b>{state.graph.vertices} nodes / {state.graph.roads} roads</b></span></section>
      <div className="eoc-control-row"><button onClick={onTogglePaused}>{paused?<Play size={14}/>:<Pause size={14}/>} {paused?'Resume map':'Pause map'}</button><button disabled={!state.roadUndoStack?.canUndo} onClick={()=>void onUndoBlock()}><RotateCcw size={14}/> Undo block ({state.roadUndoStack?.depth||0})</button><button onClick={()=>void onRefresh()}><RefreshCw size={14}/> Sync</button></div>
    </div>}
    {tab==='RESPONDERS'&&<div className="eoc-panel-body">
      <div className="eoc-filter-row"><select aria-label="Filter responder type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>{types.map(v=><option key={v} value={v}>{v==='ALL'?'All unit types':readable(v)}</option>)}</select><select aria-label="Filter responder availability" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statuses.map(v=><option key={v} value={v}>{v==='ALL'?'All availability':readable(v)}</option>)}</select></div>
      {error&&<p className="eoc-inline-error" role="alert">{error}</p>}
      <div className="eoc-responder-list">{responders.map(r=><article key={r.responderId}><i className={r.availability.toLowerCase()}/><div><b>{r.responderId}</b><span>{readable(r.type)} · {r.locationId}</span><small>{r.assignedIncidentId?`Assigned to ${r.assignedIncidentId}`:'No active assignment'} · {readable(r.status)}</small></div><select aria-label={`Set availability for ${r.responderId}`} value={r.availability} disabled={saving===r.responderId} onChange={e=>void setAvailability(r.responderId,e.target.value)}><option>AVAILABLE</option><option>ASSIGNED</option><option>BUSY</option><option>OFFLINE</option></select></article>)}</div>
    </div>}
    {tab==='RESOURCES'&&<div className="eoc-panel-body">
      <section><div className="eoc-section-head"><b>Shelter capacity</b><span>{state.shelters.length}</span></div><div className="eoc-data-table shelter"><header><span>Shelter / location</span><span>Capacity</span><span>Occupied</span><span>Available</span></header>{state.shelters.map(s=><div key={s.shelterId}><span><b>{s.shelterId}</b><small>{s.locationId} · {readable(s.status)}</small></span><span>{s.capacity}</span><span>{s.occupancy}</span><span className={s.availableCapacity<20?'warning':'positive'}>{s.availableCapacity}</span></div>)}</div></section>
      <section><div className="eoc-section-head"><b>Operational resources</b><span>{state.resources.length}</span></div><div className="eoc-data-table resources"><header><span>Resource</span><span>Quantity</span><span>Source</span></header>{state.resources.map(r=><div key={`${r.resourceType}-${r.source}`}><span><b>{readable(r.resourceType)}</b></span><span>{r.quantity}</span><span>{r.source}</span></div>)}</div></section>
    </div>}
    {tab==='EVENTS'&&<div className="eoc-panel-body"><div className="eoc-timeline">{events.map(e=><article key={`${e.step}-${e.type}`} className={eventTone(e.type)}><b>{String(e.step).padStart(2,'0')}</b><div><strong>{readable(e.type)}</strong><span>{e.incidentId||e.edgeId||'SYSTEM'} · {e.message}</span></div></article>)}{!events.length&&<p className="eoc-empty">No engine events recorded in this session.</p>}</div></div>}
  </div>;
}
