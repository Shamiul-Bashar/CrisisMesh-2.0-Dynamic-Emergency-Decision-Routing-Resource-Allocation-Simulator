import { Graph, type LocationType } from '../graph/Graph';
import type { AuthoritativeNetwork } from './types';

const categories: Record<string, LocationType> = {
  HOSPITAL: 'hospital', FIRE_STATION: 'fire', POLICE_STATION: 'police',
  SCHOOL: 'school', COMMERCIAL: 'market', SHELTER: 'shelter', RESIDENTIAL: 'residential',
  CIVIC: 'civic', TRANSPORT: 'transport', INDUSTRIAL: 'industrial', INTERSECTION: 'intersection',
};

/** Presentation conversion only: all topology, costs and block states come from C++. */
export function graphFromNetwork(network: AuthoritativeNetwork): Graph {
  const graph = new Graph();
  for (const node of network.nodes) graph.addVertex({
    id: node.locationId, name: node.name, type: categories[node.category] ?? 'intersection',
    x: node.x, y: node.y,
    status: node.status === 'OFFLINE' ? 'OFFLINE' : node.status === 'LIMITED' ? 'LIMITED' : 'OPERATIONAL',
  });
  for (const road of network.roads) graph.addEdge({
    id: road.roadId, from: road.from, to: road.to, distance: road.distance,
    travelTime: road.travelTime, riskLevel: road.risk, congestionLevel: road.congestion,
    capacity: road.capacity, blocked: road.blocked,
  });
  return graph;
}
