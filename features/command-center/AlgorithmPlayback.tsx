import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, GripVertical, Maximize2, Minus, Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react';
import { analyzeNetwork } from '../../core/simulation/api';
import type { AnalysisResponse, DispatchRecord, SimulationState } from '../../core/simulation/types';
import { playbackEventText, playbackFrame, restartPlayback, type PlaybackFrame } from './mapPresentation';
import { useFloatingPanelPosition } from './useFloatingPanelPosition';
import './algorithm-playback.css';

export default function AlgorithmPlayback({ state, dispatch, onFrame, onClose }: {
  state: SimulationState; dispatch?: DispatchRecord;
  onFrame: (frame: PlaybackFrame | null) => void; onClose: () => void;
}) {
  const [algorithm,setAlgorithm]=useState<'BFS'|'DFS'|'DIJKSTRA'>('DIJKSTRA');
  const [source,setSource]=useState(dispatch?.origin ?? state.network.nodes[0]?.locationId ?? '');
  const [destination,setDestination]=useState(dispatch?.destination ?? state.network.nodes[state.network.nodes.length-1]?.locationId ?? '');
  const [analysis,setAnalysis]=useState<AnalysisResponse|null>(null);
  const [count,setCount]=useState(0), [playing,setPlaying]=useState(false), [speed,setSpeed]=useState(1);
  const [loading,setLoading]=useState(false), [error,setError]=useState('');
  const [minimized,setMinimized]=useState(false), [showOrder,setShowOrder]=useState(true);
  const floating=useFloatingPanelPosition();
  const request=useRef(0);
  const frame=useMemo(()=>playbackFrame(analysis,count,state.network.graphRevision),[analysis,count,state.network.graphRevision]);
  useEffect(()=>{ onFrame({...frame,playing:playing&&!frame.complete&&!frame.outdated,showOrder}); },[frame,playing,showOrder,onFrame]);
  useEffect(()=>()=>{request.current++;onFrame(null);},[onFrame]);
  useEffect(()=>{
    if(frame.outdated || frame.complete) setPlaying(false);
    if(!playing || frame.outdated || frame.complete) return;
    const timer=window.setInterval(()=>setCount(c=>Math.min(c+1,analysis?.events.length ?? 0)),260/speed);
    return ()=>window.clearInterval(timer);
  },[playing,speed,frame.outdated,frame.complete,analysis]);
  const clear=()=>{request.current++;setAnalysis(null);setCount(0);setPlaying(false);setLoading(false);setError('');};
  const run=async()=>{
    const token=++request.current;
    setLoading(true);setError('');setPlaying(false);setAnalysis(null);setCount(0);
    try {
      const result=await analyzeNetwork(algorithm,source,destination);
      if(token!==request.current)return;
      setAnalysis(result);setPlaying(true);
    } catch(error) { if(token===request.current)setError(error instanceof Error?error.message:'Analysis failed'); }
    finally { if(token===request.current)setLoading(false); }
  };
  const result=analysis?.result;
  const name=(id:string)=>state.network.nodes.find(n=>n.locationId===id)?.name ?? id;
  const status=loading?'Analyzing':frame.outdated?'Outdated':frame.complete?(result?.reachable?'Reachable':'Unreachable'):playing?'Playing':analysis?'Paused':'Ready';
  return <section ref={floating.panelRef} className={`tm-playback tm-floating ${minimized?'minimized':''} ${floating.dragging?'dragging':''} ${floating.docked?'docked':''}`} aria-label="Live algorithm analysis"
    style={floating.position&&!floating.docked?{left:floating.position.x,top:floating.position.y}:undefined}>
    <header className="tm-floating-heading">
      <button className="tm-drag-handle" aria-label={floating.docked?'Live network analysis':'Move analysis controller'} title={floating.docked?'Docked on small screens':'Drag to move · arrow keys to reposition'} {...floating.handleProps}>
        <GripVertical size={18}/><span><small>{minimized?`${algorithm} · Step ${count}/${analysis?.events.length??0}`:'LIVE NETWORK ANALYSIS'}</small>{!minimized&&<strong>{algorithm==='DIJKSTRA'?'Dijkstra':algorithm} <em>{status}</em></strong>}</span>
      </button>
      <button aria-label={minimized?'Restore analysis':'Minimize analysis'} title={minimized?'Restore':'Minimize'} onClick={()=>setMinimized(!minimized)}>{minimized?<Maximize2 size={15}/>:<Minus size={15}/>}</button>
      <button aria-label="Reset controller position" title="Reset position" onClick={floating.reset} disabled={floating.docked}><Crosshair size={15}/></button>
      <button onClick={onClose} aria-label="Close analysis" title="Close analysis"><X size={16}/></button>
    </header>
    <div className="tm-floating-body" hidden={minimized}>
    <div className="tm-analysis-inputs">
      <label>Algorithm<select value={algorithm} onChange={e=>{clear();setAlgorithm(e.target.value as typeof algorithm);}}><option>BFS</option><option>DFS</option><option>DIJKSTRA</option></select></label>
      <label>Source<select value={source} onChange={e=>{clear();setSource(e.target.value);}}>{state.network.nodes.map(n=><option value={n.locationId} key={n.locationId}>{n.name}</option>)}</select></label>
      <label>Destination<select value={destination} onChange={e=>{clear();setDestination(e.target.value);}}>{state.network.nodes.map(n=><option value={n.locationId} key={n.locationId}>{n.name}</option>)}</select></label>
      <button className="tm-primary" disabled={loading||!source||!destination} onClick={run}>{loading?'Analyzing…':'Run analysis'}</button>
    </div>
    <p className="tm-muted">{algorithm==='BFS'?'Unweighted minimum hops · manual queue':algorithm==='DFS'?'Reachability and backtracking · not a shortest path':'Lowest weighted operational cost · C++ Dijkstra'}</p>
    {dispatch && <button className="tm-text-button" onClick={()=>{clear();setSource(dispatch.origin);setDestination(dispatch.destination);}}>Use selected dispatch endpoints</button>}
    {error && <p role="alert" className="tm-warning">{error}</p>}
    {frame.outdated && <p role="status" className="tm-warning"><b>OUTDATED ANALYSIS</b> · Network changed. Run analysis again.</p>}
    {analysis && <><div className="tm-playback-controls">
      <button aria-label={playing?'Pause playback':'Play playback'} title={playing?'Pause playback':'Play playback'} disabled={frame.outdated||frame.complete} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button>
      <button aria-label="Step forward" title="Step forward" disabled={frame.outdated||frame.complete} onClick={()=>{setPlaying(false);setCount(c=>Math.min(c+1,analysis.events.length));}}><SkipForward size={16}/></button>
      <button aria-label="Restart playback" title="Restart playback" disabled={frame.outdated} onClick={()=>{setCount(restartPlayback());setPlaying(false);}}><RotateCcw size={16}/></button>
      <label>Speed<select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
      <span>{count} / {analysis.events.length}</span>
    </div><progress aria-label="Analysis progress" max={analysis.events.length || 1} value={count}/>
    <div className={`tm-event-ticker ${frame.backtrack?'backtracking':''}`}><small>Step {count} / {analysis.events.length} · {frame.backtrack?'Backtracking':status}</small><div>{playbackEventText(frame,name)}</div><span>Current node: {frame.current?name(frame.current):'—'}</span></div>
    <span className="tm-sr-only" role="status">{status}</span>
    <div className="tm-inline-facts"><span>Visited <b>{frame.visited.size}</b></span><span>Revision <b>{result?.graphRevision}</b></span>
      {frame.event?.queueSize!==undefined && algorithm==='BFS' && <span>Queue <b>{frame.event.queueSize}</b></span>}
      {frame.event?.stackSize!==undefined && algorithm==='DFS' && <span>Stack <b>{frame.event.stackSize}</b></span>}
      {algorithm==='DFS'&&<span>Backtracks <b>{frame.backtrackCount}</b></span>}
      {algorithm==='BFS'&&frame.levels.has(frame.current)&&<span>Hop level <b>{frame.levels.get(frame.current)}</b></span>}
      {result?.algorithm==='DIJKSTRA'&&result.reachable&&<span>Route <b>{result.distance.toFixed(2)} km</b></span>}
    </div>
    {frame.complete && !frame.outdated && result && <div className="tm-analysis-result">
      <strong>{result.reachable?'Authoritative route result':'Destination unreachable'}</strong>
      <small className="tm-result-route">{name(result.source)} → {name(result.destination)}</small>
      {result.algorithm==='BFS' && <span>Minimum hops <b>{result.minimumHops ?? 'Unreachable'}</b></span>}
      {result.algorithm==='DIJKSTRA' && result.reachable && <><span>Selected route distance <b>{result.distance.toFixed(2)} km</b></span><span>Travel time <b>{result.estimatedTravelTime.toFixed(1)} min</b></span><span>Weighted cost <b>{result.weightedCost.toFixed(2)}</b></span><span>Risk sum <b>{result.risk}</b></span><span>Congestion average <b>{result.congestion.toFixed(2)}</b></span><span>Roads used <b>{result.pathEdges.length}</b></span><small className="tm-result-note">Dijkstra optimizes weighted operational cost. Physical distance is reported for the selected authoritative route.</small></>}
    </div>}</>}
    <footer className="tm-analysis-key"><label><input type="checkbox" checked={showOrder} onChange={e=>setShowOrder(e.target.checked)}/> Visit order</label><span className="frontier">{algorithm==='DIJKSTRA'?'Tentative':'Frontier'}</span><span className="visited">{algorithm==='DIJKSTRA'?'Settled':'Visited'}</span><span className="destination">Destination</span>{algorithm==='DFS'&&<span className="backtrack">Backtrack</span>}</footer>
    </div>
  </section>;
}
