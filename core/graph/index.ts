export * from './Graph';
export * from './cityData';
export * from './facilities';
export * from './incidents';
export * from './responders';
export * from './cityGraph';
import { Graph } from './Graph';
import { cityVertices, cityEdges } from './cityData';
export function createCityGraph(){ const g=new Graph(); cityVertices.forEach(v=>g.addVertex(v)); cityEdges.forEach(e=>g.addEdge(e)); return g; }
