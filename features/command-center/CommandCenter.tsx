import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Ambulance, Building2, ChevronLeft, CircleAlert, Crosshair, Expand,
  Factory, Flame, GraduationCap, Hospital, Home, Layers, LockKeyhole, Mail, MapPin,
  Menu, MessageSquareText, Minus, Navigation, Pause, Play, Radio, RefreshCw, Search,
  Send, Shield, ShoppingCart, Train, Unlock, UserRound, Users, X, ZoomIn, ZoomOut, Route,
  Siren, Clock3, Gauge, LocateFixed, PanelLeftClose, PanelRightClose, Zap
} from 'lucide-react';
import DijkstraVisualizer, { type DijkstraFrame } from './DijkstraVisualizer';
import DSAVisualizer, { type DSAFrame, type DSAAlgorithm } from './DSAVisualizer';
import MasterDSALab from './MasterDSALab';
import EmergencyReport from '../emergency/EmergencyReport';
import {
  createCityGraph, facilities, incidents, responders,
  type Edge, type Facility, type Incident, type LocationType, type Responder, type Vertex
} from '../../core/graph';
import { simulationRequest } from '../../core/simulation/api';
import { isActiveOperationalIncident } from '../../core/simulation/selectors';
import type { ActiveDispatch, ReportResult, SimulationIncident, SimulationResponse, SimulationState } from '../../core/simulation/types';

const iconFor: Record<LocationType, LucideIcon> = {
  hospital: Hospital, fire: Flame, police: Shield, school: GraduationCap,
  market: ShoppingCart, shelter: Home, residential: Building2, intersection: MapPin,
  civic: Building2, transport: Train, industrial: Factory
};

const facilityColors: Record<string, string> = {
  hospital: '#42e6b4', fire: '#ff5968', police: '#70a9ff', school: '#b98cff',
  market: '#f5b84c', shelter: '#51d7d0', transport: '#2bd5ff', civic: '#8aa7b8',
  industrial: '#d68d65', residential: '#7697a6', intersection: '#38cfe9'
};

const facilityByNode = new Map(facilities.map(f => [f.nodeId, f]));
const incidentByNode = new Map(incidents.map(i => [i.locationId, i]));

