# CrisisMesh 2.0

**Dynamic Emergency Decision, Routing & Resource-Allocation Simulator**

CrisisMesh is a DSA-centered emergency-response simulation platform designed to model how limited responders, shelters, supplies, and road networks can be coordinated during a changing disaster scenario.

The project combines a **C++17 simulation/algorithm core** with a **React + TypeScript operational visualization layer**, connected through an API boundary.

## Architecture

```text
┌─────────────────────────────────────────────┐
│ React + TypeScript Visualization             │
│ Operations Map • Timeline • Metrics • Traces │
└──────────────────────┬──────────────────────┘
                       │ API / Simulation Protocol
┌──────────────────────▼──────────────────────┐
│ C++17 Emergency Simulation Core              │
│                                             │
│ Emergency │ Responder │ Routing             │
│ Shelter   │ Supply    │ Simulation          │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ Data Structures & Algorithms                 │
│                                             │
│ Graph • Dijkstra • BFS • DFS • Heaps        │
│ Queue • Stack • Linked List • AVL • Hash    │
│ Sorting • Binary Search                      │
└─────────────────────────────────────────────┘
```

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
│   │   ├── algorithms/
│   │   ├── api/
│   │   ├── dsa/
│   │   ├── emergency/
│   │   ├── foundation/
│   │   ├── responder/
│   │   ├── routing/
│   │   ├── shelter/
│   │   ├── simulation/
│   │   └── supply/
│   ├── tests/
│   └── CMakeLists.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── visualization/
│   ├── package.json
│   └── vite.config.ts
├── shared/
│   ├── contracts.ts
│   ├── scenario.schema.json
│   └── scenarios/
├── docs/
├── .gitignore
└── README.md
```

## Getting started

### Backend

Requirements:

- C++17 compiler
- CMake 3.16+
- Git

Build and test:

```bash
cmake -S backend -B backend/build
cmake --build backend/build
ctest --test-dir backend/build --output-on-failure
```

### Frontend

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
