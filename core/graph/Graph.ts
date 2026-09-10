export type LocationType='hospital'|'fire'|'police'|'school'|'market'|'shelter'|'residential'|'intersection'|'civic'|'transport'|'industrial';
export interface Vertex{id:string;name:string;type:LocationType;x:number;y:number;status:'OPERATIONAL'|'LIMITED'|'OFFLINE'}
export interface Edge{id:string;from:string;to:string;distance:number;travelTime:number;riskLevel:number;congestionLevel:number;capacity:number;blocked:boolean}
export class Graph{
 private vertices=new Map<string,Vertex>(); private edges=new Map<string,Edge>(); private adjacency=new Map<string,Edge[]>();
 addVertex(v:Vertex){this.vertices.set(v.id,v);this.adjacency.set(v.id,[])}
 addEdge(e:Edge){if(!this.vertices.has(e.from)||!this.vertices.has(e.to))throw Error(`Unknown endpoint ${e.id}`);this.edges.set(e.id,e);this.adjacency.get(e.from)!.push(e);this.adjacency.get(e.to)!.push(e)}
 removeEdge(id:string){const e=this.edges.get(id);if(!e)return false;this.edges.delete(id);for(const id2 of [e.from,e.to])this.adjacency.get(id2)!.splice(this.adjacency.get(id2)!.findIndex(x=>x.id===id),1);return true}
 getVertex(id:string){return this.vertices.get(id)} getEdge(id:string){return this.edges.get(id)} getVertices(){return [...this.vertices.values()]} getEdges(){return [...this.edges.values()]}
 getNeighbors(id:string){return(this.adjacency.get(id)||[]).map(e=>this.vertices.get(e.from===id?e.to:e.from)!)} getIncidentEdges(id:string){return[...(this.adjacency.get(id)||[])]}
 blockEdge(id:string){const e=this.edges.get(id);if(e)e.blocked=true} unblockEdge(id:string){const e=this.edges.get(id);if(e)e.blocked=false} toggleBlock(id:string){const e=this.edges.get(id);if(e)e.blocked=!e.blocked}
 getVertexCount(){return this.vertices.size} getEdgeCount(){return this.edges.size} getOpenEdgeCount(){return this.getEdges().filter(e=>!e.blocked).length} getBlockedEdgeCount(){return this.getEdges().filter(e=>e.blocked).length} getDegree(id:string){return(this.adjacency.get(id)||[]).length}
 getConnectedComponents(){const seen=new Set<string>();let count=0;for(const v of this.vertices.values()){if(seen.has(v.id))continue;count++;const q=[v.id];seen.add(v.id);while(q.length){const id=q.shift()!;for(const e of this.adjacency.get(id)||[]){if(e.blocked)continue;const n=e.from===id?e.to:e.from;if(!seen.has(n)){seen.add(n);q.push(n)}}}}return count}
}