function graphWithBlockedRoads(blockedEdgeIds: string[]) {
  const graph = createCityGraph();
  for (const edgeId of blockedEdgeIds) graph.blockEdge(edgeId);
  return graph;
}
const severityClass = (s: string) => s.toLowerCase().replace(/\s+/g, '-');
type SimulationResult = SimulationResponse<ReportResult>;
type AuthorUser = {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  passwordHash: string;
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

const districtShapes = [
  { name: 'NORTHSIDE', x: 51, y: 16, w: 43, h: 27, tone: 'north' },
  { name: 'OLD TOWN', x: 24, y: 42, w: 29, h: 34, tone: 'old' },
  { name: 'CENTRAL DISTRICT', x: 51, y: 47, w: 42, h: 39, tone: 'central' },
  { name: 'RIVERSIDE', x: 79, y: 46, w: 19, h: 38, tone: 'river' },
  { name: 'MARKET DISTRICT', x: 65, y: 62, w: 25, h: 23, tone: 'market' },
  { name: 'UNIVERSITY', x: 51, y: 81, w: 37, h: 17, tone: 'university' },
  { name: 'INDUSTRIAL ZONE', x: 86, y: 80, w: 22, h: 26, tone: 'industrial' },
  { name: 'RESIDENTIAL', x: 17, y: 23, w: 22, h: 28, tone: 'residential' }
];

function curvedPath(a: Vertex, b: Vertex, index: number) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const bend = ((index % 3) - 1) * Math.min(4.2, len * 0.13);
  const cx = mx - (dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

function edgeMidpoint(a: Vertex, b: Vertex) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export default function CommandCenter({ onHome }: { onHome: () => void }) {
  const [g, setG] = useState(createCityGraph);
  const [selectedNode, setSelectedNode] = useState<Vertex | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<Edge | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [layers, setLayers] = useState({ roads: true, facilities: true, incidents: true, responders: true, districts: true, traffic: true, risk: false, blocked: true });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [full, setFull] = useState(false);
  const [collapsedLeft, setCollapsedLeft] = useState(false);
  const [collapsedRight, setCollapsedRight] = useState(false);
  const [paused, setPaused] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [routing, setRouting] = useState(false);
  const [dijkstraOpen, setDijkstraOpen] = useState(false);
  const [dsaOpen, setDsaOpen] = useState(false);
  const [masterDsaOpen, setMasterDsaOpen] = useState(false);
  const [dsaAlgorithm, setDsaAlgorithm] = useState<DSAAlgorithm>('BFS');
  const [dsaFrame, setDsaFrame] = useState<DSAFrame | null>(null);
  const [dijkstraFrame, setDijkstraFrame] = useState<DijkstraFrame | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [lastSimulation, setLastSimulation] = useState<SimulationResult | null>(null);
  const [engineState, setEngineState] = useState<SimulationState | null>(null);
  const [selectedEngineIncidentId, setSelectedEngineIncidentId] = useState<string | null>(null);
  const [opsTab, setOpsTab] = useState<'DISPATCH'|'TIMELINE'|'PIPELINE'|'RESPONDERS'>('DISPATCH');
  const [authorModule, setAuthorModule] = useState<'OPERATIONS' | 'USER_DB'>('OPERATIONS');
  const [bridgeStatus, setBridgeStatus] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING' | 'ERROR'>('CHECKING');
  const [processing, setProcessing] = useState(false);
  const [systemEvent, setSystemEvent] = useState('Awaiting operational activity');
  const mapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const refreshState = useCallback(async () => {
    try {
      setBridgeStatus('CHECKING');
      const data = await simulationRequest<SimulationResponse>({ action: 'STATE' });
      if (!data.state) throw new Error('C++ Simulation Development Bridge returned no STATE snapshot.');
      setEngineState(data.state);
      setBridgeStatus('ONLINE');
      const latest = data.state.recentEvents?.[data.state.recentEvents.length - 1];
      setSystemEvent(latest ? `${latest.type.replace(/_/g, ' ')} · ${latest.message}` : 'C++ simulation state synchronized');
      return data.state;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to communicate with the simulation bridge.';
      setSystemEvent(message);
      setBridgeStatus(message.includes('invalid response') || message.includes('STATE snapshot') ? 'ERROR' : 'OFFLINE');
      return null;
    }
  }, []);

  const undoLastRoadBlock = useCallback(async () => {
    try {
      const data = await simulationRequest<SimulationResponse>({ action: 'UNDO_BLOCK' });
      if (!data.state) throw new Error('The C++ bridge returned no STATE snapshot after undo.');
      setEngineState(data.state); setBridgeStatus('ONLINE');
      setG(graphWithBlockedRoads(data.state.graph.blockedEdgeIds));
      setSystemEvent('ROAD OPERATION UNDONE · MANUAL STACK');
    } catch (error: unknown) { setSystemEvent(error instanceof Error ? error.message : 'Unable to undo the last road block.'); }
  }, []);

  const processNextIncident = useCallback(async () => {
    setProcessing(true);
    try {
      const data = await simulationRequest<SimulationResponse>({ action: 'PROCESS_NEXT' });
      const latest = data.events[data.events.length - 1] ?? null;
      if (latest?.message) setSystemEvent(`${latest.type.replace(/_/g, ' ')} · ${latest.message}`);
      await refreshState();
      return data;
    } catch (error: unknown) {
      setSystemEvent(error instanceof Error ? error.message : 'Unable to process the next incident.');
      return null;
    } finally { setProcessing(false); }
  }, [refreshState]);

  useEffect(() => {
    let alive = true;
    refreshState().then(() => { if (!alive) return; });
    const timer = window.setInterval(() => { if (alive) refreshState(); }, 12000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [refreshState]);

  useEffect(() => {
    const latest = engineState?.recentEvents?.[engineState.recentEvents.length - 1];
    if (latest) setSystemEvent(`${latest.type.replace(/_/g, ' ')} · ${latest.message}`);
  }, [engineState]);
  const blocked = engineState?.graph.blockedRoads ?? g.getBlockedEdgeCount();
  const activeEngineDispatches = engineState?.activeDispatches ?? [];
  const engineIncidents = engineState?.incidents ?? [];
  const engineResponders = engineState?.responders ?? [];
  const selectedEngineIncident = selectedEngineIncidentId ? engineIncidents.find(i => i.incidentId === selectedEngineIncidentId) ?? null : null;
  const selectedEngineDispatch = selectedEngineIncidentId ? activeEngineDispatches.find(d => d.incidentId === selectedEngineIncidentId) ?? null : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFull(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      }
    };
    const onFullscreen = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, []);

  const clearSelection = () => {
    setAuthorModule('OPERATIONS');
    setSelectedNode(null); setSelectedRoad(null); setSelectedIncident(null); setSelectedEngineIncidentId(null); setSelectedFacility(null); setRouting(false);
  };

  const selectNode = (v: Vertex) => {
    setAuthorModule('OPERATIONS');
    setSelectedEngineIncidentId(null);
    setSelectedNode(v);
    setSelectedFacility(facilityByNode.get(v.id) || null);
    setSelectedIncident(incidentByNode.get(v.id) || null);
    setSelectedRoad(null);
  };

  const selectIncident = (incident: Incident) => {
    const node = g.getVertex(incident.locationId) || null;
    setAuthorModule('OPERATIONS');
    setSelectedEngineIncidentId(null);
    setSelectedIncident(incident);
    setSelectedNode(node);
    setSelectedFacility(node ? facilityByNode.get(node.id) || null : null);
    setSelectedRoad(null);
    setCollapsedRight(false);
  };

  const toggleRoad = async (id: string) => {
    const current = g.getEdge(id);
    if (!current) return;
    try {
      const data = await simulationRequest<SimulationResponse>({ action: current.blocked ? 'UNBLOCK' : 'BLOCK', edgeId: id });
      const authoritativeState = data.state;
      if (!authoritativeState) throw new Error('The C++ bridge returned no STATE snapshot after the road operation.');
      const nextGraph = graphWithBlockedRoads(authoritativeState.graph.blockedEdgeIds);
      const next = nextGraph.getEdge(id);
      setG(nextGraph);
      if (next) setSelectedRoad({ ...next });
      const latest = data.events[data.events.length - 1] ?? null;
      if (latest?.message) setSystemEvent(`${latest.type.replace(/_/g, ' ')} · ${latest.message}`);
      await refreshState();
    } catch (error: unknown) {
      setSelectedRoad({ ...current });
      setSystemEvent(error instanceof Error ? error.message : 'Road operation failed. Check the C++ bridge status and try again.');
    }
  };

  const fitCity = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const changeZoom = (delta: number) => setZoom(z => Math.max(0.72, Math.min(2.8, +(z + delta).toFixed(2))));

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen(); setFull(true); }
      catch { setFull(v => !v); }
    } else {
      try { await document.exitFullscreen(); } catch { setFull(false); }
    }
  };

  const transform = `translate(${pan.x} ${pan.y}) scale(${zoom})`;
  const routeEdges = useMemo(() => {
    if (selectedEngineDispatch?.pathEdges?.length) return selectedEngineDispatch.pathEdges.map(id => g.getEdge(id)).filter(Boolean) as Edge[];
    if (!selectedIncident) return [] as Edge[];
    const responder = responders.find(r => r.targetIncidentId === selectedIncident.id && r.routeEdgeIds?.length);
    if (!responder?.routeEdgeIds) return [] as Edge[];
    return responder.routeEdgeIds.map(id => g.getEdge(id)).filter(Boolean) as Edge[];
  }, [g, selectedIncident, selectedEngineDispatch]);
  const allEngineRouteEdges = useMemo(() => new Set(activeEngineDispatches.flatMap(d => d.pathEdges)), [activeEngineDispatches]);

  const handleDijkstraFrame = useCallback((frame: DijkstraFrame) => setDijkstraFrame(frame), []);

  const dijkstraContext = useMemo(() => {
    const engineResponder = selectedEngineIncident?.assignedResponderId ? engineResponders.find(r => r.responderId === selectedEngineIncident.assignedResponderId) : null;
    const staticResponder =
        selectedIncident?.id === 'INC-118' ? responders.find(r => r.id === 'AMB-UNIT-01') :
        selectedIncident?.id === 'INC-121' ? responders.find(r => r.id === 'POLICE-UNIT-01') :
        selectedIncident?.id === 'INC-127' ? responders.find(r => r.id === 'FIRE-UNIT-02') :
        responders.find(r => r.id === 'FIRE-UNIT-01');
    // For a C++ incident that has not been assigned, do not invent a responder
    // source for the Dijkstra visualizer. Static educational incidents may use
    // their existing demonstration responder mapping.
    const source = selectedEngineIncidentId ?
      (engineResponder ? { id: engineResponder.responderId, locationId: engineResponder.locationId } : null) :
      staticResponder;
    return {
      sourceId: source?.locationId ?? '',
      sourceLabel: source?.id ?? 'UNASSIGNED',
      destinationId: selectedEngineIncident?.locationId ?? selectedIncident?.locationId ?? lastSimulation?.result?.incident.locationId ?? 'LOC-007',
      destinationLabel: selectedEngineIncident?.incidentId ?? selectedIncident?.id ?? lastSimulation?.result?.incident.incidentId ?? 'INC-104'
    };
  }, [selectedIncident, selectedEngineIncident, selectedEngineIncidentId, lastSimulation, engineResponders]);

  return (
    <main className={`command-center ${full ? 'map-fullscreen' : ''}`}>
      <header className="cc-topbar">
        <button className="cc-brand" onClick={onHome} aria-label="Return to CrisisMesh home">
          <span className="cc-logo"><Radio size={17} /></span>
          <span>CRISISMESH<small>EMERGENCY OPERATIONS / OPERATIONS GRID</small></span>
        </button>
        <div className="cc-command-title"><span>AUTHOR COMMAND CENTER</span><b>ACADEMIC EMERGENCY OPERATIONS / DECISION SUPPORT</b></div>
        <div className="cc-topstats">
          <div><span>ENGINE</span><b className={bridgeStatus === 'ONLINE' ? 'online' : bridgeStatus === 'CHECKING' ? 'checking' : 'offline'}>● C++ BRIDGE {bridgeStatus}</b></div>
          <div><span>NETWORK</span><b>{engineState?.graph.vertices ?? g.getVertexCount()} NODES / {engineState?.graph.roads ?? g.getEdgeCount()} ROADS</b></div>
          <div><span>ACTIVE INCIDENTS</span><b>{engineState ? String(engineState.analytics.activeIncidents).padStart(2, '0') : '—'}</b></div>
          <div><span>QUEUED</span><b>{engineState ? String(engineState.queue.size).padStart(2, '0') : '—'}</b></div>
          <div><span>AVAILABLE UNITS</span><b>{engineState ? String(engineState.analytics.availableResponders).padStart(2, '0') : '—'}</b></div>
          <div><span>BLOCKED ROADS</span><b>{engineState ? String(engineState.graph.blockedRoads).padStart(2, '0') : '—'}</b></div>
        </div>
        <button className="cc-report-btn" onClick={() => setReportOpen(true)}><AlertTriangle size={14}/> REPORT EMERGENCY</button>
        <button className="cc-menu" onClick={() => setCollapsedLeft(v => !v)}><Menu size={19} /></button>
      </header>

      <div className="cc-body">
        <aside className={`cc-sidebar ${collapsedLeft ? 'collapsed' : ''}`}>
          <div className="cc-side-title"><span>OPERATIONS</span><button onClick={() => setCollapsedLeft(v => !v)}><ChevronLeft size={15} /></button></div>
          <button className="cc-nav active" onClick={clearSelection}><MapPin /><span>City Operations Map</span><em>GRID</em></button>
          <button className="cc-nav" onClick={() => { setAuthorModule('OPERATIONS'); const id = engineState?.nextDispatch?.incidentId; if (id) { const node = g.getVertex(engineState?.incidents.find(i => i.incidentId === id)?.locationId || '') || null; setSelectedEngineIncidentId(id); setSelectedIncident(null); setSelectedNode(node); setSelectedFacility(node ? facilityByNode.get(node.id) || null : null); setSelectedRoad(null); setCollapsedRight(false); } else { refreshState(); } }}><CircleAlert /><span>Incident Queue</span><em>{engineState ? engineState.queue.size + engineState.priorityHeap.size : '—'}</em></button>
          <button className="cc-nav" onClick={() => { setAuthorModule('OPERATIONS'); setOpsTab('RESPONDERS'); setSelectedEngineIncidentId(null); setSelectedIncident(null); setSelectedNode(null); setSelectedFacility(null); setSelectedRoad(null); }}><Navigation /><span>Responder Grid</span><em>{engineState ? engineResponders.length : '—'}</em></button>
          <button className="cc-nav muted-nav" onClick={() => { setAuthorModule('USER_DB'); setCollapsedRight(false); }}><Users /><span>User Database</span><em>{readAuthorUsers().length}</em></button>
          <button className="cc-nav" onClick={() => { setAuthorModule('OPERATIONS'); refreshState(); setCollapsedRight(false); }}><Activity /><span>Simulation State</span><em>{bridgeStatus}</em></button>
          <button className="cc-nav muted-nav dsa-nav" onClick={() => { setAuthorModule('OPERATIONS'); setDsaOpen(true); setDsaAlgorithm('BFS'); }}><Layers /><span>DSA Visualization</span><small>{dsaOpen || dijkstraOpen || masterDsaOpen ? "OPEN" : "READY"}</small></button><button className="cc-nav muted-nav dsa-nav" onClick={() => { setAuthorModule('OPERATIONS'); setMasterDsaOpen(true); }}><Layers /><span>Master DSA Lab</span><small>BST · AVL · SORT · SEARCH</small></button>

          <div className="side-block engine-cxx-incidents">
            <span>ENGINE INCIDENTS</span>
            {engineIncidents.map(i => <button key={i.incidentId} className={`incident-list engine-cxx ${selectedEngineIncidentId === i.incidentId ? 'active' : ''}`} onClick={() => { const node = g.getVertex(i.locationId) || null; setSelectedEngineIncidentId(i.incidentId); setSelectedIncident(null); setSelectedNode(node); setSelectedFacility(node ? facilityByNode.get(node.id) || null : null); setSelectedRoad(null); setCollapsedRight(false); }}>
              <i><CircleAlert size={11} /></i><span><b>{i.incidentId}</b><small>{i.type} · {i.status}</small></span><em>{i.priorityScore}</em>
            </button>)}
            {!engineIncidents.length && <div className="empty-side-state">No C++ incidents reported in this engine session.</div>}
          </div>

          <div className="side-block">
            <span>REFERENCE INCIDENTS</span>
            {incidents.map(i => <button key={i.id} className={`incident-list ${severityClass(i.severity)} ${selectedIncident?.id === i.id ? 'active' : ''}`} onClick={() => selectIncident(i)}><i><CircleAlert size={11} /></i><span><b>{i.id}</b><small>{i.type}</small></span><em>{i.priority.toFixed(0)}</em></button>)}
          </div>

          <div className="side-block responder-summary"><span>RESPONDER STATUS</span><div className="mini-stat"><i />Available <b>{engineState ? engineResponders.filter(r => r.status === 'AVAILABLE').length : '—'}</b></div><div className="mini-stat"><i className="amber-dot" />En Route <b>{engineState ? engineResponders.filter(r => r.status === 'EN_ROUTE').length : '—'}</b></div><div className="mini-stat"><i className="red-dot" />Assigned / Busy <b>{engineState ? engineResponders.filter(r => r.status === 'ASSIGNED' || r.status === 'BUSY').length : '—'}</b></div></div>

          <div className="layer-box">
            <div className="layer-title"><Layers size={13} /> MAP LAYERS</div>
            {Object.entries(layers).map(([key, val]) => <label key={key}><input type="checkbox" checked={val} onChange={() => setLayers(p => ({ ...p, [key]: !p[key as keyof typeof p] }))} /><span>{key === 'risk' ? 'Risk Zones' : key === 'blocked' ? 'Blocked Roads' : key[0].toUpperCase() + key.slice(1)}</span></label>)}
          </div>
          <div className="cc-side-bottom"><span>C++ SIMULATION BRIDGE</span><b className={bridgeStatus === 'ONLINE' ? 'good' : bridgeStatus === 'CHECKING' ? 'checking' : 'warn'}>● {bridgeStatus}</b><small>AUTHORITATIVE DECISION ENGINE</small></div>
        </aside>

        <section className="cc-main">
          <div className="map-toolbar">
            <div><span className="eyebrow"><span>CRISIS CITY</span> / OPERATIONS GRID</span><h1>City Operations Map</h1><small>FICTIONAL MUNICIPAL EMERGENCY SIMULATION · C++ ENGINE · DEVELOPMENT BRIDGE</small><small className="map-activity">{systemEvent}</small></div>
            <div className="toolbar-actions">
              <button onClick={() => setPaused(v => !v)} title="Pause or resume map motion">{paused ? <Play size={13} /> : <Pause size={13} />}<span>{paused ? 'RESUME MAP' : 'PAUSE MAP'}</span></button>
              <button onClick={fitCity}><Crosshair size={13} /><span>FIT CITY</span></button>
              <button onClick={toggleFullscreen}><Expand size={13} /><span>{full ? 'EXIT MAP' : 'FULL SCREEN'}</span></button>
            </div>
          </div>

          <div className={`map-shell ${paused ? 'view-paused' : ''}`} ref={mapRef}>
            <svg
              ref={svgRef}
              className="city-map"
              viewBox="0 0 100 100"
              onWheel={e => {
                if (e.cancelable) e.preventDefault();
                changeZoom(e.deltaY < 0 ? .12 : -.12);
              }}
              onPointerDown={e => { if ((e.target as Element).closest('.map-interactive')) return; setDrag({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }); e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={e => { if (!drag) return; const rect = svgRef.current?.getBoundingClientRect(); if (!rect) return; setPan({ x: drag.px + ((e.clientX - drag.x) / rect.width) * 100 / zoom, y: drag.py + ((e.clientY - drag.y) / rect.height) * 100 / zoom }); }}
              onPointerUp={() => setDrag(null)}
              onDoubleClick={() => changeZoom(.25)}
            >
              <defs>
                <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".55" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M4 0H0V4" fill="none" stroke="#163342" strokeWidth=".08" opacity=".75" /></pattern>
                <pattern id="microgrid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#102630" strokeWidth=".04" opacity=".5" /></pattern>
                <linearGradient id="river" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#082431" /><stop offset=".5" stopColor="#0b2c3b" /><stop offset="1" stopColor="#071d28" /></linearGradient>
              </defs>
              <rect width="100" height="100" fill="#050d14" />
              <rect width="100" height="100" fill="url(#microgrid)" opacity=".75" />
              <rect width="100" height="100" fill="url(#grid)" opacity=".55" />
              <g transform={transform}>
                {layers.districts && <g className="districts">
                  {districtShapes.map(d => <g key={d.name} className={`district-shape ${d.tone}`}><rect x={d.x - d.w / 2} y={d.y - d.h / 2} width={d.w} height={d.h} rx="1.5" /><text x={d.x - d.w / 2 + 2} y={d.y - d.h / 2 + 3.5}>{d.name}</text></g>)}
                  <path className="river-line" d="M 94 0 C 86 12 91 23 84 35 S 88 55 80 67 S 83 86 75 100" />
                </g>}

                {layers.roads && <g className="roads">
                  {g.getEdges().map((edge, index) => {
                    const a = g.getVertex(edge.from)!; const b = g.getVertex(edge.to)!; const d = curvedPath(a, b, index); const mid = edgeMidpoint(a, b);
                    const isSelected = selectedRoad?.id === edge.id;
                    const isRoute = !dijkstraOpen && (routeEdges.some(r => r.id === edge.id) || allEngineRouteEdges.has(edge.id));
                    const dijkstraFinal = dijkstraFrame?.finalEdges.has(edge.id);
                    const dsaFinal = dsaFrame?.finalEdges.has(edge.id);
                    const dsaActive = dsaFrame?.activeEdgeId === edge.id;
                    const dijkstraExamined = dijkstraFrame?.examinedEdgeId === edge.id;
                    const dijkstraRelaxed = dijkstraFrame?.relaxedEdges.has(edge.id);
                    const state = edge.blocked ? 'blocked' : edge.congestionLevel >= 6 && layers.traffic ? 'congested' : edge.riskLevel >= 3 && layers.risk ? 'risk' : '';
                    return <g className={`map-interactive road-group ${dijkstraExamined ? 'dijkstra-examined' : ''} ${dijkstraRelaxed ? 'dijkstra-relaxed' : ''} ${dijkstraFinal ? 'dijkstra-final' : ''} ${dsaActive ? 'dsa-edge-active' : ''} ${dsaFinal ? 'dsa-edge-final' : ''}`} key={edge.id} onClick={e => { e.stopPropagation(); setSelectedRoad({ ...edge }); setSelectedNode(null); setSelectedIncident(null); setSelectedFacility(null); }}>
                      <path className="road-hit" d={d} />
                      <path className={`road-base ${state} ${isSelected ? 'selected' : ''} ${isRoute ? 'route-active' : ''}`} d={d} />
                      {isRoute && <path className="route-flow" d={d} />}
                      {dijkstraExamined && <path className="dijkstra-edge-pulse" d={d} />}
                      {dijkstraFinal && <path className="dijkstra-route-flow" d={d} />}
                      {dsaFinal && <path className="dsa-route-flow" d={d} />}
                      {dsaActive && <path className="dsa-edge-pulse" d={d} />}
                      {edge.blocked && layers.blocked && <g className="road-barrier"><line x1={mid.x - 1.2} y1={mid.y - 1.2} x2={mid.x + 1.2} y2={mid.y + 1.2} /><line x1={mid.x + 1.2} y1={mid.y - 1.2} x2={mid.x - 1.2} y2={mid.y + 1.2} /></g>}
                      {index % 6 === 0 && <text className="road-label" x={mid.x + .8} y={mid.y - .8}>{edge.id}</text>}
                    </g>;
                  })}
                </g>}

                {layers.responders && (engineState ? engineResponders : responders).map(r => {
                  const responderId = 'responderId' in r ? r.responderId : r.id;
                  const locationId = r.locationId;
                  const status = r.status;
                  const assignedId = 'assignedIncidentId' in r ? r.assignedIncidentId : r.targetIncidentId ?? null;
                  const n = g.getVertex(locationId);
                  if (!n) return null;
                  const engineTarget = assignedId ? engineIncidents.find(i => i.incidentId === assignedId) : undefined;
                  const staticTarget = assignedId ? incidents.find(i => i.id === assignedId) : undefined;
                  const targetLocation = engineTarget?.locationId ?? staticTarget?.locationId;
                  const t = targetLocation ? g.getVertex(targetLocation) : undefined;
                  const type = String(r.type);
                  const RIcon = type.includes('FIRE') ? Flame : type.includes('AMBULANCE') ? Ambulance : Shield;
                  const isSource = responderId === dijkstraContext.sourceLabel && dijkstraOpen;
                  return <g className={`responder-marker map-interactive ${String(status).toLowerCase().replace(/\s+/g, '-')} ${isSource ? 'dijkstra-source' : ''}`} key={responderId} transform={`translate(${n.x},${n.y})`} onClick={e => { e.stopPropagation(); setSelectedNode(n); setSelectedFacility(facilityByNode.get(n.id) || null); setSelectedEngineIncidentId(engineTarget ? engineTarget.incidentId : null); setSelectedIncident(staticTarget || null); setSelectedRoad(null); }}>
                    {t && (status === 'EN_ROUTE' || status === 'EN ROUTE' || status === 'ASSIGNED') && <line className="responder-link" x1="0" y1="0" x2={t.x - n.x} y2={t.y - n.y} />}
                    <circle r="1.9" className="responder-halo" /><circle r="1.25" className="responder-core" /><foreignObject x="-.95" y="-.95" width="1.9" height="1.9" pointerEvents="none"><div className="responder-icon"><RIcon size={7} /></div></foreignObject>
                    <text x="2.4" y="-.6">{responderId.replace('UNIT-', '')}</text>
                  </g>;
                })}

                {layers.facilities && g.getVertices().map(v => {
                  const f = facilityByNode.get(v.id); const I = iconFor[v.type];
                  if (!f && v.type === 'intersection') {
                    const intersectionState = dijkstraOpen && dijkstraFrame ? (
                      dijkstraFrame.finalNodes.has(v.id) ? 'dijkstra-final-node' : dijkstraFrame.currentNodeId === v.id ? 'dijkstra-current-node' : dijkstraFrame.visited.has(v.id) ? 'dijkstra-visited-node' : dijkstraFrame.discovered.has(v.id) ? 'dijkstra-discovered-node' : ''
                    ) : dsaOpen && dsaFrame ? (
                      dsaFrame.finalNodes.has(v.id) ? 'dsa-final-node' : dsaFrame.currentNodeId === v.id ? 'dsa-current-node' : dsaFrame.visited.has(v.id) ? 'dsa-visited-node' : dsaFrame.discovered.has(v.id) ? 'dsa-discovered-node' : ''
                    ) : '';
                    return <g className={`intersection-node ${intersectionState} ${v.id === dijkstraContext.destinationId && dijkstraOpen ? 'dijkstra-destination-node' : ''} ${v.id === dsaFrame?.currentNodeId && dsaOpen ? 'dsa-target-node' : ''}`} key={v.id} transform={`translate(${v.x},${v.y})`}><circle r=".9" /><circle r=".34" /></g>;
                  }
                  if (!f) return null;
                  const dijkstraNodeState = dijkstraOpen && dijkstraFrame ? (
                    dijkstraFrame.finalNodes.has(v.id) ? 'dijkstra-final-node' : dijkstraFrame.currentNodeId === v.id ? 'dijkstra-current-node' : dijkstraFrame.visited.has(v.id) ? 'dijkstra-visited-node' : dijkstraFrame.discovered.has(v.id) ? 'dijkstra-discovered-node' : ''
                  ) : dsaOpen && dsaFrame ? (
                    dsaFrame.finalNodes.has(v.id) ? 'dsa-final-node' : dsaFrame.currentNodeId === v.id ? 'dsa-current-node' : dsaFrame.visited.has(v.id) ? 'dsa-visited-node' : dsaFrame.discovered.has(v.id) ? 'dsa-discovered-node' : ''
                  ) : '';
                  return <g className={`facility-marker map-interactive ${selectedNode?.id === v.id ? 'selected' : ''} ${dijkstraNodeState} ${v.id === dijkstraContext.destinationId && dijkstraOpen ? 'dijkstra-destination-node' : ''}`} key={`${f.id}-${v.id}`} transform={`translate(${v.x},${v.y})`} onClick={e => { e.stopPropagation(); selectNode(v); }}>
                    <circle r={selectedNode?.id === v.id ? 3 : 2.4} className="facility-halo" style={{ stroke: facilityColors[v.type] }} /><circle r="1.45" className="facility-core" style={{ stroke: facilityColors[v.type] }} />
                    <foreignObject x="-1.1" y="-1.1" width="2.2" height="2.2" pointerEvents="none"><div className="facility-icon"><I size={8} /></div></foreignObject>
                    <text className="facility-label" x="3" y="-.7">{f.id}</text>
                  </g>;
                })}

                {layers.incidents && incidents.map(i => {
                  const n = g.getVertex(i.locationId)!; const active = selectedIncident?.id === i.id;
                  return <g className={`incident-marker map-interactive ${severityClass(i.severity)} ${active ? 'selected' : ''} ${dijkstraOpen && i.locationId === dijkstraContext.destinationId ? 'dijkstra-destination-node' : ''} ${dsaOpen && i.locationId === dsaFrame?.currentNodeId ? 'dsa-target-node' : ''}`} key={i.id} transform={`translate(${n.x + 2.4},${n.y - 2.6})`} onClick={e => { e.stopPropagation(); selectIncident(i); }}>
                    <circle className="incident-pulse" r={active ? 3.6 : 2.5} /><circle className="incident-core" r="1.25" /><foreignObject x="-.85" y="-.85" width="1.7" height="1.7" pointerEvents="none"><div className="incident-icon"><Siren size={7} /></div></foreignObject><text x="2.5" y=".8">{i.id}</text>
                  </g>;
                })}
                {layers.incidents && engineIncidents.filter(isActiveOperationalIncident).map(i => {
                  const n = g.getVertex(i.locationId); if (!n) return null;
                  const active = selectedEngineIncidentId === i.incidentId;
                  return <g className={`incident-marker cxx-engine-marker map-interactive ${i.priorityScore >= 100 ? 'critical' : i.priorityScore >= 75 ? 'high' : 'medium'} ${i.status === 'AWAITING_USER_CONFIRMATION' ? 'awaiting-confirmation' : ''} ${active ? 'selected' : ''}`} key={i.incidentId} transform={`translate(${n.x - 2.4},${n.y + 2.6})`} onClick={e => { e.stopPropagation(); setSelectedEngineIncidentId(i.incidentId); setSelectedIncident(null); setSelectedNode(n); setSelectedFacility(facilityByNode.get(n.id) || null); setSelectedRoad(null); setCollapsedRight(false); }}>
                    <circle className="incident-pulse" r={active ? 3.8 : 2.8} /><circle className="incident-core" r="1.3" /><foreignObject x="-.9" y="-.9" width="1.8" height="1.8" pointerEvents="none"><div className="incident-icon"><Siren size={7} /></div></foreignObject><text x="-2.8" y=".8">{i.incidentId}</text>
                  </g>;
                })}
              </g>
            </svg>

            <div className="map-title-overlay"><b>CRISIS CITY / OPERATIONS GRID</b><span>FICTIONAL MUNICIPAL EMERGENCY GRID · DATASET CM-CITY-01</span></div>
            <div className="map-state-chip"><span className="pulse-dot" /> VIEW STATE <b>{paused ? 'PAUSED' : 'INTERACTIVE'}</b></div>
            <div className="map-coords">VIEW {zoom.toFixed(2)}× · GRID 50.00 / 50.00 · {engineState?.graph.openRoads ?? g.getOpenEdgeCount()} OPEN ROADS</div>

            <div className="map-controls">
              <button onClick={() => changeZoom(.2)} title="Zoom in"><ZoomIn size={16} /></button>
              <button onClick={() => changeZoom(-.2)} title="Zoom out"><ZoomOut size={16} /></button>
              <button onClick={fitCity} title="Reset / fit city"><Crosshair size={16} /></button>
              <button onClick={toggleFullscreen} title="Fullscreen"><Expand size={16} /></button>
            </div>

            <div className={`map-legend-panel ${legendOpen ? 'open' : 'closed'}`}>
              <button className="legend-toggle" onClick={() => setLegendOpen(v => !v)}><Layers size={12} /> {legendOpen ? 'MAP LEGEND' : 'LEGEND'}</button>
              {legendOpen && <div className="legend-items"><span><Flame /> Fire</span><span><Hospital /> Hospital</span><span><Ambulance /> Ambulance</span><span><Shield /> Police</span><span><CircleAlert /> Incident</span><span><Navigation /> Responder</span><span><i className="legend-road major" /> Major Road</span><span><i className="legend-road minor" /> Secondary</span><span><i className="legend-road active" /> Active Route</span><span><i className="legend-road blocked" /> Blocked</span></div>}
            </div>
            <div className="map-scale">1 KM <i /><i /><i /><i /></div>
            {dsaOpen && (
              <DSAVisualizer
                algorithm={dsaAlgorithm}
                sourceNodeId={dijkstraContext.sourceId}
                destinationNodeId={dijkstraContext.destinationId}
                onFrame={setDsaFrame}
                onClose={() => { setDsaOpen(false); setDsaFrame(null); }}
                onOpenDijkstra={() => { setDsaOpen(false); setDsaFrame(null); setDijkstraOpen(true); }}
              />
            )}
            {dijkstraOpen && (
              <DijkstraVisualizer
                onFrame={handleDijkstraFrame}
                onClose={() => { setDijkstraOpen(false); setDijkstraFrame(null); }}
                sourceLabel={dijkstraContext.sourceLabel}
                destinationLabel={dijkstraContext.destinationLabel}
                sourceNodeId={dijkstraContext.sourceId}
                destinationNodeId={dijkstraContext.destinationId}
              />
            )}
            {masterDsaOpen && <MasterDSALab onClose={() => setMasterDsaOpen(false)} />}
          </div>
        </section>

        <aside className={`cc-detail ${collapsedRight ? 'collapsed' : ''}`}>
          <div className="detail-head">
            <div><span className="eyebrow">{selectedIncident ? 'INCIDENT / DISPATCH' : selectedFacility ? 'FACILITY STATUS' : selectedRoad ? 'ROAD INSPECTOR' : selectedNode ? 'NODE INSPECTOR' : 'NETWORK OVERVIEW'}</span><h2>{selectedIncident ? selectedIncident.id : selectedFacility ? selectedFacility.id : selectedRoad ? selectedRoad.id : selectedNode ? selectedNode.id : 'Operational Grid'}</h2></div>
            <div className="detail-head-actions"><button onClick={() => setCollapsedRight(v => !v)} title="Collapse panel"><PanelRightClose size={15} /></button>{(selectedIncident || selectedFacility || selectedNode || selectedRoad) && <button onClick={clearSelection}><X size={15} /></button>}</div>
          </div>
          {authorModule === 'USER_DB' ? <UserDatabasePanel /> : selectedEngineIncident ? <EngineIncidentPanel incident={selectedEngineIncident} dispatch={selectedEngineDispatch} state={engineState} onRefresh={refreshState} onOpenDijkstra={() => setDijkstraOpen(true)} /> : selectedIncident ? <IncidentPanel incident={selectedIncident} g={g} routing={routing} setRouting={setRouting} onOpenDijkstra={() => setDijkstraOpen(true)} lastSimulation={lastSimulation} /> : selectedFacility && selectedNode ? <FacilityPanel facility={selectedFacility} node={selectedNode} responders={responders} /> : selectedRoad ? <RoadPanel edge={selectedRoad} g={g} toggle={() => toggleRoad(selectedRoad.id)} /> : selectedNode ? <NodePanel node={selectedNode} g={g} onRoad={r => setSelectedRoad({ ...r })} /> : <OverviewPanel g={g} paused={paused} setPaused={setPaused} blocked={blocked} lastSimulation={lastSimulation} bridgeStatus={bridgeStatus} onReport={() => setReportOpen(true)} state={engineState} opsTab={opsTab} setOpsTab={setOpsTab} onProcessNext={processNextIncident} onUndoBlock={undoLastRoadBlock} processing={processing} selectedIncidentId={selectedEngineIncidentId} onRefresh={async () => { await refreshState(); }} />}
        </aside>
      </div>

      {reportOpen && <EmergencyReport onClose={() => setReportOpen(false)} onSubmitted={(result) => { setLastSimulation(result); refreshState(); }} />}
      <footer className="cc-statusbar">
        <Cell label="SIMULATION" value="DETERMINISTIC / LOCAL" /><Cell label="INCIDENTS" value={engineState ? engineIncidents.length : '—'} warn /><Cell label="RESPONDERS" value={engineState ? engineResponders.length : '—'} /><Cell label="OPEN ROADS" value={engineState?.graph.openRoads ?? g.getOpenEdgeCount()} good /><Cell label="BLOCKED" value={engineState ? blocked : '—'} warn /><Cell label="COMPONENTS" value={g.getConnectedComponents()} /><Cell label="GRAPH" value="ADJACENCY LIST" />
      </footer>
    </main>
  );
}

function UserDatabasePanel() {
  const [usersVersion, setUsersVersion] = useState(0);
  const [messagesVersion, setMessagesVersion] = useState(0);
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
  const users = useMemo(() => readAuthorUsers(), [usersVersion]);
  const messages = useMemo(() => readAuthorMessages(), [messagesVersion]);

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
    setUsersVersion((value) => value + 1);
    setMessagesVersion((value) => value + 1);
  };

  const sendDirectMessage = (event: React.FormEvent) => {
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
    const nextMessages = [...readAuthorMessages(), item];
    writeAuthorMessages(nextMessages);
    setComposeBody('');
    setComposeSubject('Operations update');
    setDirectFeedback('Message sent successfully.');
    setBroadcastFeedback(null);
    refreshStore();
  };

  const sendBroadcast = (event: React.FormEvent) => {
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
    const nextMessages = [...readAuthorMessages(), item];
    writeAuthorMessages(nextMessages);
    setBroadcastBody('');
    setBroadcastSubject('City-wide advisory');
    setBroadcastFeedback('Announcement sent successfully.');
    setDirectFeedback(null);
    refreshStore();
  };

  return <div className="author-db-panel">
    <div className="detail-head author-db-head">
      <div className="author-db-header-copy">
        <span className="eyebrow">USER MANAGEMENT / MESSAGE BUS</span>
        <h2>User Database</h2>
      </div>
      <button className="summary-action" onClick={() => refreshStore()}><RefreshCw size={14} /> Refresh</button>
    </div>

    <p className="author-db-subtitle">Manage and review registered CrisisMesh users.</p>

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
          }) : <div className="empty-state"><strong>No users found</strong><span>Try a different search term or clear the current filters.</span></div>}
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

