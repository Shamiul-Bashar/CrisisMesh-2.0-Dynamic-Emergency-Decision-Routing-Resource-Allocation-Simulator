export type BridgeStatus =
  | 'CHECKING'
  | 'ONLINE'
  | 'OFFLINE'
  | 'ERROR';


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


/* =========================================================
   INCIDENT
   ========================================================= */

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


  /*
   * User who originally reported the emergency.
   *
   * null/undefined is allowed for old/demo incidents.
   */
  reportedByUserId?: string | null;


  /*
   * Becomes true only after the reporting user
   * confirms that the problem was solved.
   */
  userConfirmedResolved?: boolean;


  /*
   * Filled when user says:
   * "No, I still need help."
   */
  escalationReason?: string | null;
};


/* =========================================================
   ROUTING
   ========================================================= */

export type Route = {
  reachable: boolean;

  totalCost: number;
  totalDistance: number;
  totalTravelTime: number;

  nodesExplored?: number;

  pathNodes: string[];
  pathEdges: string[];
};


/* =========================================================
   RESPONDER
   ========================================================= */

export type SimulationResponder = {
  baseFacilityId?: string;
  responderId: string;

  type: string;

  locationId: string;

  availability: string;
  status: string;

  assignedIncidentId: string | null;

  capacity: number;
};


/* =========================================================
   ACTIVE DISPATCH
   ========================================================= */

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


/* =========================================================
   SIMULATION STATE
   ========================================================= */

export type SimulationState = {
  network: AuthoritativeNetwork;
  facilities: Facility[];
  dispatches: DispatchRecord[];
  ok: boolean;

  bridge: string;
  engine: string;


  roadUndoStack?: {
    depth: number;
    canUndo: boolean;
  };


  graph: {
    vertices: number;
    roads: number;

    openRoads: number;
    blockedRoads: number;

    blockedEdgeIds: string[];
  };


  incidents: SimulationIncident[];


  queue: {
    size: number;
    incidentIds: string[];
  };


  priorityHeap: {
    size: number;

    incidentIds: string[];

    entries: {
      incidentId: string;
      priority: number;
    }[];
  };


  pendingIncidents: Array<{
    incidentId: string;

    stage:
      | 'INTAKE_QUEUE'
      | 'PRIORITY_HEAP';

    position: number;

    priority: number;
  }>;


  nextDispatch: {
    incidentId: string;
    priority: number;
  } | null;


  responders: SimulationResponder[];


  activeDispatches: ActiveDispatch[];


  shelters: Array<{
    shelterId: string;
    locationId: string;

    capacity: number;
    occupancy: number;

    availableCapacity: number;

    status: string;
  }>;


  resources: Array<{
    resourceType: string;
    quantity: number;
    source: string;
  }>;


  history: {
    size: number;
    entries: string[];
  };


  hashTable: {
    size: number;
  };


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


/* =========================================================
   DISPATCH RESULT
   ========================================================= */

export type DispatchResult = {
  success: boolean;

  message: string;

  incident: SimulationIncident;


  responder?: {
    responderId: string;
    type: string;
    locationId: string;
  };


  route?: Route;
};


/* =========================================================
   GENERIC SIMULATION RESPONSE
   ========================================================= */

export type ReportResult = {
  incident: SimulationIncident;
};

export type SimulationResponse<T = unknown> = {
  ok: boolean;

  message?: string;
  error?: string;

  state: SimulationState | null;

  events: SimulationEvent[];

  result: T | null;


  [key: string]: unknown;
};

export type Facility = {
  facilityId: string; category: string; name: string; locationId: string;
};
export type AuthoritativeNetwork = {
  graphRevision: number;
  nodes: Array<{ locationId: string; name: string; zone: string; category: string; x: number; y: number; status: string }>;
  roads: Array<{ roadId: string; from: string; to: string; distance: number; travelTime: number;
    risk: number; congestion: number; capacity: number; blocked: boolean;
    roadClass: 'ARTERIAL' | 'PRIMARY' | 'SECONDARY' | 'LOCAL' }>;
};
export type RouteMetrics = {
  reachable: boolean; distance: number; estimatedTravelTime: number; weightedCost: number;
  /** Sum of edge risk levels. */
  risk: number;
  /** Arithmetic mean of edge congestion levels; zero for an empty route. */
  congestion: number;
  pathNodes: string[]; pathEdges: string[];
};
export type CandidateSummary = RouteMetrics & {
  responderId: string; responderType: string; startLocationId: string; destinationLocationId: string; graphRevision: number;
};
export type DispatchRecord = ActiveDispatch & RouteMetrics & {
  graphRevision: number; dispatchSequence: number; stale: boolean;
  selectionReason: 'LOWEST_WEIGHTED_COST' | 'ONLY_REACHABLE_UNIT' | 'LOWER_TRAVEL_TIME_TIEBREAK' |
    'LOWER_DISTANCE_TIEBREAK' | 'RESPONDER_ID_TIEBREAK' | 'ASSIGNED_RESPONDER_REROUTE';
  candidateSummaries: CandidateSummary[];
};
export type AnalysisEvent = {
  type: string; algorithm: string; step: number; graphRevision: number;
  nodeId: string; edgeId: string; message: string;
  parentNodeId?: string; queueSize?: number; stackSize?: number;
};
type AnalysisBase = { source: string; destination: string; graphRevision: number; reachable: boolean; pathNodes: string[]; pathEdges: string[] };
export type LiveAnalysis = (AnalysisBase & { algorithm: 'BFS'; minimumHops: number | null; visitOrder: string[] }) |
  (AnalysisBase & { algorithm: 'DFS'; visitOrder: string[] }) |
  (AnalysisBase & RouteMetrics & { algorithm: 'DIJKSTRA' });
export type AnalysisResponse = { ok: boolean; state: SimulationState | null; result: LiveAnalysis | null; events: AnalysisEvent[]; error?: string };
