# CrisisMesh 2.0

**Dynamic Emergency Decision, Routing & Resource-Allocation Simulator**

CrisisMesh is a DSA-centered emergency-response simulation platform designed to model how limited responders, shelters, supplies, and road networks can be coordinated during a changing disaster scenario.

The project combines a **C++17 simulation/algorithm core** with a **React + TypeScript operational visualization layer**, connected through an API boundary. It is a deterministic, DSA-driven Emergency Operations Center simulator where incident reports, responder assignment, routing, and road changes are modeled in a controlled academic environment.

It is **not** a real emergency service, GPS system, AI/ML predictor, government integration, production dispatch platform, or production identity system.

## Architecture

```text
React / TypeScript
        ↓
Vite Development Bridge (/api/simulation)
        ↓
crisismesh_simulation_cli --server
        ↓
C++17 SimulationEngine
        ↓
Manual DSA + deterministic decision logic
        ↓
JSON STATE / event history / traces
        ↓
React Command Center + SVG map + DSA Lab
```

**Authority rule:** C++ is authoritative for incident creation, priority, queueing, Max Heap scheduling, responder eligibility/ranking, Dijkstra routing, road blocking/rerouting, allocation, lifecycle, resolution, and history. React is a presentation/controller layer and does not run a competing operational algorithm.

## Core capabilities

- Dynamic emergency prioritization
- Graph-based road-network modelling
- Shortest-path routing with Dijkstra
- BFS / DFS graph traversal
- Road blocking and rerouting
- Responder dispatch and coordination
- Shelter allocation
- Supply allocation
- Event-driven deterministic simulation
- Algorithm execution tracing
- React-based operational visualization
- Automated backend tests with CTest

## Data Structures & Algorithms

| Component | Role |
|---|---|
| Graph / adjacency lists | Disaster road network |
| Binary Min Heap | Dijkstra and simulation event scheduling |
| Binary Max Heap | Emergency prioritization |
| Queue | FIFO processing |
| Stack | LIFO processing / traversal support |
| Linked List | Dynamic sequential storage |
| AVL Tree | Balanced ordered data |
| Hash Table | Fast indexed lookup |
| BFS / DFS | Network traversal |
| Dijkstra | Emergency routing |
| Merge Sort | Ordered data processing |
| Binary Search | Fast lookup |
| AlgorithmTrace | Explainable algorithm execution |

## Repository structure

```text
CrisisMesh/
├── backend/
│   ├── include/
│   ├── src/
│   ├── tests/
│   └── CMakeLists.txt
├── core/
│   ├── graph/
│   └── simulation/
├── features/
│   ├── command-center/
│   └── emergency/
├── public/
│   └── data/
├── src/
├── components/
├── index.html
├── package.json
├── vite.config.ts
├── .gitignore
├── README.md
└── style.css
```

## Operational workflow

```text
REPORT
  ↓
Incident created by C++
  ↓
Manual FIFO Queue
  ↓
PROCESS NEXT INCIDENT
  ↓
Triage + priority calculation
  ↓
Manual Max Heap extraction
  ↓
Compatible responder evaluation
  ↓
Graph + Manual Min Heap + Dijkstra
  ↓
ASSIGNED / EN_ROUTE
  ↓
BLOCK → REROUTE_REQUIRED → Dijkstra reroute
  ↓
RESOLVED → CLOSED
  ↓
Manual Linked List history
```

`REPORT` intentionally does **not** automatically dispatch. This preserves the educational Queue → Max Heap → PROCESS NEXT demonstration.

## Decision explanation

The Command Center exposes the reasoning emitted by the C++ engine:

- **Why this incident?** Priority score plus severity, urgency, victim and incident-type contribution.
- **Why this responder?** Candidate responder route costs and reachability emitted by the C++ allocation/route evaluation.
- **Why this route?** C++ Dijkstra returns route cost, distance, travel time, path nodes and path edges.

React displays these returned decisions; it does not recompute them.

## Getting started

### Requirements

- Node.js 22+
- npm
- C++17 compiler
- CMake 3.16+
- Git

### Frontend

```bash
npm install
npm run dev -- --host 0.0.0.0
```

### Backend

```bash
cmake -S backend -B backend/build
cmake --build backend/build -j2
ctest --test-dir backend/build --output-on-failure
```

## User workflow

```text
Home
 ↓
User Registration / Login
 ↓
Demo Verification Code
 ↓
User Dashboard
 ↓
Report Emergency
 ↓
C++ STATE
 ↓
Active Requests / History
```

This is **demo authentication only**. There is no server-side identity provider, SMS/email delivery, or production security system.

## Author / Emergency Coordinator

There is one coordinator role. The Author Command Center can:

- inspect the C++ incident queue and priority heap
- process the next incident explicitly
- inspect responders and availability
- inspect returned routes and Dijkstra traces
- block and unblock roads
- undo the latest recorded road block using the manual Stack
- resolve incidents
- inspect timeline/pipeline/history
- run DSA visualizations
- inspect deterministic allocation/resource state

Manual operational actions are emitted into the C++ event history where supported.

## Project summary

CrisisMesh 2.0 is an academic simulation platform that combines a deterministic emergency-response engine with a live visual interface. It is designed for demonstrating routing, prioritization, responder allocation, and DSA-driven emergency decision logic in a realistic but controlled project environment.


The existing React SVG map is preserved. It contains graph vertices, roads, facilities and simulated emergency/responder markers. Map geometry is presentation-only. C++ state controls blocked roads, incidents, responders and active routes.

There is no external map service, GPS feed, or real-world municipal data connection.

## Dynamic road blocking

```text
BLOCK ROAD
  ↓
C++ Graph.blockEdge()
  ↓
Active route inspection
  ↓
REROUTE_REQUIRED
  ↓
C++ Dijkstra
  ↓
REROUTE_CALCULATED
```

If no route exists, the engine reports `DESTINATION_UNREACHABLE` / `UNREACHABLE`. Blocked edges remain in the graph topology and are excluded from routing.

## DSA Lab honesty

The existing execution visualizers are explicitly labeled **C++17 DSA / PRE-GENERATED TRACE** when they consume packaged traces. They do not pretend that JavaScript is executing the C++ algorithms.

The **Master DSA Lab** adds real C++-generated traces for:

- BST
- AVL
- six sorting algorithms
- linear/binary search
- sparse matrix
- expression processing

The trace source is `crisismesh_trace_exporter`; React only animates/displays the exported JSON.

## Bridge protocol

The Vite development bridge translates browser requests into the persistent C++ CLI protocol:

```text
STATE
REPORT|TYPE|LOCATION|SEVERITY|URGENCY|VICTIMS|DESCRIPTION
PROCESS_NEXT
BLOCK|EDGE_ID
UNBLOCK|EDGE_ID
UNDO_BLOCK
SET_RESPONDER|RESPONDER_ID|AVAILABILITY
RESOLVE|INCIDENT_ID
RESET
```

The bridge handles missing executables, process errors, malformed JSON, timeouts, unsupported commands and empty/invalid responses. It reports `CHECKING`, `ONLINE`, `OFFLINE` or `ERROR` rather than making production/live claims.

The bridge is intentionally **development-only**. No production REST service, WebSocket service, database, GPS, SMS, EMS authority connection, or cloud infrastructure is required by the final academic artifact.

## State authority and persistence

Operational precedence is:

```text
C++ STATE > current React state > static TypeScript map/context
```

LocalStorage is limited to demo user/session information. It does not restore or override operational incidents, queue, heap, responders, routes, blocked roads, lifecycle, or history.

Simulation state is in-memory and is reset by the C++ process or `RESET`.

## Build and run

### C++17

```bash
cmake -S backend -B backend/build
cmake --build backend/build -j2
```

Start the development bridge executable through Vite, or run the CLI directly:

```bash
backend/build/crisismesh_simulation_cli --server
```

Generate packaged DSA traces from `backend/build`:

```bash
backend/build/crisismesh_trace_exporter --algorithm=structures
>>>>>>> 6bc3a11 (feat: add CrisisMesh 2.0 emergency routing simulator)
```

### Frontend

<<<<<<< HEAD
Requirements:

- Node.js 18+
- npm

```bash
cd frontend
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Simulation model

A scenario contains a road graph plus operational entities such as:

- emergencies
- responders
- shelters
- supply sources
- road conditions
- simulation events

The simulation advances deterministically. When a road becomes unavailable, affected routes can be recalculated against the current graph state rather than relying on a static precomputed path.

## Design principles

### DSA-first

The project intentionally uses custom data structures rather than hiding the core logic behind STL containers for the principal DSA components.

### Deterministic behaviour

Tie-breaking and scenario processing are designed to remain reproducible, making the system suitable for demonstrations, testing, and algorithm analysis.

### Explainable decisions

Algorithm traces expose important intermediate decisions so that routing, prioritization, and simulation behaviour can be inspected rather than treated as a black box.

### Separation of concerns

The simulation core, transport/API boundary, shared contracts, and visualization layer are kept separate so individual team members can work on different layers with fewer conflicts.

## Testing

The backend includes tests covering:

- data structures
- graph algorithms
- emergency / responder / shelter / supply engines
- simulation behaviour
- API integration

Run all backend tests with:

```bash
ctest --test-dir backend/build --output-on-failure
```

## Team workflow

Recommended workflow:

```text
main
 └── feature/<module-name>
      └── pull request → review → main