function EngineIncidentPanel({ incident, dispatch, state, onRefresh, onOpenDijkstra }: { incident: SimulationIncident; dispatch: ActiveDispatch | null; state: SimulationState | null; onRefresh: () => Promise<SimulationState | null>; onOpenDijkstra: () => void }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const responder = state?.responders.find(r => r.responderId === incident.assignedResponderId);
  const events = (state?.eventHistory || state?.recentEvents || []).filter(e => e.incidentId === incident.incidentId);
  const completeResponse = async () => {
  setBusy(true);
  setActionError('');

  try {
    const response = await simulationRequest({
      action: 'RESPONSE_COMPLETED',
      incidentId: incident.incidentId,
    });

    if (response.ok === false) {
      throw new Error(
        response.error ||
        'Unable to mark the field response as completed.'
      );
    }

    await onRefresh();

  } catch (error: unknown) {
    setActionError(
      error instanceof Error
        ? error.message
        : 'Unable to complete the field response.'
    );

  } finally {
    setBusy(false);
  }
};  
  return <div className="detail-content incident-panel">
    <div className="cxx-incident-head"><div><span className="eyebrow">C++ INCIDENT / AUTHORITATIVE STATE</span><h3>{incident.incidentId}</h3><small>{incident.type} · {incident.locationId}</small></div><b className={incident.priorityScore >= 100 ? 'critical' : incident.priorityScore >= 75 ? 'high' : 'medium'}>{incident.priorityScore}</b></div>
    <div className="detail-grid"><div><span>SEVERITY</span><b>{incident.severity}/5</b></div><div><span>URGENCY</span><b>{incident.urgency}/5</b></div><div><span>VICTIMS</span><b>{incident.victimCount}</b></div><div><span>STATUS</span><b>{incident.status}</b></div><div><span>RESPONDER</span><b>{incident.assignedResponderId || 'WAITING'}</b></div><div><span>TYPE MATCH</span><b>{incident.requiredResponderType}</b></div></div>
    <div className="priority-formula"><span>AUTHORITATIVE PRIORITY FORMULA</span><b>severity × 12 + urgency × 10 + min(victims, 10) × 3 + type score</b><small>Score returned by Incident::calculatePriority() in C++.</small></div>
    <div className="decision-explanation"><div className="section-label">WHY THIS INCIDENT?</div><div className="decision-breakdown"><span>SEVERITY <b>{incident.severity * 12}</b></span><span>URGENCY <b>{incident.urgency * 10}</b></span><span>VICTIMS <b>{Math.min(incident.victimCount,10) * 3}</b></span><span>TYPE <b>{Math.max(0, incident.priorityScore - incident.severity * 12 - incident.urgency * 10 - Math.min(incident.victimCount,10) * 3)}</b></span></div><small>These components are read from the C++ incident record and deterministic priority formula.</small></div>
    {events.some(e => e.type === 'RESPONDER_CANDIDATE') && <div className="decision-explanation"><div className="section-label">WHY THIS RESPONDER?</div>{events.filter(e => e.type === 'RESPONDER_CANDIDATE').map(e => <div className="candidate-row" key={`${e.step}-${e.responderId}`}><b>{e.responderId || 'UNKNOWN'}</b><span>{e.status || '—'}</span><em>{e.status === 'REACHABLE' ? `COST ${(e.value1 ?? 0).toFixed(2)} · ${ (e.value2 ?? 0).toFixed(2)} KM` : 'UNREACHABLE'}</em></div>)}<small>Candidate costs are emitted by C++ Dijkstra; React does not rank them.</small></div>}
    <div className="section-label">C++ DISPATCH DECISION</div><div className="dispatch-proof"><div><span>SOURCE</span><b>C++ SimulationEngine</b></div><div><span>RESPONDER</span><b>{responder?.responderId || 'WAITING FOR RESOURCE'}</b></div><div><span>ROUTE COST</span><b>{dispatch ? dispatch.routeCost.toFixed(2) : '—'}</b></div><div><span>DISTANCE / TIME</span><b>{dispatch ? `${dispatch.distance.toFixed(2)} KM / ${dispatch.travelTime.toFixed(0)} MIN` : '—'}</b></div><div><span>SHELTER</span><b>{incident.shelterId || 'NOT REQUIRED / NOT ALLOCATED'}</b></div><div><span>RESOURCE</span><b>{incident.allocatedResourceType ? `${incident.allocatedResourceType} × ${incident.allocatedResourceQuantity ?? 0}` : 'NOT ALLOCATED'}</b></div>{dispatch?.reachable && dispatch.pathNodes.length ? <div className="dispatch-route"><span>C++ DIJKSTRA PATH</span><b>{dispatch.pathNodes.join(' → ')}</b></div> : <div className="dispatch-route unavailable"><span>ROUTE</span><b>ROUTE UNAVAILABLE</b></div>}</div>
    <div className="section-label">INCIDENT TIMELINE</div><div className="incident-timeline">{events.map(e => <div key={`${e.step}-${e.type}`}><b>{String(e.step).padStart(2,'0')}</b><span>{e.type.replace(/_/g,' ')}</span><small>{e.message}</small></div>)}{!events.length && <div className="empty-state">No retained C++ events for this incident.</div>}</div>
    {actionError && <div className="empty-state" role="alert">{actionError}</div>}<div className="dispatch-actions"><button onClick={onOpenDijkstra} disabled={!incident.assignedResponderId} title={incident.assignedResponderId ? 'Open the C++ Dijkstra route trace for the assigned responder.' : 'Dijkstra trace becomes operationally meaningful after C++ assigns a responder.'}><Route size={13}/> {incident.assignedResponderId ? 'OPEN DIJKSTRA TRACE' : 'DIJKSTRA TRACE · AWAITING ASSIGNMENT'}</button><button
  className="dispatch"
  disabled={
    busy ||
    incident.status === 'CLOSED' ||
    incident.status === 'AWAITING_USER_CONFIRMATION'
  }
  onClick={completeResponse}
>
  {busy
    ? 'COMPLETING RESPONSE…'
    : incident.status === 'AWAITING_USER_CONFIRMATION'
      ? 'WAITING FOR USER CONFIRMATION'
      : 'MARK RESPONSE COMPLETED'}
</button></div>
    <p className="detail-note">Priority, lifecycle, responder assignment and route metrics are returned by the C++ SimulationEngine. React only presents the state.</p>
  </div>;
}

