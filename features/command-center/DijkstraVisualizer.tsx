import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Pause, Play, RotateCcw, SkipForward, Zap } from 'lucide-react';

export type DijkstraTraceEvent = {
  type: string;
  nodeId: string | null;
  edgeId: string | null;
  fromNodeId: string | null;
  toNodeId: string | null;
  currentDistance: number | null;
  oldDistance: number | null;
  candidateDistance: number | null;
  edgeCost: number | null;
  queueSize: number;
  visitedCount: number;
  message: string;
};

export type DijkstraTrace = {
  sourceNodeId: string;
  destinationNodeId: string;
  reachable: boolean;
  sourceEqualsDestination: boolean;
  totalCost: number;
  totalDistance: number;
  totalTravelTime: number;
  nodesExplored: number;
  pathNodes: string[];
  pathEdges: string[];
  events: DijkstraTraceEvent[];
  pathMetrics: { roads: number; distanceKm: number; travelTimeMin: number };
};

export type DijkstraFrame = {
  event: DijkstraTraceEvent | null;
  eventIndex: number;
  currentNodeId: string | null;
  visited: Set<string>;
  discovered: Set<string>;
  relaxedEdges: Set<string>;
  examinedEdgeId: string | null;
  finalNodes: Set<string>;
  finalEdges: Set<string>;
  complete: boolean;
  unreachable: boolean;
  queueSize: number;
  visitedCount: number;
};

type Props = {
  onFrame: (frame: DijkstraFrame) => void;
  onClose: () => void;
  sourceLabel: string;
  destinationLabel: string;
  sourceNodeId: string;
  destinationNodeId: string;
};

const speeds = { Slow: 900, Normal: 350, Fast: 120 } as const;

