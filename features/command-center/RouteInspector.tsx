import { useState } from 'react';
import { simulationRequest } from '../../core/simulation/api';
import type { DispatchRecord, SimulationIncident, SimulationState } from '../../core/simulation/types';
import { selectionReasons } from './mapPresentation';

export default function RouteInspector({ incident, dispatch, state, onRefresh, onAnalyze }: {
  incident: SimulationIncident; dispatch?: DispatchRecord; state: SimulationState; onRefresh: () => Promise<unknown>; onAnalyze: () => void;
}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const complete=async()=>{
    setBusy(true);setError('');
    try {await simulationRequest({action:'RESPONSE_COMPLETED',incidentId:incident.incidentId});await onRefresh();}
    catch(error){setError(error instanceof Error?error.message:'Unable to complete response');}
    finally{setBusy(false);}
  };
  const stale=dispatch && (dispatch.stale || dispatch.graphRevision!==state.network.graphRevision);
  return <div className="tm-inspector">
    <span className="tm-kicker">INCIDENT / DISPATCH</span><h2>{incident.incidentId}</h2>
    <p>{incident.type} · {state.network.nodes.find(n=>n.locationId===incident.locationId)?.name}</p>
    <span className="tm-badge">{incident.status.replace(/_/g,' ')}</span>
    <div className="tm-facts"><span>Priority <b>{incident.priorityScore}</b></span><span>Responder <b>{incident.assignedResponderId||'Waiting for resource'}</b></span></div>
    {dispatch ? <>
      {stale && <p className="tm-warning"><b>STALE ROUTE SNAPSHOT</b><br/>Network changed after revision {dispatch.graphRevision}. Simulated movement is disabled.</p>}
      <p className="tm-selection-reason">{selectionReasons[dispatch.selectionReason]}</p>
      <div className="tm-facts"><span>Distance <b>{dispatch.distance.toFixed(2)} km</b></span><span>Travel time <b>{dispatch.estimatedTravelTime.toFixed(1)} min</b></span><span>Weighted cost <b>{dispatch.weightedCost.toFixed(2)}</b></span><span>Risk · edge sum <b>{dispatch.risk}</b></span><span>Congestion · average <b>{dispatch.congestion.toFixed(2)}</b></span><span>Revision / sequence <b>{dispatch.graphRevision} / {dispatch.dispatchSequence}</b></span></div>
      <h3>Responder comparison</h3>
      <p className="tm-muted">C++ ranking at dispatch · selected unit marked ✓</p>
      <div className="tm-table-wrap"><table className="tm-candidates"><caption>Actual candidate route metrics</caption><thead><tr><th>Responder / type</th><th>km</th><th>min</th><th>Cost</th><th>Risk</th><th>Cong.</th><th>Reachable</th></tr></thead><tbody>{dispatch.candidateSummaries.map(c=><tr key={c.responderId} className={c.responderId===dispatch.responderId?'selected':''}><th>{c.responderId===dispatch.responderId?'✓ ':''}{c.responderId}<small>{c.responderType.replace(/_/g,' ')}</small></th><td>{c.reachable?c.distance.toFixed(1):'—'}</td><td>{c.reachable?c.estimatedTravelTime.toFixed(1):'—'}</td><td>{c.reachable?c.weightedCost.toFixed(2):'—'}</td><td>{c.reachable?c.risk:'—'}</td><td>{c.reachable?c.congestion.toFixed(1):'—'}</td><td>{c.reachable?'Yes':'No'}</td></tr>)}</tbody></table></div>
      {!dispatch.candidateSummaries.length && <p className="tm-muted">Assigned responder reroute; no new candidate selection was performed.</p>}
      <button className="tm-action" onClick={onAnalyze}>Analyze this route on the live network</button>
    </>:<p className="tm-muted">{incident.status==='AWAITING_USER_CONFIRMATION'?'Field response finished. Waiting for the reporting citizen’s confirmation.':'No active dispatch record. Process or retry through the operations queue.'}</p>}
    <button className="tm-primary" disabled={busy||!['EN_ROUTE','ASSIGNED','REROUTE_REQUIRED'].includes(incident.status)} onClick={complete}>{busy?'Completing…':'Mark response completed'}</button>
    {error && <p role="alert" className="tm-warning">{error}</p>}
    <details className="tm-timeline"><summary>Incident timeline</summary>{(state.eventHistory??state.recentEvents).filter(e=>e.incidentId===incident.incidentId).map(e=><div key={e.step}><b>{e.type.replace(/_/g,' ')}</b><span>{e.message}</span></div>)}</details>
  </div>;
}
