import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  History,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Radio,
  RefreshCw,
  ShieldCheck,
  Siren,
  UserRound,
} from 'lucide-react';
import { readSession, readUsers } from '../../core/auth/credentials';
import { simulationRequest } from '../../core/simulation/api';
import type { SimulationIncident, SimulationResponse, SimulationState } from '../../core/simulation/types';
import EmergencyReport from '../emergency/EmergencyReport';
import {
  canManageIncident,
  citizenStatus,
  incidentsOwnedBy,
  isMeaningfulEscalationReason,
  lifecycleStages,
  messagesVisibleTo,
  safeCitizenProfile,
  type CitizenMessage,
} from './citizenPresentation';
import './citizen-dashboard.css';

type View = 'OVERVIEW' | 'MESSAGES' | 'HISTORY' | 'PROFILE';

function readMessages(): CitizenMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('cm-user-messages') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const readable = (value: string) => value.replace(/_/g, ' ');

export default function CitizenDashboard({ onHome }: { onHome: () => void }) {
  const session = readSession(localStorage);
  const currentUserId = session?.role === 'user' ? session.userId : null;
  const currentUser = readUsers(localStorage).find(user => user.id === currentUserId) ?? null;
  const profile = safeCitizenProfile(currentUser);
  const [view,setView]=useState<View>('OVERVIEW');
  const [state,setState]=useState<SimulationState|null>(null);
  const [connection,setConnection]=useState<'CONNECTING'|'ONLINE'|'OFFLINE'>('CONNECTING');
  const [reportOpen,setReportOpen]=useState(false);
  const [busyIncident,setBusyIncident]=useState<string|null>(null);
  const [escalating,setEscalating]=useState<string|null>(null);
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [messageVersion,setMessageVersion]=useState(0);

  const refresh=useCallback(async()=>{
    try{
      const response=await simulationRequest<SimulationResponse>({action:'STATE'});
      setState(response.state);
      setConnection('ONLINE');
      setError('');
      setMessageVersion(value=>value+1);
    }catch(error){
      setConnection('OFFLINE');
      setError(error instanceof Error?error.message:'The emergency service connection is unavailable.');
    }
  },[]);

  useEffect(()=>{
    void refresh();
    const timer=window.setInterval(()=>void refresh(),10000);
    return()=>window.clearInterval(timer);
  },[refresh]);

  const owned=useMemo(()=>incidentsOwnedBy(state?.incidents??[],currentUserId),[state?.incidents,currentUserId]);
  const active=useMemo(()=>owned.filter(incident=>incident.status!=='CLOSED').slice().sort((a,b)=>b.reportedSequence-a.reportedSequence),[owned]);
  const history=useMemo(()=>owned.filter(incident=>incident.status==='CLOSED').slice().sort((a,b)=>b.reportedSequence-a.reportedSequence),[owned]);
  const messages=useMemo(()=>messagesVisibleTo(readMessages(),currentUserId),[currentUserId,messageVersion]);

  const responderFor=(incident:SimulationIncident)=>state?.responders.find(responder=>responder.responderId===incident.assignedResponderId);

  const confirmResolved=async(incident:SimulationIncident)=>{
    if(!canManageIncident(incident,currentUserId)){
      setError('Only the citizen who reported this emergency can confirm its resolution.');
      return;
    }
    setBusyIncident(incident.incidentId);setError('');setNotice('');
    try{
      const response=await simulationRequest<SimulationResponse>({action:'CONFIRM_RESOLVED',incidentId:incident.incidentId,userId:currentUserId});
      if(!response.ok)throw new Error(response.error||'The resolution could not be confirmed.');
      setState(response.state);
      setEscalating(null);setReason('');
      setNotice(`${incident.incidentId} was closed after your confirmation.`);
    }catch(error){setError(error instanceof Error?error.message:'The resolution could not be confirmed.');}
    finally{setBusyIncident(null);}
  };

  const requestMoreHelp=async(incident:SimulationIncident)=>{
    if(!canManageIncident(incident,currentUserId)){
      setError('Only the citizen who reported this emergency can request more help.');
      return;
    }
    if(!isMeaningfulEscalationReason(reason)){setError('Please describe why you still need help using at least 10 characters.');return;}
    setBusyIncident(incident.incidentId);setError('');setNotice('');
    try{
      const response=await simulationRequest<SimulationResponse>({action:'ESCALATE',incidentId:incident.incidentId,userId:currentUserId,reason:reason.trim()});
      if(!response.ok)throw new Error(response.error||'Additional help could not be requested.');
      setState(response.state);
      setEscalating(null);setReason('');
      setNotice(`${incident.incidentId} was escalated and returned for urgent dispatch.`);
    }catch(error){setError(error instanceof Error?error.message:'Additional help could not be requested.');}
    finally{setBusyIncident(null);}
  };

  const incidentCard=(incident:SimulationIncident)=>{
    const status=citizenStatus(incident.status),responder=responderFor(incident),manageable=canManageIncident(incident,currentUserId);
    return <article className={`citizen-incident tone-${status.tone}`} key={incident.incidentId}>
      <header><div><span className="citizen-kicker">CURRENT EMERGENCY</span><h2>{readable(incident.type)}</h2><small>{incident.incidentId}</small></div><span className={`citizen-status tone-${status.tone}`}>{status.label}</span></header>
      <p className="citizen-guidance">{status.guidance}</p>
      <div className="citizen-facts">
        <span><MapPin size={15}/><small>Location</small><b>{incident.locationId}</b></span>
        <span><ShieldCheck size={15}/><small>Assigned responder</small><b>{incident.assignedResponderId||'Waiting for assignment'}</b>{responder&&<em>{readable(responder.type)}</em>}</span>
        <span><Clock3 size={15}/><small>Report reference</small><b>Sequence {incident.reportedSequence}</b></span>
        <span><AlertTriangle size={15}/><small>Response priority</small><b>{incident.priorityScore||'Being assessed'}</b></span>
      </div>
      <div className="citizen-progress" aria-label={`Emergency progress: ${status.label}`}>
        {lifecycleStages.map((stage,index)=><div key={stage} className={index<status.stage?'done':index===status.stage?'current':''}><i>{index<status.stage?<Check size={11}/>:index+1}</i><span>{stage}</span></div>)}
      </div>
      {manageable&&<section className="citizen-confirmation" aria-label="Resolution confirmation">
        <div><span>ACTION REQUIRED</span><h3>Has your emergency been resolved?</h3><p>Your response team has completed its field work. Your answer controls what happens next.</p></div>
        <div className="citizen-confirm-actions">
          <button className="citizen-resolved" disabled={busyIncident===incident.incidentId} onClick={()=>void confirmResolved(incident)}><CheckCircle2 size={16}/>{busyIncident===incident.incidentId?'Submitting…':'Yes — Emergency resolved'}</button>
          <button className="citizen-more-help" disabled={busyIncident===incident.incidentId} onClick={()=>{setEscalating(incident.incidentId);setReason('');}}><AlertTriangle size={16}/>No — I still need help</button>
        </div>
        {escalating===incident.incidentId&&<div className="citizen-reason"><label htmlFor={`reason-${incident.incidentId}`}>Tell us what assistance is still needed</label><textarea id={`reason-${incident.incidentId}`} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Briefly describe what remains unresolved…" rows={3}/><small>{reason.trim().length}/10 minimum characters</small><div><button disabled={busyIncident===incident.incidentId||!isMeaningfulEscalationReason(reason)} onClick={()=>void requestMoreHelp(incident)}>Request additional help</button><button onClick={()=>{setEscalating(null);setReason('');}}>Cancel</button></div></div>}
      </section>}
    </article>;
  };

  return <main className="citizen-portal">
    <header className="citizen-header">
      <div className="citizen-brand"><span><Radio size={17}/></span><div><b>CrisisMesh 2.0</b><small>Citizen emergency portal</small></div></div>
      <nav aria-label="Citizen sections">{(['OVERVIEW','MESSAGES','HISTORY','PROFILE'] as const).map(item=><button key={item} aria-pressed={view===item} onClick={()=>setView(item)}>{item==='OVERVIEW'?'My emergency':item.charAt(0)+item.slice(1).toLowerCase()}{item==='MESSAGES'&&messages.length>0?<em>{messages.length}</em>:null}</button>)}</nav>
      <div className="citizen-session"><span className={`citizen-connection ${connection.toLowerCase()}`}><i/>{connection}</span><div><b>{profile?.name||'Citizen'}</b><small>@{profile?.username||'session unavailable'}</small></div><button aria-label="Refresh emergency status" onClick={()=>void refresh()}><RefreshCw size={15}/></button><button onClick={onHome}><LogOut size={15}/>Log out</button></div>
    </header>
    <div className="citizen-shell">
      {error&&<div className="citizen-alert error" role="alert"><AlertTriangle size={17}/><div><b>We could not complete that request</b><span>{error}</span></div><button onClick={()=>{setError('');void refresh();}}>Try again</button></div>}
      {notice&&<div className="citizen-alert success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button onClick={()=>setNotice('')}>Dismiss</button></div>}
      {view==='OVERVIEW'&&<>
        <section className="citizen-welcome"><div><span className="citizen-kicker">YOUR EMERGENCY SUPPORT</span><h1>{active.length?'Response status':'How can we help?'}</h1><p>{active.length?'Follow your active request and complete any action requested below.':'You have no active emergency requests. CrisisMesh is ready when you need assistance.'}</p></div><button className="citizen-report" onClick={()=>setReportOpen(true)}><Siren size={19}/><span><b>Report Emergency</b><small>Send a new request for assistance</small></span></button></section>
        {connection==='CONNECTING'?<div className="citizen-empty"><RefreshCw className="citizen-spin"/><b>Loading your emergency status</b><span>Connecting securely to CrisisMesh…</span></div>:active.length?<section className="citizen-active-list">{active.map(incidentCard)}</section>:<div className="citizen-empty calm"><ShieldCheck/><b>No active emergency</b><span>Previous resolved requests remain available in Incident History.</span><button onClick={()=>setReportOpen(true)}>Report an emergency</button></div>}
        <section className="citizen-overview-secondary"><article><header><div><Mail size={17}/><span><b>Recent messages</b><small>Updates from CrisisMesh</small></span></div><button onClick={()=>setView('MESSAGES')}>View inbox</button></header>{messages.length?<div className="citizen-message-preview"><b>{messages[0].subject}</b><span>{messages[0].senderName} · {new Date(messages[0].createdAt).toLocaleString()}</span><p>{messages[0].body}</p></div>:<p className="citizen-muted">No messages have been sent to you.</p>}</article><article><header><div><History size={17}/><span><b>Incident history</b><small>{history.length} resolved request{history.length===1?'':'s'}</small></span></div><button onClick={()=>setView('HISTORY')}>View history</button></header><p className="citizen-muted">Your completed emergencies are kept here for reference.</p></article></section>
      </>}
      {view==='MESSAGES'&&<section className="citizen-page"><header><span className="citizen-kicker">CRISISMESH UPDATES</span><h1>Messages</h1><p>Direct messages sent to you and city-wide announcements.</p></header>{messages.length?<div className="citizen-messages">{messages.map(message=><article key={message.id} className={message.read?'read':'unread'}><header><span>{message.type==='broadcast'?<Bell size={15}/>:<Mail size={15}/>}<b>{message.subject||'CrisisMesh update'}</b></span>{!message.read&&<em>New</em>}</header><p>{message.body}</p><footer><span>{message.senderName}</span><time>{new Date(message.createdAt).toLocaleString()}</time></footer></article>)}</div>:<div className="citizen-empty calm"><Mail/><b>No messages yet</b><span>Updates from CrisisMesh will appear here.</span></div>}</section>}
      {view==='HISTORY'&&<section className="citizen-page"><header><span className="citizen-kicker">YOUR RECORDS</span><h1>Incident history</h1><p>Resolved emergencies reported from this account.</p></header>{history.length?<div className="citizen-history">{history.map(incident=>{const responder=responderFor(incident);return <article key={incident.incidentId}><i><Check size={14}/></i><div><header><b>{readable(incident.type)}</b><span>{incident.incidentId}</span></header><p><MapPin size={13}/>{incident.locationId}<span>Closed</span></p><small>{incident.assignedResponderId||'Response unit'}{responder?` · ${readable(responder.type)}`:''} · Report sequence {incident.reportedSequence}</small>{incident.escalationReason&&<em>Additional assistance requested: {incident.escalationReason}</em>}</div></article>})}</div>:<div className="citizen-empty calm"><History/><b>No incident history</b><span>Resolved emergencies will appear here.</span></div>}</section>}
      {view==='PROFILE'&&<section className="citizen-page"><header><span className="citizen-kicker">ACCOUNT</span><h1>Your profile</h1><p>Safe account and contact information for this signed-in citizen.</p></header>{profile?<article className="citizen-profile"><div className="citizen-profile-head"><span><UserRound size={24}/></span><div><h2>{profile.name}</h2><p>@{profile.username}</p></div><em>{profile.accountStatus}</em></div><div className="citizen-profile-grid"><span><Mail size={15}/><small>Email</small><b>{profile.email}</b></span><span><Phone size={15}/><small>Phone</small><b>{profile.phone}</b></span><span><UserRound size={15}/><small>Citizen ID</small><b>{profile.id.slice(0,8).toUpperCase()}</b></span><span><ShieldCheck size={15}/><small>Account status</small><b>{profile.accountStatus}</b></span></div><p><ShieldCheck size={15}/>Your credentials are protected and are never displayed in this portal.</p></article>:<div className="citizen-empty"><AlertTriangle/><b>Profile unavailable</b><span>Please sign in again to restore your verified account identity.</span></div>}</section>}
    </div>
    {reportOpen&&<EmergencyReport reportedByUserId={currentUserId??''} onClose={()=>setReportOpen(false)} onSubmitted={payload=>{if(payload.state)setState(payload.state);setReportOpen(false);setNotice(`Emergency ${payload.result?.incident?.incidentId||''} was reported successfully.`);}}/>}
  </main>;
}
