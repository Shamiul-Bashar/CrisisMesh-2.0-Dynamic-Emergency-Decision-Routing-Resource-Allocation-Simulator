# CrisisMesh 2.0

CrisisMesh 2.0 is a deterministic emergency decision, routing, and resource-allocation simulator built for university DSA evaluation. A C++17 `SimulationEngine` owns operational decisions, while a React and TypeScript interface provides the Emergency Operations Center, tactical map, citizen portal, and algorithm playback.

This is an academic simulator. It does not connect to real emergency services, GPS, municipal systems, or production identity infrastructure.

## Problem Statement

Emergency coordination must prioritize competing incidents, find compatible responders, route around unavailable roads, preserve a clear incident lifecycle, and explain why each decision was made. CrisisMesh models those responsibilities on a fictional city network while exposing the manually implemented data structures and algorithms that support them.

## Core Workflow

```text
Citizen report
  → FIFO intake Queue
  → deterministic priority triage
  → Max Heap scheduling
  → compatible responder evaluation
  → Merge Sort candidate ordering
  → weighted Dijkstra routing
  → dispatch and tactical visualization
  → response completion
  → citizen YES / NO confirmation
  → closed archive or escalated/requeued incident
```

## Key Features

- Author Emergency Operations Center backed by live C++ state
- Citizen reporting, response tracking, messages, history, and profile
- A 24-node, 42-road fictional city graph
- Compatible responder ranking with auditable route metrics
- Road blocking, rerouting, unreachable-route handling, and Stack-based undo
- BFS, DFS, and Dijkstra analysis on the current graph revision
- Multi-incident tactical routes and deterministic responder allocation
- Incident ownership checks for confirmation and escalation
- Compact DSA Architecture view and optional C++ Implementation Inspector
- Automated frontend, bridge, integration, and native C++ tests

## DSA Used

| DSA | C++ module | Real CrisisMesh use | Main complexity |
|---|---|---|---|
| Array | `OperationalArray<T, Capacity>` | Bounded responder candidate buffer | access/append O(1) |
| Linked List | `LinkedList` | Chronological resolved-incident history | append O(1), traversal O(n) |
| Stack | `Stack<T>` | Road-block undo and DFS traversal | push/pop O(1) amortized |
| Queue | `Queue<T>` | FIFO incident intake and BFS frontier | enqueue/dequeue O(1) amortized |
| AVL Tree | `IncidentArchiveIndex` | Balanced index of closed incidents | insert/search O(log n) |
| Binary Search | `LocationDirectory` | Validating locations in a sorted directory | O(log n) |
| Merge Sort | `CandidateMergeSort` | Deterministic responder candidate ranking | O(n log n), O(n) space |
| Max Heap | `MaxHeap` | Selecting the highest-priority waiting incident | insert/extract O(log n) |
| Min Heap | `MinHeap` | Dijkstra's lowest-cost frontier | push/pop O(log n) |
| Hash Table | `HashTable` | Incident ID lookup | average O(1), worst O(n) |
| Graph | `Graph` | City road network and blocked-road state | neighbor scan O(degree) |
| BFS | `BFS` | Minimum-hop analysis on open roads | O(V + E) |
| DFS | `DFS` | Reachability traversal with backtracking | O(V + E) |
| Dijkstra | `Dijkstra` | Lowest weighted operational route | O((V + E) log V) |

Exact implementation and test evidence is documented in [`docs/DSA_REQUIREMENTS_MAPPING.md`](docs/DSA_REQUIREMENTS_MAPPING.md).

## Architecture

```text
React / TypeScript
        ↓ POST /api/simulation
Vite development bridge
        ↓ persistent line protocol
C++17 SimulationEngine
        ↓
Manual DSA, authoritative state, events, and analysis results
```

The C++ engine is authoritative for incident creation, triage, priority, scheduling, responder compatibility, candidate ranking, routing, road state, rerouting, lifecycle transitions, allocation, and incident history. React sends commands and renders returned state. It does not choose responders, calculate priority, or calculate routes.

The Vite bridge validates browser requests, forwards them to `crisismesh_simulation_cli --server`, and returns the C++ JSON response envelope. It is development infrastructure rather than a deployed backend.

## Routing Model

Each road contains distance, travel time, risk, congestion, capacity, and blocked state. Dijkstra minimizes the non-negative weighted cost:

```text
distance
+ 0.35 × travel time
+ 0.75 × risk
+ 0.45 × congestion
+ 0.03 × max(0, 70 - capacity)
```

Blocked roads are excluded. Candidate responders are evaluated with the current graph, then ranked by reachability, weighted cost, travel time, distance, and responder ID. A road change on an active route triggers authoritative rerouting and advances the graph revision.

## Incident Lifecycle

```text
QUEUED
  → TRIAGED
  → PRIORITY_CALCULATED
  → ASSIGNED / EN_ROUTE
  → RESPONSE_COMPLETED
  → AWAITING_USER_CONFIRMATION
     ├─ YES → RESOLVED → CLOSED
     └─ NO + reason → ESCALATED → QUEUED
```

Road changes can temporarily produce `REROUTE_REQUIRED` or `UNREACHABLE`. Closed incidents leave active operations and enter the archive/history structures.

## Tactical Map

The SVG tactical map renders the authoritative network, facilities, responders, incidents, active dispatches, and candidate routes. It supports multiple simultaneous routes, congestion and risk layers, blocked-road controls, BFS/DFS/Dijkstra live analysis, and route inspection.

Every saved dispatch and analysis result carries a graph revision. Playback is invalidated when its revision no longer matches current topology, preventing stale paths from appearing current. Simulated responder movement is presentation-only and never mutates C++ state.

## Author Features

- Prioritized incident queue and explicit `Process next` control
- Selected responder, candidate comparison, route metrics, and incident timeline
- Tactical road blocking, reopening, rerouting, and Stack undo
- BFS, DFS, and Dijkstra analysis against the live graph
- Responder availability and resource overview
- Registered-user directory without credential fields
- Direct citizen messages and broadcast announcements
- DSA Architecture view and optional Implementation Inspector

## Citizen Features

- Registration, login, local session identity, and password recovery flows
- Emergency reporting tied to the authenticated citizen ID
- Owner-filtered active incidents and closed history
- Citizen-friendly lifecycle and responder information
- YES resolution confirmation and NO escalation with a required reason
- Direct and broadcast messages with recipient privacy
- Safe profile fields without password, hash, OTP, or environment values

## Build / Run Instructions

### Requirements

- Windows 10 or 11
- Node.js 22.12 or newer
- npm 10 or newer
- CMake 3.16 or newer
- A C++17 compiler supported by CMake
- Ninja or Visual Studio Build Tools

### 1. Install frontend dependencies

From the repository root in PowerShell:

```powershell
npm install
```

The committed `package-lock.json` records the verified dependency graph.

### 2. Configure and build the C++ engine

```powershell
cmake -S backend -B backend/build
cmake --build backend/build
```

### 3. Start CrisisMesh

```powershell
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`. Vite starts the persistent C++ bridge process when the browser first requests simulation state.

### 4. Create a production frontend bundle

```powershell
npm run build
```

The production bundle validates the frontend but does not replace the development bridge with a deployed server.

## Testing

Run from the repository root:

```powershell
npm run test:phase1
node --test tests/phase3-bridge.test.mjs
node --test tests/phase4-map.test.ts
node --test tests/phase6-citizen.test.ts tests/phase6-citizen-bridge.test.mjs
npm run typecheck
npm run build
cmake --build backend/build
ctest --test-dir backend/build --output-on-failure
```

Latest verified matrix:

- Phase 1 authentication and bridge: 6 tests
- Phase 3 HTTP bridge: 1 test
- Phase 4 map presentation: 18 tests
- Phase 6 citizen ownership and lifecycle: 7 tests
- Native CTest: 23 tests
- TypeScript typecheck and production build: passing

## Project Limitations

- The development bridge and C++ simulation state are in-memory.
- Incidents, dispatches, road changes, and analysis state reset when the engine process restarts.
- Demo user, session, and message persistence uses browser `localStorage`.
- The city is fictional and has no real GPS, Mapbox, Google Maps, or municipal feed.
- Responder route movement is simulated presentation and does not represent live vehicles.
- The Vite bridge is local development infrastructure, not a production service.
- Authentication is suitable for an academic demonstration, not production identity security.

## Team / Academic Purpose

CrisisMesh 2.0 was built as a university project to demonstrate how manual data structures and algorithms can support a coherent emergency coordination workflow. The interface keeps those implementation choices visible for evaluation while the C++ engine remains the single source of operational truth.