function OverviewPanel({ g, paused, setPaused, blocked, lastSimulation, bridgeStatus, onReport, state, opsTab, setOpsTab, onProcessNext, onUndoBlock, processing, selectedIncidentId, onRefresh }: {
  g: ReturnType<typeof createCityGraph>; paused: boolean; setPaused: (v: boolean) => void; blocked: number; lastSimulation: SimulationResult | null;
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

    {lastSimulation?.result?.incident && <div className="engine-dispatch-card"><div><span>LAST C++ INCIDENT</span><b>{lastSimulation.result.incident.incidentId}</b></div><strong>{lastSimulation.result.incident.type} · PRIORITY {lastSimulation.result.incident.priorityScore}</strong><small>{lastSimulation.result.incident.status} · WAITING FOR COORDINATOR → {lastSimulation.result.incident.locationId}</small><button onClick={onReport}>REPORT ANOTHER EMERGENCY</button></div>}
    {!lastSimulation?.result?.incident && <button className="wide-action emergency-wide" onClick={onReport}><AlertTriangle size={14}/> REPORT EMERGENCY TO C++ ENGINE</button>}

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

function IncidentPanel({ incident, g, routing, setRouting, onOpenDijkstra, lastSimulation }: {
  incident: Incident;
  g: ReturnType<typeof createCityGraph>;
  routing: boolean;
  setRouting: (v: boolean) => void;
  onOpenDijkstra: () => void;
  lastSimulation: SimulationResult | null;
}) {
  const n = g.getVertex(incident.locationId)!;
  const simulationIncident = lastSimulation?.result?.incident.incidentId === incident.id ? lastSimulation.result.incident : null;
  const displayPriority = simulationIncident?.priorityScore ?? incident.priority;
  const displayStatus = simulationIncident?.status ?? incident.status;
  const routeNodes: string[] = [];
  const routeDistance = '—';
  const routeCost = '—';
  const eta = '—';
  const resourceType = incident.resource;
  return <div className="detail-content incident-panel">
    <div className={`incident-hero ${severityClass(incident.severity)}`}><div className={`incident-big ${severityClass(incident.severity)}`}><Siren size={22} /></div><div><strong>{incident.type}</strong><span>{incident.severity} PRIORITY</span></div><b>{Number(displayPriority).toFixed(0)}</b></div>
    <div className="incident-location"><MapPin size={14} /><div><b>{n.name}</b><span>{n.id} · Crisis City operational grid</span></div></div>
    <div className="detail-grid"><div><span>AFFECTED</span><b>{simulationIncident?.victimCount ?? incident.affected} PEOPLE</b></div><div><span>STATUS</span><b>{displayStatus}</b></div><div><span>RESOURCE</span><b>{resourceType}</b></div><div><span>ROUTE</span><b>{routeDistance}</b></div></div>
    <div className="section-label">C++ DISPATCH DECISION</div>
    {simulationIncident ? <div className="dispatch-proof"><div><span>DECISION SOURCE</span><b>C++ SimulationEngine</b></div><div><span>RESPONDER</span><b>WAITING FOR COORDINATOR</b></div><div><span>ROUTE COST</span><b>{routeCost}</b></div><div><span>TRAVEL TIME</span><b>{eta}</b></div>{routeNodes.length > 0 && <div className="dispatch-route"><span>PATH</span><b>{routeNodes.join(' → ')}</b></div>}</div> : <div className="dispatch-proof muted"><div><span>ENGINE RESULT</span><b>NO C++ DECISION FOR THIS STATIC INCIDENT</b></div><small>Submit a new emergency to create a C++-authoritative incident and dispatch result.</small></div>}
    <div className="section-label">ROUTING ANALYSIS</div>
    <div className="routing-method"><Route size={13} /><span>DIJKSTRA / MIN HEAP</span><b>{routing ? 'EVALUATING' : 'READY'}</b></div>
    <div className="dispatch-actions">
      <button className="dijkstra-launch" onClick={() => { setRouting(true); onOpenDijkstra(); }}><Route size={13} /> OPEN C++ DIJKSTRA TRACE</button>
    </div>
    <p className="detail-note">Seeded incidents remain available for map context. C++-generated incidents are marked by their returned priority, lifecycle state, responder and route metrics.</p>
  </div>;
}
function FacilityPanel({ facility, node, responders: allResponders }: { facility: Facility; node: Vertex; responders: Responder[] }) {
  const I = iconFor[facility.type]; const staged = allResponders.filter(r => r.locationId === node.id);
  return <div className="detail-content"><div className="location-hero"><div className="location-icon" style={{ color: facilityColors[facility.type] }}><I size={21} /></div><div><strong>{facility.name}</strong><span>{facility.type.toUpperCase()} · {facility.id}</span></div><b className="operational">● OPERATIONAL</b></div><div className="detail-grid"><div><span>NODE</span><b>{node.id}</b></div><div><span>COORDINATES</span><b>{node.x.toFixed(1)} / {node.y.toFixed(1)}</b></div><div><span>CAPACITY / UNITS</span><b>{facility.units ?? '—'}</b></div><div><span>STATUS</span><b className="good">{node.status}</b></div></div><div className="section-label">UNIT READINESS</div>{staged.map(r => <div className="unit-row" key={r.id}><span className={`unit-dot ${r.status.toLowerCase().replace(/\s+/g, '-')}`} /><div><b>{r.id}</b><small>{r.type}</small></div><em>{r.status}</em></div>)}{!staged.length && <div className="empty-state">No responder units currently staged at this facility.</div>}<p className="detail-note">Facility markers map directly to graph vertices. Selecting this location never creates a separate visual-only node.</p></div>;
}

function NodePanel({ node, g, onRoad }: { node: Vertex; g: ReturnType<typeof createCityGraph>; onRoad: (r: Edge) => void }) {
  const I = iconFor[node.type]; return <div className="detail-content"><div className="location-hero"><div className="location-icon"><I size={21} /></div><div><strong>{node.name}</strong><span>{node.type.toUpperCase()} · {node.id}</span></div></div><div className="detail-grid"><div><span>NODE ID</span><b>{node.id}</b></div><div><span>DEGREE</span><b>{g.getDegree(node.id)}</b></div><div><span>COORDINATES</span><b>{node.x.toFixed(1)} / {node.y.toFixed(1)}</b></div><div><span>STATUS</span><b className="good">{node.status}</b></div></div><div className="section-label">CONNECTED ROADS</div><div className="road-list">{g.getIncidentEdges(node.id).map(e => <button key={e.id} onClick={() => onRoad(e)}><span><b>{e.id}</b>{e.from === node.id ? '→' : '←'} {g.getVertex(e.from === node.id ? e.to : e.from)?.name}</span><em className={e.blocked ? 'blocked-text' : ''}>{e.blocked ? 'BLOCKED' : `${e.distance.toFixed(1)} KM`}</em></button>)}</div></div>;
}

function RoadPanel({ edge, g, toggle }: { edge: Edge; g: ReturnType<typeof createCityGraph>; toggle: () => void }) {
  const a = g.getVertex(edge.from)!; const b = g.getVertex(edge.to)!; return <div className="detail-content"><div className="road-title"><div className={`road-state-dot ${edge.blocked ? 'blocked' : ''}`} /><div><strong>{edge.id}</strong><span>{a.name} <b>→</b> {b.name}</span></div></div><div className="detail-grid"><div><span>DISTANCE</span><b>{edge.distance.toFixed(1)} KM</b></div><div><span>TRAVEL TIME</span><b>{edge.travelTime} MIN</b></div><div><span>RISK</span><b>{edge.riskLevel}/10</b></div><div><span>CONGESTION</span><b className={edge.congestionLevel >= 6 ? 'warn' : ''}>{edge.congestionLevel}/10</b></div><div><span>CAPACITY</span><b>{edge.capacity}%</b></div><div><span>STATUS</span><b className={edge.blocked ? 'warn' : 'good'}>{edge.blocked ? 'BLOCKED' : 'OPEN'}</b></div></div><button className={`road-toggle ${edge.blocked ? 'unblock' : ''}`} onClick={toggle}>{edge.blocked ? <><Unlock size={15} /> UNBLOCK ROAD</> : <><LockKeyhole size={15} /> BLOCK ROAD</>}</button><p className="detail-note">Blocked edges remain in the adjacency list. Future Dijkstra can ignore them without mutating graph topology.</p></div>;
}
