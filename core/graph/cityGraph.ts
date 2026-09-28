export interface CityNode { id:string; name:string; type:string; x:number; y:number }
export interface CityEdge { id:string; from:string; to:string; distance:number; travelTime:number; risk:number; congestion:number; blocked:boolean; capacity:number }
export interface DSAVisualizationState { nodes:Record<string,'UNVISITED'|'CURRENT'|'EXAMINING'|'RELAXED'|'VISITED'|'FINAL PATH'|'DISCOVERED'>; edges:Record<string,'UNVISITED'|'EXAMINING'|'RELAXED'|'VISITED'|'FINAL PATH'> }
export const emptyDSAState:DSAVisualizationState={nodes:{},edges:{}};
