export type BridgeStatus = 'CHECKING' | 'ONLINE' | 'OFFLINE' | 'ERROR';

export type SimulationEvent = {
  type: string;
  algorithm: string;
  step: number;
  incidentId: string | null;
  nodeId: string | null;
  edgeId: string | null;
  priority: number;
  value1?: number;
  value2?: number;
  value?: string | null;
  responderId: string | null;
  status: string | null;
  message: string;
};

export type SimulationIncident = {
  incidentId: string;
  type: string;
  locationId: string;
  severity: number;
  urgency: number;
  victimCount: number;
  priorityScore: number;
  status: string;
  requiredResponderType: string;
  assignedResponderId: string;
  reportedSequence: number;
  description?: string;
  shelterId?: string;
  allocatedResourceType?: string;
  allocatedResourceQuantity?: number;
};

export type Route = {
  reachable: boolean;
  totalCost: number;
  totalDistance: number;
  totalTravelTime: number;
  pathNodes: string[];
  pathEdges: string[];
};

export type SimulationResponder = {
  responderId: string;
  type: string;
  locationId: string;
  availability: string;
  status: string;
  assignedIncidentId: string | null;
  capacity: number;
};

export type ActiveDispatch = {
  incidentId: string;
  responderId: string;
  origin: string;
  destination: string;
  status: string;
  reachable: boolean;
  routeCost: number;
  distance: number;
  travelTime: number;
  pathNodes: string[];
  pathEdges: string[];
};

export type SimulationState = {
  ok: boolean;
  bridge: string;
  engine: string;
  roadUndoStack?: { depth: number; canUndo: boolean };
  graph: { vertices: number; roads: number; openRoads: number; blockedRoads: number; blockedEdgeIds: string[] };
  incidents: SimulationIncident[];
  queue: { size: number; incidentIds: string[] };
  priorityHeap: { size: number; incidentIds: string[]; entries: { incidentId: string; priority: number }[] };
  pendingIncidents: Array<{ incidentId: string; stage: 'INTAKE_QUEUE' | 'PRIORITY_HEAP'; position: number; priority: number }>;
  nextDispatch: { incidentId: string; priority: number } | null;
  responders: SimulationResponder[];
  activeDispatches: ActiveDispatch[];
  shelters: Array<{ shelterId: string; locationId: string; capacity: number; occupancy: number; availableCapacity: number; status: string }>;
  resources: Array<{ resourceType: string; quantity: number; source: string }>;
  history: { size: number; entries: string[] };
  hashTable: { size: number };
  analytics: {
    totalIncidents: number;
    activeIncidents: number;
    resolvedIncidents: number;
    unreachableIncidents: number;
    averagePriority: number;
    averageRouteDistance: number;
    averageTravelTime: number;
    dispatchCount: number;
    rerouteCount: number;
    availableResponders: number;
  };
  recentEvents: SimulationEvent[];
  eventHistory?: SimulationEvent[];
};

export type DispatchResult = {
  success: boolean;
  message: string;
  incident: SimulationIncident;
  responder?: { responderId: string; type: string; locationId: string };
  route?: Route;
};

export type SimulationResponse<T = unknown> = {
  ok?: boolean;
  message?: string;
  error?: string;
  state?: SimulationState;
  incident?: SimulationIncident;
  events?: { events?: SimulationEvent[] };
  result?: DispatchResult;
  responder?: { responderId: string; type: string; locationId: string };
  route?: Route;
  [key: string]: unknown;
};
