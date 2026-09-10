import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, Send, X } from 'lucide-react';
import { simulationRequest } from '../../core/simulation/api';
import type { SimulationIncident, SimulationResponse } from '../../core/simulation/types';

type SimulationReportResponse = SimulationResponse & { incident: SimulationIncident };
type Props = { onClose?: () => void; onSubmitted?: (payload: SimulationReportResponse) => void };

const stages = [
  ['INCIDENT_CREATED', 'Incident created'],
  ['INCIDENT_QUEUED', 'Emergency intake queue'],
  ['INCIDENT_TRIAGED', 'Triage'],
  ['PRIORITY_CALCULATED', 'Priority calculated'],
  ['RESPONDER_SELECTED', 'Responder selected'],
  ['ROUTE_CALCULATED', 'Route calculated'],
  ['INCIDENT_EN_ROUTE', 'Dispatch started'],
] as const;

export default function EmergencyReport({ onClose, onSubmitted }: Props) {
  const [form, setForm] = useState({ type: 'MEDICAL', locationId: 'LOC-007', severity: 4, urgency: 4, victimCount: 1, description: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimulationReportResponse | null>(null);
  const [error, setError] = useState('');

  const pipeline = useMemo(() => {
    const events = result?.events?.events ?? [];
    const types = new Set(events.map(event => event.type));
    return stages.map(([type, label]) => ({ type, label, done: types.has(type) }));
  }, [result]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    if (!form.description.trim()) {
      setError('Add a short operational description before submitting.');
      setBusy(false);
      return;
    }
    try {
      const data = await simulationRequest<SimulationReportResponse>({ action: 'REPORT', ...form });
      if (!data.incident?.incidentId) throw new Error('The C++ bridge returned an incomplete incident record.');
      setResult(data);
      onSubmitted?.(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Emergency submission failed.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="emergency-overlay">
    <section className="emergency-modal" role="dialog" aria-modal="true" aria-labelledby="emergency-report-title">
      <header>
        <div><span className="eyebrow">C++ SIMULATION ENGINE / INTAKE</span><h2 id="emergency-report-title"><AlertTriangle size={18}/> REPORT EMERGENCY</h2><small>Priority, responder selection and routing are decided by the authoritative C++ engine.</small></div>
        {onClose && <button onClick={onClose} aria-label="Close emergency report"><X size={17}/></button>}
      </header>
      {!result ? <form onSubmit={submit}>
        <label>Emergency type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{['MEDICAL','FIRE','POLICE','RESCUE','ACCIDENT','FLOOD','STRUCTURAL'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Incident location<select value={form.locationId} onChange={e=>setForm({...form,locationId:e.target.value})}>{Array.from({length:24},(_,i)=>`LOC-${String(i+1).padStart(3,'0')}`).map(x=><option key={x}>{x}</option>)}</select></label>
        <div className="emergency-grid"><label>Severity (1–5)<input type="number" min="1" max="5" value={form.severity} onChange={e=>setForm({...form,severity:+e.target.value})}/></label><label>Urgency (1–5)<input type="number" min="1" max="5" value={form.urgency} onChange={e=>setForm({...form,urgency:+e.target.value})}/></label><label>Victims<input type="number" min="0" max="99" value={form.victimCount} onChange={e=>setForm({...form,victimCount:+e.target.value})}/></label></div>
        <label>Operational description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Briefly describe the emergency and immediate need" /></label>
        {error && <div className="emergency-error" role="alert">{error}</div>}
        <div className="form-authority-note"><CircleDot size={13}/><span>Submission enters the local C++ intake queue. React does not calculate priority, select responders, or calculate routes.</span></div>
        <button className="emergency-submit" disabled={busy}>{busy?<><span className="spinner"/> SUBMITTING INCIDENT</>:<><Send size={15}/> SUBMIT TO C++ ENGINE</>}</button>
      </form> : <div className="emergency-success">
        <CheckCircle2 size={30}/><span className="eyebrow">INCIDENT CREATED / C++ STATE</span><h3>{result.incident.incidentId}</h3>
        <p className="emergency-confirmation">The incident is queued in the authoritative C++ intake pipeline. Dispatch remains an explicit coordinator operation.</p>
        <div className="engine-pipeline">{pipeline.map(stage => <div className={stage.done ? 'done' : 'pending'} key={stage.type}><i>{stage.done ? '✓' : '·'}</i><span>{stage.done ? stage.label : 'PENDING · ' + stage.label}</span></div>)}</div>
        <div className="emergency-result-grid"><div><span>PRIORITY</span><b>{result.incident.priorityScore}</b></div><div><span>STATUS</span><b>{result.incident.status}</b></div><div><span>INCIDENT TYPE</span><b>{result.incident.type}</b></div><div><span>LOCATION</span><b>{result.incident.locationId}</b></div><div><span>SEVERITY / URGENCY</span><b>{result.incident.severity} / {result.incident.urgency}</b></div><div><span>VICTIMS</span><b>{result.incident.victimCount}</b></div><div><span>RESPONDER</span><b>{result.incident.assignedResponderId || 'NOT YET ASSIGNED'}</b></div><div><span>ROUTE</span><b>AWAITING COORDINATOR</b></div></div>
        <div className="emergency-route-proof"><span>NEXT OPERATION</span><b>PROCESS NEXT INCIDENT · C++ MANUAL MAX HEAP</b></div>
        <div className="emergency-authority-proof"><span>DECISION SOURCE</span><b>C++ SimulationEngine → Queue → Manual Max Heap → Responder Selection → C++ Dijkstra</b></div>
        <p>{result.message || 'Incident is queued in the C++ intake pipeline and awaits coordinator processing.'}</p>{onClose && <button className="emergency-submit" onClick={onClose}>RETURN TO OPERATIONS</button>}</div>}
    </section>
  </div>;
}