```

Use focused commits such as:

```text
feat: add responder allocation
fix: correct dijkstra rerouting
test: add shelter allocation cases
docs: update architecture guide
refactor: simplify simulation event handling
```

Do not commit generated build directories, dependency folders, IDE metadata, or local environment files.

## Academic scope

CrisisMesh is a **simulation and decision-support project**, not a production emergency-dispatch system. It does not claim to provide live GPS, real-world emergency guarantees, medical advice, or predictive disaster intelligence.

## Project status

**Active university team project — CrisisMesh 2.0**

The repository is organized around a modular C++ simulation backend and a React visualization frontend. Additional documentation is available under `docs/`.

## License

Add the team's selected open-source license before public release.
=======
```bash
npm install --no-audit --no-fund
npx tsc --noEmit
npm run build
npm run dev
```

> Dependency note: the supplied final baseline uses exact direct dependency versions but has no `package-lock.json`. Generate the lockfile on a network-enabled development machine before any dependency-sensitive submission build; do not substitute an invented lockfile.

The supplied baseline pins all direct frontend dependency versions in `package.json`, but it does not contain a `package-lock.json`. The verification environment could not reach the npm registry, so a lockfile could not be generated honestly and dependency installation timed out. Therefore project-dependency TypeScript verification, the Vite production build, and browser verification are **not claimed as PASS** for this final archive.

## Testing

The C++ build and regression suite are verified with CMake. The suite includes:

- Graph
- Queue
- Stack
- Linked List
- Hash Table
- Max Heap
- BFS
- DFS
- Dijkstra
- Incident
- Dispatch
- Simulation
- Simulation state
- Reroute / unreachable
- multi-incident regression
- allocation regression
- responder-shortage regression
- deterministic end-to-end regression
- final integration regression
- DSA Lab
- Final master integration

The bridge smoke path was also executed directly against `simulation_cli --server`, including `STATE`, `RESET`, `REPORT`, `PROCESS_NEXT`, `BLOCK`, `UNDO_BLOCK`, `UNBLOCK`, `RESOLVE`, and an invalid command. Returned lines were parsed as JSON and the process remained usable after the invalid command.

## Viva demo script

1. Build the C++ engine.
2. Start Vite with the local C++ development bridge available.
3. Explain that authentication is demo-only.
4. Open the Author Command Center.
5. Show bridge status and the SVG city map.
6. Report two or three incidents.
7. Show FIFO intake order.
8. Click **PROCESS NEXT INCIDENT**.
9. Explain triage → priority calculation → manual Max Heap extraction.
10. Show responder candidates and the selected responder.
11. Explain the C++ Dijkstra route and manual Min Heap.
12. Block an active route edge and show `REROUTE_REQUIRED`.
13. Show the new route or unreachable result.
14. Unblock / undo the road operation.
15. Resolve the incident and show Linked List history.
16. Open the Master DSA Lab and demonstrate BST, AVL, sorting/searching, sparse matrix and expression processing traces.
17. Reset the engine.

### Viva questions

**Why Queue?** Incoming emergencies arrive in FIFO order before coordinator processing.

**Why Max Heap?** The coordinator needs the highest-priority waiting incident without sorting the entire UI collection.

**Why Min Heap?** Dijkstra needs an efficient next-lowest-cost frontier.

**Why Dijkstra?** The road weights are non-negative and the algorithm gives the lowest operational route cost; it can be rerun after a road block.

**Why Graph?** The city is naturally a vertex/edge network.

**Why Hash Table?** Incident IDs need fast lookup inside the engine.

**Why Linked List?** It demonstrates a manual history structure for resolved incidents.

**Why Stack?** DFS uses LIFO exploration and the Author road-control workflow records road blocks for undo.

**Why BST/AVL?** They provide explicit ordered/balanced indexing demonstrations without relying on STL tree containers.

**Why not STL replacements?** The assessed academic requirement is to demonstrate the manual DSA implementations directly.

**Why C++ authoritative?** One authoritative decision engine prevents React from silently producing different operational decisions.

## Known limitations

- The simulation is deterministic and in-memory.
- The Vite bridge is a local development bridge, not a production backend.
- User authentication is a local demo flow.
- User requests are not associated with a server-side identity because there is no production database/auth service.
- The SVG map is a fictional modeled city, not GPS or a live map.
- Responder movement is represented through simulation state rather than physical vehicle tracking.
- Packaged DSA visualizers use C++-generated traces; they are not a browser-native C++ runtime.
- npm dependency installation and browser verification were not available in the current environment, so those results remain unverified.

## Final architecture statement

> **CRISISMESH FINAL** is a professional academic Emergency Operations Center simulator whose operational decisions are produced by a deterministic C++17 SimulationEngine using manually implemented DSA structures. React/TypeScript provides the command interface, SVG city visualization, demo access flow, and DSA trace presentation through a local Vite development bridge.
>>>>>>> 6bc3a11 (feat: add CrisisMesh 2.0 emergency routing simulator)
