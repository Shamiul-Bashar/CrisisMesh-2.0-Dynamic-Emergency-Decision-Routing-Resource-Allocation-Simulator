import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock3, Gauge, LocateFixed, Mail, MessageSquareText, Pause, Play, Search, Send, RefreshCw, UserRound, Users, X } from 'lucide-react';
import MasterDSALab from './MasterDSALab';
import TacticalMap from './TacticalMap';
import RouteInspector from './RouteInspector';
import OperationsPanel from './OperationsPanel';
import DsaArchitecturePanel from './DsaArchitecturePanel';
import { visibleIncidents, type Selection } from './mapPresentation';
import { Graph } from '../../core/graph/Graph';
import { simulationRequest } from '../../core/simulation/api';
import { apiUrl } from '../../core/apiBase';
import { graphFromNetwork } from '../../core/simulation/presentation';
import type { ReportResult, SimulationResponse, SimulationState } from '../../core/simulation/types';
import './command-center.css';
type SimulationResult = SimulationResponse<ReportResult>;
type AuthorUser = {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  passwordHash?: string;
  createdAt?: number;
  lastLogin?: number | null;
  accountStatus?: 'Active' | 'Inactive';
  role?: 'user';
};
type AuthorMessage = {
  id: string;
  recipientId: string | 'all';
  senderId: string;
  senderName: string;
  subject: string;
  body: string;
  createdAt: number;
  read: boolean;
  type: 'individual' | 'broadcast';
};