export default function DijkstraVisualizer({ onFrame, onClose, sourceLabel, destinationLabel, sourceNodeId, destinationNodeId }: Props) {
  const [trace, setTrace] = useState<DijkstraTrace | null>(null);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof speeds>('Normal');
  const [loadError, setLoadError] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/data/dijkstra-events-${sourceNodeId}-${destinationNodeId}.json`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DijkstraTrace>;
      })
      .then(data => {
        if (!alive) return;
        setTrace(data);
        setIndex(-1);
        setLoadError('');
      })
      .catch(() => alive && setLoadError('Pre-generated C++ Dijkstra trace is unavailable for this source/destination pair.'));
    return () => { alive = false; };
  }, [sourceNodeId, destinationNodeId]);

  const frame = useMemo<DijkstraFrame>(() => {
    const events = trace?.events ?? [];
    const safeIndex = Math.max(-1, Math.min(index, events.length - 1));
    const visited = new Set<string>();
    const discovered = new Set<string>();
    const relaxedEdges = new Set<string>();
    const finalNodes = new Set<string>();
    const finalEdges = new Set<string>();
    let currentNodeId: string | null = null;
    let examinedEdgeId: string | null = null;
    let complete = false;
    let unreachable = false;
    let queueSize = 0;
    let visitedCount = 0;

    if (trace) discovered.add(trace.sourceNodeId);
    for (let i = 0; i <= safeIndex; i += 1) {
      const e = events[i];
      queueSize = e.queueSize;
      visitedCount = e.visitedCount;
      if (e.nodeId && ['NODE_EXTRACTED', 'EDGE_EXAMINED', 'DISTANCE_CHECKED', 'EDGE_RELAXED', 'DISTANCE_UPDATED', 'PREDECESSOR_UPDATED'].includes(e.type)) {
        currentNodeId = e.nodeId;
      }
      if (e.type === 'NODE_VISITED' && e.nodeId) visited.add(e.nodeId);
      if (e.type === 'EDGE_RELAXED' && e.nodeId) discovered.add(e.nodeId);
      if (e.type === 'EDGE_RELAXED' && e.edgeId) relaxedEdges.add(e.edgeId);
      if (e.type === 'EDGE_EXAMINED') examinedEdgeId = e.edgeId;
      if (e.type === 'PATH_EDGE_SELECTED' && e.edgeId) finalEdges.add(e.edgeId);
      if (e.type === 'PATH_EDGE_SELECTED' && e.nodeId) finalNodes.add(e.nodeId);
      if (e.type === 'DESTINATION_REACHED' && e.nodeId) finalNodes.add(e.nodeId);
      if (e.type === 'COMPLETE') complete = true;
      if (e.type === 'UNREACHABLE') unreachable = true;
    }
    if (trace?.sourceNodeId) finalNodes.add(trace.sourceNodeId);
    return {
      event: safeIndex >= 0 ? events[safeIndex] : null,
      eventIndex: safeIndex,
      currentNodeId,
      visited,
      discovered,
      relaxedEdges,
      examinedEdgeId,
      finalNodes,
      finalEdges,
      complete,
      unreachable,
      queueSize,
      visitedCount
    };
  }, [trace, index]);

  useEffect(() => { onFrame(frame); }, [frame, onFrame]);

  useEffect(() => {
    if (!playing || !trace) return;
    if (index >= trace.events.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setIndex((i: number) => Math.min(i + 1, trace.events.length - 1)), speeds[speed]);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [playing, index, speed, trace]);

  const reset = () => {
    setPlaying(false);
    setIndex(-1);
  };

  const step = () => {
    if (!trace) return;
    setIndex((i: number) => Math.min(i + 1, trace.events.length - 1));
  };

  const event = frame.event;
  const progress = trace ? Math.max(0, ((index + 1) / trace.events.length) * 100) : 0;
  const finalReady = Boolean(trace?.reachable && frame.complete);
  const candidate = event?.candidateDistance;
  const old = event?.oldDistance;

  return (
    <div className="dijkstra-panel" role="dialog" aria-label="Dijkstra execution visualizer">
      <div className="dijkstra-head">
        <div>
          <span className="eyebrow">C++ DSA / PRE-GENERATED TRACE</span>
          <h3><Zap size={15} /> DIJKSTRA EXECUTION</h3>
          <small>{sourceLabel} → {destinationLabel}</small>
        </div>
        <button onClick={onClose} aria-label="Close Dijkstra visualizer">×</button>
      </div>

      {loadError ? <div className="dijkstra-error">{loadError}</div> : (
        <>
          <div className="dijkstra-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="dijkstra-controls">
            <button onClick={() => setPlaying((v: boolean) => !v)} disabled={!trace}>{playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'PAUSE' : 'RUN'}</button>
            <button onClick={step} disabled={!trace || index >= (trace?.events.length ?? 0) - 1}><SkipForward size={13} /> STEP</button>
            <button onClick={reset}><RotateCcw size={13} /> RESET</button>
            <select value={speed} onChange={(e) => setSpeed(e.target.value as keyof typeof speeds)} aria-label="Dijkstra animation speed">
              <option>Slow</option><option>Normal</option><option>Fast</option>
            </select>
          </div>

          <div className="dijkstra-context">
            <div><span>EVENT</span><b>{event?.type ?? 'READY'}</b></div>
            <div><span>CURRENT NODE</span><b>{frame.currentNodeId ?? '—'}</b></div>
            <div><span>QUEUE</span><b>{frame.queueSize}</b></div>
            <div><span>VISITED</span><b>{frame.visitedCount} / 24</b></div>
          </div>

          {event && (event.type === 'EDGE_EXAMINED' || event.type === 'DISTANCE_CHECKED' || event.type === 'EDGE_RELAXED') && (
            <div className={`relax-card ${event.type === 'EDGE_RELAXED' ? 'positive' : ''}`}>
              <div><span>CHECKING ROAD</span><b>{event.edgeId ?? '—'}</b></div>
              <div><span>CURRENT</span><b>{old == null ? '∞' : old.toFixed(2)}</b></div>
              <div><span>CANDIDATE</span><b>{candidate == null ? '—' : candidate.toFixed(2)}</b></div>
              <strong>{event.type === 'EDGE_RELAXED' ? '✓ RELAXED — DISTANCE IMPROVED' : candidate != null && old != null && candidate < old ? 'IMPROVEMENT AVAILABLE' : 'NOT IMPROVED'}</strong>
            </div>
          )}

          <div className="dijkstra-analysis">
            <div className="analysis-title"><Activity size={13} /> ALGORITHM DETAILS</div>
            <div className="analysis-grid">
              <span>Graph <b>Adjacency List</b></span>
              <span>Frontier <b>Manual Min Heap</b></span>
              <span>Complexity <b>O((V + E) log V)</b></span>
              <span>Path <b>{finalReady ? 'OPTIMAL' : frame.unreachable ? 'UNREACHABLE' : 'SEARCHING'}</b></span>
            </div>
          </div>

          <div className="dijkstra-queue">
            <div className="analysis-title">PRIORITY QUEUE STATE <small>event snapshot</small></div>
            <div className="queue-bar"><span>MIN-HEAP</span><b>{frame.queueSize} ITEMS</b></div>
          </div>

          {finalReady && trace && (
            <div className="dijkstra-result">
              <div className="result-status">DIJKSTRA COMPLETE <b>OPTIMAL</b></div>
              <div className="result-grid">
                <div><span>DISTANCE</span><b>{trace.totalDistance.toFixed(2)} KM</b></div>
                <div><span>TRAVEL TIME</span><b>{String(Math.floor(trace.totalTravelTime)).padStart(2, '0')} MIN</b></div>
                <div><span>ROADS</span><b>{trace.pathMetrics.roads}</b></div>
                <div><span>NODES EXPLORED</span><b>{trace.nodesExplored}</b></div>
              </div>
              <div className="result-path">{trace.pathNodes.map((node, i) => <span key={node}>{node}{i < trace.pathNodes.length - 1 && <i>→</i>}</span>)}</div>
            </div>
          )}

          {event && <div className="dijkstra-event"><span>{String(index + 1).padStart(3, '0')}</span><p>{event.message}</p><b>{event.type}</b></div>}
        </>
      )}
    </div>
  );
}