function readAuthorUsers(): AuthorUser[] {
  try {
    const raw = JSON.parse(localStorage.getItem('cm-users') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function readAuthorMessages(): AuthorMessage[] {
  try {
    const raw = JSON.parse(localStorage.getItem('cm-user-messages') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function writeAuthorMessages(messages: AuthorMessage[]) {
  localStorage.setItem('cm-user-messages', JSON.stringify(messages));
}

async function sendSharedMessage(message: AuthorMessage): Promise<AuthorMessage> {
  const response = await fetch(apiUrl('/api/messages'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const data = await response.json() as { ok?: boolean; message?: AuthorMessage; error?: string };
  if (!response.ok || !data.ok || !data.message) {
    throw new Error(data.error || 'Unable to deliver the message to the shared message bus.');
  }
  return data.message;
}

export default function CommandCenter({ onHome }: { onHome: () => void }) {
  const [state,setState]=useState<SimulationState|null>(null),[selection,setSelection]=useState<Selection>(null);
  const [bridgeStatus,setBridgeStatus]=useState<'ONLINE'|'OFFLINE'|'CHECKING'|'ERROR'>('CHECKING');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[processing,setProcessing]=useState(false),[paused,setPaused]=useState(false);
  const [module,setModule]=useState<'OPERATIONS'|'PEOPLE'|'ARCHITECTURE'>('OPERATIONS'),[analysisOpen,setAnalysisOpen]=useState(false),[lab,setLab]=useState(false);
  const [overviewOpen,setOverviewOpen]=useState(true);
  const refresh=useCallback(async()=>{try{const response=await simulationRequest({action:'STATE'});setState(response.state);setBridgeStatus('ONLINE');setError('');return response.state;}catch(e){setBridgeStatus('OFFLINE');setError(e instanceof Error?e.message:'Engine unavailable');return null;}},[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),3000);return()=>clearInterval(timer);},[refresh]);
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),5000);return()=>window.clearTimeout(timer);},[notice]);
  const act=async(action:string,fields:Record<string,string>={})=>{
    const previousRevision=state?.network.graphRevision;
    setProcessing(true);setError('');
    try{
      const response=await simulationRequest({action,...fields});
      setState(response.state);setBridgeStatus('ONLINE');
      if(response.state&&['BLOCK','UNBLOCK','UNDO_BLOCK'].includes(action)){
        const label=action==='UNDO_BLOCK'?'Last road block':fields.edgeId?`Road ${fields.edgeId}`:'Road network';
        const verb=action==='BLOCK'?'blocked':action==='UNBLOCK'?'reopened':'reverted';
        setNotice(`${label} ${verb} · network revision ${previousRevision??response.state.network.graphRevision} → ${response.state.network.graphRevision}. C++ engine re-evaluated affected route state.`);
      }
    }catch(e){setNotice('');setError(e instanceof Error?e.message:'Operation failed');}
    finally{setProcessing(false);}
  };
  const incident=selection?.kind==='incident'?state?.incidents.find(i=>i.incidentId===selection.id):undefined;
  const road=selection?.kind==='road'?state?.network.roads.find(r=>r.roadId===selection.id):undefined;
  const facility=selection?.kind==='facility'?state?.facilities.find(f=>f.facilityId===selection.id):undefined;
  const responder=selection?.kind==='responder'?state?.responders.find(r=>r.responderId===selection.id):undefined;
  const active=state?visibleIncidents(state.incidents):[];
  const select=(next:Selection)=>{setSelection(next);setOverviewOpen(!next);};
  const readable=(value:string)=>value.replace(/_/g,' ');
  return <div className="command-center phase4 phase5">
    <header className="eoc-header">
      <div className="eoc-brand"><button onClick={onHome} aria-label="Return home">←</button><div><b>CrisisMesh 2.0</b><span>Emergency Operations Center</span></div></div>
      <nav aria-label="Author sections"><button aria-pressed={module==='OPERATIONS'} onClick={()=>setModule('OPERATIONS')}>Operations</button><button aria-pressed={module==='PEOPLE'} onClick={()=>setModule('PEOPLE')}>Users &amp; messaging</button><button aria-pressed={module==='ARCHITECTURE'} onClick={()=>setModule('ARCHITECTURE')}>DSA architecture</button></nav>
      <div className="eoc-header-state"><span className={`engine ${bridgeStatus.toLowerCase()}`}><i/>{bridgeStatus}</span><span>Revision<b>{state?.network.graphRevision??'—'}</b></span><span>Active incidents<b>{active.length}</b></span><span>Available units<b>{state?.analytics.availableResponders??'—'}</b></span></div>
    </header>
    {error&&<div className="eoc-system-error" role="alert"><div><b>Operations alert</b><span>{error}</span></div><button onClick={()=>{setError('');void refresh();}}>Retry / sync</button></div>}
    {notice&&<div className="eoc-system-notice" role="status"><div><b>Network update confirmed</b><span>{notice}</span></div><button onClick={()=>setNotice('')} aria-label="Dismiss network update">Dismiss</button></div>}
    {module==='PEOPLE'?<div className="eoc-module-shell"><UserDatabasePanel/></div>:module==='ARCHITECTURE'?<DsaArchitecturePanel onOpenInspector={()=>setLab(true)}/>:<main className="eoc-layout">
      <aside className="eoc-incidents"><header><div><span>Priority work</span><h1>Active incidents</h1></div><b>{active.length}</b></header><div className="eoc-primary-actions"><button disabled={processing||!state?.nextDispatch} onClick={()=>void act('PROCESS_NEXT')}>{processing?'Processing…':'Process next'}</button><button onClick={()=>setAnalysisOpen(v=>!v)} aria-pressed={analysisOpen}>Graph analysis</button></div>
        <div className="eoc-incident-list">{active.map(i=><button key={i.incidentId} className={`status-${i.status.toLowerCase().replace(/_/g,'-')}`} aria-pressed={selection?.id===i.incidentId} onClick={()=>select({kind:'incident',id:i.incidentId})}><span className="eoc-incident-top"><b>{i.incidentId}</b><em>P{i.priorityScore}</em></span><strong>{readable(i.type)}</strong><span>{state?.network.nodes.find(node=>node.locationId===i.locationId)?.name??i.locationId} · {readable(i.status)}</span><small>{i.assignedResponderId||'Awaiting responder assignment'}</small></button>)}{state&&!active.length&&<div className="eoc-empty"><b>No active incidents</b><span>Citizen reports will enter the C++ intake queue here.</span></div>}{!state&&<div className="eoc-empty"><b>{bridgeStatus==='CHECKING'?'Connecting to engine':'Engine offline'}</b><span>Operational incidents will appear after synchronization.</span></div>}</div>
        <footer><span>Priority and dispatch authority</span><b>C++ SimulationEngine</b></footer>
      </aside>
      <section className="eoc-map">{state?<TacticalMap state={state} selection={selection} onSelection={select} analysisOpen={analysisOpen} onAnalysisClose={()=>setAnalysisOpen(false)} paused={paused||bridgeStatus!=='ONLINE'}/>:<div className="eoc-map-state"><Activity/><b>{bridgeStatus==='CHECKING'?'Connecting to the simulation engine':'Operational map unavailable'}</b><span>{bridgeStatus==='CHECKING'?'Loading authoritative network state…':'Start the development bridge, then retry the connection.'}</span></div>}</section>
      <aside className="eoc-detail"><header><b>{overviewOpen||!selection?'Operations overview':'Selection details'}</b><div>{selection&&<button onClick={()=>setOverviewOpen(v=>!v)}>{overviewOpen?'Show selection':'Overview'}</button>}{selection&&!overviewOpen&&<button aria-label="Clear selection" onClick={()=>select(null)}><X size={15}/></button>}</div></header>
        {state&&(overviewOpen||!selection)?<OperationsPanel state={state} paused={paused} processing={processing} onTogglePaused={()=>setPaused(v=>!v)} onProcessNext={()=>act('PROCESS_NEXT')} onUndoBlock={()=>act('UNDO_BLOCK')} onRefresh={refresh} onSelectIncident={id=>select({kind:'incident',id})}/>:incident&&state?<RouteInspector key={incident.incidentId} incident={incident} dispatch={state.dispatches.find(d=>d.incidentId===incident.incidentId)} state={state} onRefresh={refresh} onAnalyze={()=>setAnalysisOpen(true)}/>:road?<div className="tm-inspector"><span className="tm-kicker">ROAD SEGMENT</span><h2>{road.roadId}</h2><p>{state?.network.nodes.find(n=>n.locationId===road.from)?.name??road.from} → {state?.network.nodes.find(n=>n.locationId===road.to)?.name??road.to}</p><div className="tm-facts"><span>Distance<b>{road.distance.toFixed(2)} km</b></span><span>Travel time<b>{road.travelTime.toFixed(1)} min</b></span><span>Status<b>{road.blocked?'BLOCKED':'OPEN'}</b></span><span>Road class<b>{readable(road.roadClass)}</b></span><span>Congestion<b>{road.congestion}</b></span><span>Risk<b>{road.risk}</b></span><span>Capacity<b>{road.capacity}</b></span></div><button className={road.blocked?'eoc-safe-action':'eoc-danger-action'} disabled={processing} onClick={()=>void act(road.blocked?'UNBLOCK':'BLOCK',{edgeId:road.roadId})}>{road.blocked?'Reopen road':'Block road'}</button><p>Road changes advance the graph revision and invalidate older route snapshots.</p></div>:facility||responder?<div className="tm-inspector"><span className="tm-kicker">{facility?'FACILITY':'RESPONDER'}</span><h2>{facility?.name||responder?.responderId}</h2><div className="tm-facts">{Object.entries(facility||responder||{}).map(([key,value])=><span key={key}>{readable(key)}<b>{readable(String(value??'—'))}</b></span>)}</div>{responder?.assignedIncidentId&&<button onClick={()=>select({kind:'incident',id:responder.assignedIncidentId!})}>Focus assigned incident</button>}</div>:null}
      </aside>
    </main>}
    {lab&&<MasterDSALab onClose={()=>setLab(false)}/>}
  </div>;
}

function UserDatabasePanel() {
  const [users,setUsers]=useState<AuthorUser[]>([]);
  const [usersLoading,setUsersLoading]=useState(true);
  const [usersError,setUsersError]=useState('');
  const [messages,setMessages]=useState<AuthorMessage[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Inactive'>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'created' | 'id'>('recent');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [composeSubject, setComposeSubject] = useState('Operations update');
  const [composeBody, setComposeBody] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('City-wide advisory');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [directFeedback, setDirectFeedback] = useState<string | null>(null);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    setUsersError('');
    try {
      // One-time/ongoing migration of legacy users that existed only in this Author browser.
      const legacyUsers = readAuthorUsers();
      await Promise.allSettled(legacyUsers.map((user) => fetch(apiUrl('/api/users/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
      })));

      // Migrate legacy messages from this Author browser once; server IDs make the sync idempotent.
      const legacyMessages = readAuthorMessages();
      await Promise.allSettled(legacyMessages.map((message) => fetch(apiUrl('/api/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })));

      const [usersResponse, messagesResponse] = await Promise.all([
        fetch(apiUrl('/api/users')),
        fetch(apiUrl('/api/messages?scope=author')),
      ]);
      const usersData = await usersResponse.json() as { ok?: boolean; users?: AuthorUser[]; error?: string };
      const messagesData = await messagesResponse.json() as { ok?: boolean; messages?: AuthorMessage[]; error?: string };

      if (!usersResponse.ok || !usersData.ok || !Array.isArray(usersData.users)) {
        throw new Error(usersData.error || 'Unable to load the shared online user registry.');
      }
      if (!messagesResponse.ok || !messagesData.ok || !Array.isArray(messagesData.messages)) {
        throw new Error(messagesData.error || 'Unable to load the shared message bus.');
      }

      setUsers(usersData.users);
      setMessages(messagesData.messages);
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Unable to load registered users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsers();
    const timer = window.setInterval(() => void refreshUsers(), 3000);
    return () => window.clearInterval(timer);
  }, [refreshUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = users.filter((user) => {
      if (statusFilter !== 'ALL' && (user.accountStatus || 'Active') !== statusFilter) return false;
      if (!normalized) return true;
      return [user.name, user.username, user.email, user.phone, user.id].some((value) => value.toLowerCase().includes(normalized));
    });
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'id') return a.id.localeCompare(b.id);
      if (sortBy === 'created') return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      return (b.lastLogin ?? b.createdAt ?? 0) - (a.lastLogin ?? a.createdAt ?? 0);
    });
    return list;
  }, [query, sortBy, statusFilter, users]);

  useEffect(() => {
    if (!filteredUsers.length) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId || !filteredUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const userActivity = messages.filter((message) => {
    if (!selectedUser) return false;
    return message.recipientId === selectedUser.id || message.senderId === selectedUser.id || (message.type === 'broadcast' && message.recipientId === 'all');
  }).slice().reverse();

  const refreshStore = () => {
    void refreshUsers();
  };

  const sendDirectMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) {
      setDirectFeedback('Select a user before sending a message.');
      return;
    }
    if (!composeBody.trim()) {
      setDirectFeedback('Please enter a message before sending.');
      return;
    }
    const item: AuthorMessage = {
      id: crypto.randomUUID(),
      recipientId: selectedUser.id,
      senderId: 'author',
      senderName: 'Author Console',
      subject: composeSubject.trim() || 'Operations update',
      body: composeBody.trim(),
      createdAt: Date.now(),
      read: false,
      type: 'individual'
    };
    setDirectFeedback('Sending…');
    try {
      const delivered = await sendSharedMessage(item);
      writeAuthorMessages([...readAuthorMessages().filter((message) => message.id !== delivered.id), delivered]);
      setComposeBody('');
      setComposeSubject('Operations update');
      setDirectFeedback('Message delivered to the user inbox.');
      setBroadcastFeedback(null);
      await refreshUsers();
    } catch (error) {
      setDirectFeedback(error instanceof Error ? error.message : 'Unable to deliver the message.');
    }
  };

  const sendBroadcast = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!broadcastBody.trim()) {
      setBroadcastFeedback('Please enter a message before sending.');
      return;
    }
    const confirmed = window.confirm('Send this announcement to all registered users?');
    if (!confirmed) return;
    const item: AuthorMessage = {
      id: crypto.randomUUID(),
      recipientId: 'all',
      senderId: 'author',
      senderName: 'Author Console',
      subject: broadcastSubject.trim() || 'City-wide advisory',
      body: broadcastBody.trim(),
      createdAt: Date.now(),
      read: false,
      type: 'broadcast'
    };
    setBroadcastFeedback('Sending…');
    try {
      const delivered = await sendSharedMessage(item);
      writeAuthorMessages([...readAuthorMessages().filter((message) => message.id !== delivered.id), delivered]);
      setBroadcastBody('');
      setBroadcastSubject('City-wide advisory');
      setBroadcastFeedback('Announcement delivered to all registered user inboxes.');
      setDirectFeedback(null);
      await refreshUsers();
    } catch (error) {
      setBroadcastFeedback(error instanceof Error ? error.message : 'Unable to deliver the announcement.');
    }
  };

  return <div className="author-db-panel">
    <div className="detail-head author-db-head">
      <div className="author-db-header-copy">
        <span className="eyebrow">USER MANAGEMENT / MESSAGE BUS</span>
        <h2>User Database</h2>
      </div>
      <button className="summary-action" onClick={() => refreshStore()}><RefreshCw size={14} /> Refresh</button>
    </div>

    <p className="author-db-subtitle">Manage and review the shared online CrisisMesh user registry. New browser and mobile registrations synchronize automatically.</p>
    {usersError&&<div className="empty-state"><strong>User registry temporarily unavailable</strong><span>{usersError}</span></div>}

    <div className="author-db-stats">
      <div><span>Total Users</span><b>{users.length}</b></div>
      <div><span>Active</span><b>{users.filter((user) => (user.accountStatus || 'Active') === 'Active').length}</b></div>
      <div><span>Inactive</span><b>{users.filter((user) => (user.accountStatus || 'Active') === 'Inactive').length}</b></div>
      <div><span>Messages</span><b>{messages.length}</b></div>
    </div>

    <div className="author-db-layout">
      <section className="author-db-list">
        <div className="author-db-toolbar">
          <div className="author-search-shell">
            <label className="author-search" aria-label="Search users">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users by name, ID, email, or phone..." />
            </label>
            {query && <button type="button" className="author-search-clear" onClick={() => setQuery('')} aria-label="Clear search">Clear</button>}
          </div>
          <div className="author-filter-row">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'Active' | 'Inactive')} aria-label="Filter users by status">
              <option value="ALL">All Users</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'created' | 'id')} aria-label="Sort users">
              <option value="recent">Sort: Recent</option>
              <option value="name">Sort: Name</option>
              <option value="id">Sort: User ID</option>
              <option value="created">Sort: Created Date</option>
            </select>
          </div>
        </div>

        <div className="author-user-list">
          {filteredUsers.length ? filteredUsers.map((user) => {
            const status = (user.accountStatus || 'Active') as 'Active' | 'Inactive';
            const userId = user.id.slice(0, 6).toUpperCase();
            return (
              <div
                key={user.id}
                className={`author-user-card ${selectedUserId === user.id ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedUserId(user.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedUserId(user.id);
                  }
                }}
              >
                <div className="author-user-header">
                  <div className="author-avatar"><UserRound size={17} /></div>
                  <div className="author-user-identity">
                    <strong>{user.name}</strong>
                    <span className="user-id-badge">{userId}</span>
                  </div>
                </div>
                <div className="author-user-grid">
                  <div className="author-user-field">
                    <span>Email</span>
                    <b>{user.email}</b>
                  </div>
                  <div className="author-user-field">
                    <span>Phone</span>
                    <b>{user.phone}</b>
                  </div>
                  <div className="author-user-field">
                    <span>Status</span>
                    <b className={`status-pill ${status === 'Active' ? 'active' : 'inactive'}`}><i/> {status}</b>
                  </div>
                  <div className="author-user-field">
                    <span>Joined</span>
                    <b>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</b>
                  </div>
                </div>
                <div className="author-user-footer">
                  <span className="author-user-role">User</span>
                  <time>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'No login yet'}</time>
                  <button type="button" className="author-inline-action" onClick={(event) => { event.stopPropagation(); setSelectedUserId(user.id); }}>View</button>
                </div>
              </div>
            );
          }) : <div className="empty-state"><strong>{usersLoading?'Synchronizing users…':'No users found'}</strong><span>{usersLoading?'Loading the shared online registry.':'Try a different search term or clear the current filters.'}</span></div>}
        </div>
      </section>

      <aside className="author-db-profile">
        {!selectedUser ? <div className="empty-state"><strong>No registered users yet.</strong><span>New users appear automatically after registration.</span></div> : (
          <>
            <div className="author-profile-head">
              <div className="author-avatar large"><UserRound size={20} /></div>
              <div className="author-profile-ident">
                <strong>{selectedUser.name}</strong>
                <span>{selectedUser.username}</span>
              </div>
              <span className={`user-id-badge detail ${((selectedUser.accountStatus || 'Active') === 'Active' ? 'active' : 'inactive')}`}>{selectedUser.id.slice(0, 6).toUpperCase()}</span>
            </div>

            <div className="author-profile-meta">
              <div className="author-profile-row">
                <span className="meta-label">Status</span>
                <b className={`status-pill ${((selectedUser.accountStatus || 'Active') === 'Active' ? 'active' : 'inactive')}`}><i/> {selectedUser.accountStatus || 'Active'}</b>
              </div>
            </div>

            <div className="author-profile-grid">
              <div><span>Email</span><b>{selectedUser.email}</b></div>
              <div><span>Phone</span><b>{selectedUser.phone}</b></div>
              <div><span>Created</span><b>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Unknown'}</b></div>
              <div><span>Last Login</span><b>{selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Not yet logged in'}</b></div>
            </div>

            <div className="author-message-box">
              <div className="author-box-head"><MessageSquareText size={15} /><span>Recent communication</span></div>
              {userActivity.length ? (
                <div className="author-message-history">
                  {userActivity.slice(0, 5).map((entry) => (
                    <article key={entry.id} className={entry.type === 'broadcast' ? 'broadcast' : 'direct'}>
                      <strong>{entry.subject}</strong>
                      <span>{entry.senderName}</span>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                      <p>{entry.body}</p>
                    </article>
                  ))}
                </div>
              ) : <div className="empty-state small"><span>No messages yet.</span></div>}
            </div>

            <div className="author-profile-actions">
              <button type="button" className="primary" onClick={() => document.getElementById('author-direct-message')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                <Send size={14} /> Send Message
              </button>
            </div>

            <form className="author-direct-form" id="author-direct-message" onSubmit={sendDirectMessage}>
              <div className="author-box-head"><Mail size={15} /><span>Send Message</span></div>
              <label>To<input value={selectedUser.name} readOnly /></label>
              <label>Subject<input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} maxLength={80} /></label>
              <label>Message<textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} rows={4} maxLength={500} placeholder="Write a direct message to this user..." /></label>
              <div className="author-form-meta"><span>Character count: {composeBody.length} / 500</span></div>
              {directFeedback && <div className={`author-form-feedback ${directFeedback.includes('success') ? 'success' : 'error'}`}>{directFeedback}</div>}
              <div className="author-form-actions">
                <button type="button" className="secondary-action" onClick={() => { setComposeBody(''); setComposeSubject('Operations update'); setDirectFeedback(null); }}>Cancel</button>
                <button type="submit" className="primary" disabled={!composeBody.trim()}><Send size={14} /> Send Message</button>
              </div>
            </form>
          </>
        )}

        <form className="author-broadcast-form" onSubmit={sendBroadcast}>
          <div className="author-box-head"><Users size={15} /><span>Send Announcement</span></div>
          <label>Recipient<input value="All Registered Users" readOnly /></label>
          <label>Subject<input value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} maxLength={80} /></label>
          <label>Message<textarea value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} rows={4} maxLength={500} placeholder="Share a city-wide update with all registered users..." /></label>
          <div className="author-form-meta"><span>Character count: {broadcastBody.length} / 500</span></div>
          {broadcastFeedback && <div className={`author-form-feedback ${broadcastFeedback.includes('success') ? 'success' : 'error'}`}>{broadcastFeedback}</div>}
          <div className="author-form-actions">
            <button type="button" className="secondary-action" onClick={() => { setBroadcastBody(''); setBroadcastSubject('City-wide advisory'); setBroadcastFeedback(null); }}>Cancel</button>
            <button type="submit" className="primary muted" disabled={!broadcastBody.trim()}><Send size={14} /> Send Announcement</button>
          </div>
        </form>
      </aside>
    </div>
  </div>;
}

function Cell({ label, value, good, warn }: { label: string; value: string | number; good?: boolean; warn?: boolean }) {
  return <div><span>{label}</span><b className={good ? 'good' : warn ? 'warn' : ''}>{value}</b></div>;
}

function PipelineStatus({ events, incidentId }: { events: SimulationState['eventHistory'] | undefined; incidentId?: string | null }) {
  const scopedEvents = (events || []).filter(e => !incidentId || e.incidentId === incidentId);
  const stages = [
    ['REPORT', ['INCIDENT_CREATED','INCIDENT_REPORTED'], 'Incident domain'],
    ['QUEUE', ['INCIDENT_QUEUED'], 'Manual FIFO Queue'],
    ['PRIORITIZED', ['PRIORITY_CALCULATED','MAX_HEAP_INSERT','MAX_HEAP_EXTRACT'], 'Manual Max Heap'],
    ['RESPONDER SELECTION', ['RESPONDER_SELECTED'], 'C++ responder selection'],
    ['DIJKSTRA', ['ROUTE_CALCULATED','REROUTE_CALCULATED'], 'Graph + Min Heap'],
    ['DISPATCH', ['DISPATCH_STARTED','INCIDENT_EN_ROUTE'], 'C++ SimulationEngine'],
    ['REROUTE', ['REROUTE_REQUIRED','REROUTE_CALCULATED','DESTINATION_UNREACHABLE'], 'C++ road-state response'],
    ['RESPONSE', ['RESPONSE_COMPLETED','AWAITING_USER_CONFIRMATION'], 'Field response + user confirmation'],
['RESOLUTION', ['USER_CONFIRMED_RESOLUTION','INCIDENT_RESOLVED','INCIDENT_CLOSED'], 'User-confirmed lifecycle'],
    ['HISTORY', ['HISTORY_UPDATED'], 'Manual Linked List']
  ] as const;
  return <div className="ops-pipeline">{stages.map(([label, types, role], i) => {
    const hit = scopedEvents.filter(e => types.includes(e.type as never)).slice(-1)[0];
    const rerouteRelevant = scopedEvents.some(e => e.type === 'REROUTE_REQUIRED' || e.type === 'REROUTE_CALCULATED' || e.type === 'DESTINATION_UNREACHABLE');
    const dispatchObserved = scopedEvents.some(e => e.type === 'DISPATCH_STARTED' || e.type === 'INCIDENT_EN_ROUTE');
    const state = hit ? 'observed' : (label === 'REROUTE' && dispatchObserved && !rerouteRelevant ? 'not-required' : 'pending');
    return <div className={state} key={label}><b>{String(i+1).padStart(2,'0')}</b><span>{label}</span><small>{hit ? hit.message || hit.type.replace(/_/g,' ') : state === 'not-required' ? 'NOT REQUIRED' : 'PENDING'}</small><em>{role}</em></div>;
  })}</div>;
}

function OverviewPanel({ g, paused, setPaused, blocked, lastSimulation, bridgeStatus, onReport, state, opsTab, setOpsTab, onProcessNext, onUndoBlock, processing, selectedIncidentId, onRefresh }: {
  g: Graph; paused: boolean; setPaused: (v: boolean) => void; blocked: number; lastSimulation: SimulationResult | null;
  bridgeStatus: 'ONLINE' | 'OFFLINE' | 'CHECKING' | 'ERROR'; onReport: () => void; state: SimulationState | null;
  opsTab: 'DISPATCH'|'TIMELINE'|'PIPELINE'|'RESPONDERS'; setOpsTab: (v: 'DISPATCH'|'TIMELINE'|'PIPELINE'|'RESPONDERS') => void;
  onProcessNext: () => Promise<unknown>; onUndoBlock: () => Promise<void>; processing: boolean; selectedIncidentId?: string | null; onRefresh: () => Promise<void>;
}) {
  const intakeQueue = (state?.pendingIncidents || []).filter(item => item.stage === 'INTAKE_QUEUE');
  const priorityHeap = (state?.pendingIncidents || []).filter(item => item.stage === 'PRIORITY_HEAP');
  const incidentFor = (id: string) => state?.incidents.find(i => i.incidentId === id) ?? null;
  return <div className="detail-content">
    <div className="overview-card"><Activity size={18} /><div><strong>EMERGENCY OPERATIONS</strong><span>The city map is the operational view. Incident priority, responder assignment, routing, road state and allocation decisions are authoritative in the C++17 simulation engine.</span></div></div>
    <div className="metric-grid"><Cell label="VERTICES" value={state?.graph.vertices ?? g.getVertexCount()} /><Cell label="ROADS" value={state?.graph.roads ?? g.getEdgeCount()} /><Cell label="OPEN" value={state?.graph.openRoads ?? g.getOpenEdgeCount()} good /><Cell label="BLOCKED" value={state ? blocked : '—'} warn /></div>

    <div className="section-label">NEXT DISPATCH</div>
    <div className="next-dispatch-card">
      {state?.nextDispatch ? <><div><span>ENGINE-SELECTED CANDIDATE</span><b>{state.nextDispatch.incidentId}</b></div><strong>PRIORITY {state.nextDispatch.priority}</strong><small>Selection preview comes from the C++ manual Max Heap.</small></> : <div className="empty-state">No pending incident is currently available for processing.</div>}
      <button className="wide-action dispatch-next" disabled={processing || !state?.nextDispatch} onClick={onProcessNext}>{processing ? 'PROCESSING INCIDENT…' : 'PROCESS NEXT INCIDENT'}</button>
    </div>

    <div className="section-label">INTAKE QUEUE · FIFO</div>
    <div className="incident-queue-panel">
      {intakeQueue.map(item => { const incident = incidentFor(item.incidentId); return incident ? <div key={incident.incidentId} className="queue-row"><b>{String(item.position).padStart(2, '0')}</b><span><strong>{incident.incidentId}</strong><small>{incident.type} · {incident.locationId} · {incident.status}</small></span><em>{incident.priorityScore}</em></div> : null; })}
      {!intakeQueue.length && <div className="empty-state">No incidents waiting in the FIFO intake queue.</div>}
    </div>
    <div className="section-label">PRIORITY HEAP · MANUAL MAX HEAP</div>
    <div className="incident-queue-panel">
      {priorityHeap.map(item => { const incident = incidentFor(item.incidentId); return incident ? <div key={incident.incidentId} className={state?.nextDispatch?.incidentId === incident.incidentId ? 'queue-row next' : 'queue-row'}><b>{String(item.position).padStart(2, '0')}</b><span><strong>{incident.incidentId}</strong><small>{incident.type} · {incident.locationId} · {incident.status}</small></span><em>{incident.priorityScore}</em></div> : null; })}
      {!priorityHeap.length && <div className="empty-state">No incidents currently stored in the priority heap.</div>}
    </div>

    {lastSimulation?.result?.incident && <div className="engine-dispatch-card"><div><span>LAST C++ INCIDENT</span><b>{lastSimulation.result.incident.incidentId}</b></div><strong>{lastSimulation.result.incident.type} · PRIORITY {lastSimulation.result.incident.priorityScore}</strong><small>{lastSimulation.result.incident.status} · WAITING FOR COORDINATOR → {lastSimulation.result.incident.locationId}</small><button disabled title="Citizen selection is required before reporting.">REPORT ANOTHER EMERGENCY</button></div>}
    {!lastSimulation?.result?.incident && <button className="wide-action emergency-wide" disabled title="Citizen selection is required before reporting."><AlertTriangle size={14}/> REPORT EMERGENCY TO C++ ENGINE</button>}

    <div className="section-label">OPERATIONS ANALYTICS</div>
    <div className="analytics-grid">
      <Cell label="TOTAL" value={state?.analytics.totalIncidents ?? 0} /><Cell label="ACTIVE" value={state?.analytics.activeIncidents ?? 0} warn />
      <Cell label="RESOLVED" value={state?.analytics.resolvedIncidents ?? 0} good /><Cell label="UNREACHABLE" value={state?.analytics.unreachableIncidents ?? 0} warn />
      <Cell label="AVG PRIORITY" value={state ? state.analytics.averagePriority.toFixed(1) : '—'} /><Cell label="REROUTES" value={state?.analytics.rerouteCount ?? 0} />
    </div>

    <div className="section-label">ALLOCATION STATUS</div>
    <div className="allocation-strip"><span>SHELTERS <b>{state?.shelters.filter(s => s.status === 'OPERATIONAL').length ?? 0}</b></span><span>AVAILABLE CAPACITY <b>{state?.shelters.reduce((sum, s) => sum + s.availableCapacity, 0) ?? 0}</b></span><span>RESOURCE TYPES <b>{state?.resources.length ?? 0}</b></span></div>

    <div className="section-label">SIMULATION CONTROL</div><button className="wide-action" onClick={() => setPaused(!paused)}>{paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'RESUME MAP' : 'PAUSE MAP'}</button><button className="wide-action" disabled={!state?.roadUndoStack?.canUndo} onClick={onUndoBlock}>UNDO LAST ROAD BLOCK · STACK DEPTH {state?.roadUndoStack?.depth ?? 0}</button>
    <div className="section-label">ENGINE STATUS</div><div className="health-list"><span><Gauge /> C++ Simulation Development Bridge <b className={bridgeStatus === 'ONLINE' ? 'good' : 'warn'}>{bridgeStatus}</b></span><span><Clock3 /> Graph topology <b>{state?.graph.vertices ?? g.getVertexCount()} / {state?.graph.roads ?? g.getEdgeCount()}</b></span><span><LocateFixed /> Decision authority <b className="good">C++ ENGINE</b></span></div>
    <p className="detail-note">React presents C++ state and traces. It does not calculate priority, choose responders, allocate shelters, or calculate routes.</p>
    <OpsConsole state={state} tab={opsTab} setTab={setOpsTab} incidentId={selectedIncidentId} onRefresh={onRefresh} />
  </div>;
}

function OpsConsole({ state, tab, setTab, incidentId, onRefresh }: { state: SimulationState | null; tab: 'DISPATCH'|'TIMELINE'|'PIPELINE'|'RESPONDERS'; setTab: (v: 'DISPATCH'|'TIMELINE'|'PIPELINE'|'RESPONDERS') => void; incidentId?: string | null; onRefresh: () => Promise<void> }) {
  const tabs = ['DISPATCH','TIMELINE','PIPELINE','RESPONDERS'] as const;
  return <section className="ops-console"><div className="ops-console-head"><span>OPERATIONS CONSOLE</span><small>{state?.bridge || 'C++ Simulation Development Bridge'}</small></div><nav>{tabs.map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
    {tab === 'DISPATCH' && <div className="ops-console-grid">{(state?.activeDispatches || []).map(d => <article key={d.incidentId}><b>{d.incidentId}</b><span>{d.responderId} · {d.status}</span><small>{d.origin} → {d.destination}</small><small>{d.distance.toFixed(2)} KM · COST {d.routeCost.toFixed(2)}</small><small>{d.pathNodes.join(' → ')}</small></article>)}{!state?.activeDispatches?.length && <div className="empty-state">No active C++ dispatches.</div>}</div>}
    {tab === 'TIMELINE' && <div className="ops-events">{(state?.eventHistory || state?.recentEvents || []).filter(e => !incidentId || e.incidentId === incidentId).slice(-20).map(e => <div key={`${e.step}-${e.type}`}><b>{String(e.step).padStart(2,'0')}</b><span>{e.type.replace(/_/g,' ')}</span><small>{e.incidentId || 'ENGINE'} · {e.algorithm} · {e.message}</small></div>)}{!(state?.eventHistory || state?.recentEvents || []).filter(e => !incidentId || e.incidentId === incidentId).length && <div className="empty-state">No C++ events recorded for this incident.</div>}</div>}
    {tab === 'PIPELINE' && <PipelineStatus events={state?.eventHistory} incidentId={incidentId} />}
    {tab === 'RESPONDERS' && <ResponderOperations responders={state?.responders || []} onRefresh={onRefresh} />}
  </section>;
}

function ResponderOperations({ responders: engineResponders, onRefresh }: { responders: SimulationState['responders']; onRefresh: () => Promise<void> }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const setAvailability = async (responderId: string, availability: string) => {
    setSaving(responderId);
    setError('');
    try {
      await simulationRequest({ action: 'SET_RESPONDER', responderId, availability });
      await onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update responder availability.');
    } finally {
      setSaving(null);
    }
  };
  return <div className="responder-ops-grid">
    {error && <div className="empty-state" role="alert">{error}</div>}
    {engineResponders.map(r => <article key={r.responderId} className="responder-ops-row">
      <div><b>{r.responderId}</b><span>{r.type} · {r.status}</span><small>{r.locationId} · {r.assignedIncidentId || 'NO ACTIVE INCIDENT'}</small></div>
      <label>Availability<select aria-label={`Set availability for ${r.responderId}`} value={r.availability} disabled={saving === r.responderId} onChange={e => setAvailability(r.responderId, e.target.value)}><option>AVAILABLE</option><option>ASSIGNED</option><option>BUSY</option><option>OFFLINE</option></select></label>
    </article>)}
    {!engineResponders.length && <div className="empty-state">NO RESPONDERS AVAILABLE IN C++ STATE</div>}
  </div>;
}
