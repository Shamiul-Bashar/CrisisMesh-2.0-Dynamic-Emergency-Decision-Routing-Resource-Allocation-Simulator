# CrisisMesh 2.0

> **Dynamic Emergency Decision, Routing & Resource-Allocation Simulator**

[![C++17](https://img.shields.io/badge/C%2B%2B-17-00599C?logo=c%2B%2B&logoColor=white)](https://isocpp.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-frontend-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![CMake](https://img.shields.io/badge/CMake-3.16%2B-064F8C?logo=cmake&logoColor=white)](https://cmake.org/)
[![Academic Project](https://img.shields.io/badge/Project-Academic%20%2F%20DSA-informational)](#)

CrisisMesh 2.0 is a **team-based CSE/DSA project** that models emergency response as a dynamic, deterministic decision-making problem. The system represents a disaster-affected road network, prioritizes emergencies, dispatches responders, computes routes, reallocates resources, and exposes the evolving simulation state through a web-based visualization layer.

The project is intentionally designed around **custom data structures and algorithms** so that the implementation can be demonstrated, tested, and explained from a Data Structures & Algorithms perspective.

## ✨ What the System Does

CrisisMesh turns a disaster scenario into a sequence of measurable decisions:

```text
Scenario
   ↓
Emergency Intake
   ↓
Priority Evaluation
   ↓
Responder Selection
   ↓
Dynamic Route Planning ──→ Road Failure / Closure
   ↓                           │
Resource Allocation ←──────────┘
   ↓
Simulation Event / Snapshot
   ↓
Algorithm Trace + Metrics
   ↓
React Visualization
```

### Core capabilities

- **Emergency prioritization** using a custom priority queue / heap.
- **Responder dispatch** based on availability and incident requirements.
- **Dynamic routing** over a disaster road graph using Dijkstra's algorithm.
- **BFS/DFS traversal** for graph exploration and reachability analysis.
- **Dynamic road-state updates** with re-routing after failures or closures.
- **Shelter allocation** for affected people.
- **Supply allocation** for emergency demand.
- **Deterministic simulation** for reproducible demonstrations and testing.
- **Algorithm tracing** so important DSA decisions can be inspected visually.
- **Web visualization** for the network, responders, emergencies, shelters, supplies, timeline, and metrics.

## 🏗️ System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│              React + TypeScript + Vite                       │
│                                                              │
│  Operations Map • Emergency Overlay • Responder Overlay     │
│  Shelter/Supply Overlay • Timeline • Metrics • Trace Panel  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                         Shared Contracts
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                    SIMULATION / API LAYER                    │
│                       C++17 Backend                          │
│                                                              │
│  Scenario Loader • Simulation Protocol • Server             │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                     DOMAIN ENGINES                           │
│                                                              │
│ Emergency • Responder • Routing • Shelter • Supply          │
│ Response Coordination • Simulation                          │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                CUSTOM DSA + ALGORITHM LAYER                  │
│                                                              │
│ Graph • Linked List • Queue • Stack • Hash Table • AVL Tree │
│ Binary Min/Max Heap • Dijkstra • BFS • DFS • Sorting        │
└──────────────────────────────────────────────────────────────┘
```

### Design principles

1. **DSA-first:** core behavior is implemented around explicit data structures and algorithms rather than hiding the logic behind high-level libraries.
2. **Deterministic:** the same scenario should produce reproducible simulation behavior, making debugging and academic evaluation easier.
3. **Modular:** domain engines are separated from data structures, algorithms, API concerns, and visualization.
4. **Traceable:** important algorithmic operations can be surfaced as traces for demonstration and analysis.
5. **Testable:** backend modules have focused automated tests and the frontend has an independent build pipeline.

## 🧠 DSA & Algorithm Mapping

| DSA / Algorithm | Role in CrisisMesh |
|---|---|
| **Graph** | Represents the disaster road network and connectivity. |
| **Dijkstra** | Finds the lowest-cost available route between nodes. |
| **BFS** | Explores reachable nodes / connectivity by levels. |
| **DFS** | Supports deep graph traversal and exploration. |
| **Binary Max Heap** | Maintains high-priority emergency work. |
| **Binary Min Heap** | Supports minimum-cost/event-oriented processing. |
| **Queue** | FIFO processing of events and operations. |
| **Stack** | LIFO traversal and auxiliary processing. |
| **Linked List** | Dynamic collection/adjacency support. |
| **Hash Table** | Fast resource/entity indexing. |
| **AVL Tree** | Balanced ordered lookup and indexing. |
| **Sorting / Binary Search** | Utility operations over simulation data. |

See [`DSA_MAPPING.md`](DSA_MAPPING.md) for the project-specific mapping.

## 📁 Repository Structure

```text
CrisisMesh-2.0/
├── backend/
│   ├── include/                 # Public C++ headers
│   │   ├── algorithms/          # Dijkstra, BFS, DFS, sorting, traces
│   │   ├── api/                 # Scenario/API/server interfaces
│   │   ├── dsa/                 # Custom data structures
│   │   ├── emergency/            # Emergency domain logic
│   │   ├── foundation/           # Shared types and indexes
│   │   ├── responder/            # Responder/dispatch logic
│   │   ├── routing/              # Route planning
│   │   ├── shelter/              # Shelter allocation
│   │   ├── simulation/           # Simulation engine
│   │   └── supply/               # Supply allocation
│   ├── src/                      # C++ implementations
│   ├── tests/                    # Backend test suite
│   └── CMakeLists.txt
│
├── frontend/
│   ├── src/components/           # Visualization components
│   ├── src/hooks/                # Simulation state hooks
│   ├── src/services/             # Backend client
│   ├── src/visualization/        # Visual-state models
│   └── ...
│
├── shared/
│   ├── contracts.ts              # Frontend/backend data contracts
│   ├── scenario.schema.json      # Scenario validation schema
│   └── scenarios/                # Example scenarios
│
├── docs/                         # Architecture and module documentation
├── .github/                      # CI and contribution templates
├── DSA_MAPPING.md
├── CONTRIBUTING.md
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **C++17 compiler** (GCC, Clang, or MSVC)
- **CMake 3.16+**
- **Node.js 18+** and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Shamiul-Bashar/CrisisMesh-2.0-Dynamic-Emergency-Decision-Routing-Resource-Allocation-Simulator.git
cd CrisisMesh-2.0-Dynamic-Emergency-Decision-Routing-Resource-Allocation-Simulator
```

### 2. Build the C++ backend

```bash
cmake -S backend -B backend/build
cmake --build backend/build
```

### 3. Run backend tests

```bash
ctest --test-dir backend/build --output-on-failure
```

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

> **Note:** The backend currently contains the simulation core, API/server interfaces, and integration tests. The frontend is structured as the visualization layer. Deployment configuration is intentionally kept separate from the academic simulation logic.

## 🧪 Testing Strategy

The backend test suite covers multiple layers:

- Custom data structures
- Graph algorithms
- Emergency / responder / shelter / supply behavior
- Simulation execution
- API integration behavior

Run all tests with:

```bash
cmake -S backend -B backend/build
cmake --build backend/build
ctest --test-dir backend/build --output-on-failure
```

Frontend compilation is validated independently with:

```bash
cd frontend
npm install
npm run build
```

GitHub Actions runs the project's CI checks on pushes and pull requests.

## 🔄 Simulation Lifecycle

A typical scenario follows this lifecycle:

1. **Load** a deterministic disaster scenario.
2. **Register** emergencies, responders, shelters, supplies, and road conditions.
3. **Prioritize** emergencies according to severity/urgency and queue rules.
4. **Select** an available responder.
5. **Route** the responder through the current road graph.
6. **Update** the network when a road is blocked or its cost changes.
7. **Re-route** affected operations when necessary.
8. **Allocate** shelter capacity and emergency supplies.
9. **Record** simulation events and algorithm traces.
10. **Visualize** state, timeline, metrics, and decisions in the frontend.

## 👥 Team Development Workflow

This repository is maintained as a **team project**. Use feature branches instead of pushing unfinished work directly to `main`.

```text
main
 ├── feature/emergency-priority
 ├── feature/dynamic-routing
 ├── feature/shelter-allocation
 ├── feature/frontend-visualization
 └── fix/...
```

### Recommended commit format

```text
feat: add dynamic road closure handling
fix: correct emergency heap ordering
refactor: simplify responder allocation
test: add Dijkstra edge cases
docs: update architecture diagram
```

### Pull request checklist

- [ ] The change has a clear purpose.
- [ ] Existing functionality is not unintentionally broken.
- [ ] Relevant backend tests were added/updated.
- [ ] `ctest --test-dir backend/build --output-on-failure` passes.
- [ ] Frontend changes pass `npm run build`.
- [ ] No build artifacts, secrets, or local IDE files are committed.
- [ ] Documentation is updated when architecture/API behavior changes.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full workflow.

## 🎓 Academic Scope

CrisisMesh is an **educational simulation**, not a production emergency-management system. The project focuses on demonstrating data structures, algorithms, modular software design, simulation, testing, and visualization.

The following are intentionally outside the current scope:

- Real-time emergency dispatch
- Live GPS/navigation data
- Medical diagnosis or treatment decisions
- Citizen authentication/application infrastructure
- Machine-learning disaster prediction
- Production-grade public safety deployment

## 📚 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture and module boundaries
- [`DSA_MAPPING.md`](DSA_MAPPING.md) — DSA-to-feature mapping
- [`docs/MODULE_7_SIMULATION.md`](docs/MODULE_7_SIMULATION.md) — simulation design
- [`docs/MODULE_8_INTEGRATION.md`](docs/MODULE_8_INTEGRATION.md) — integration details
- [`docs/MODULE_9_VISUAL_SIMULATION.md`](docs/MODULE_9_VISUAL_SIMULATION.md) — visualization layer
- [`docs/MODULE_10_FINALIZATION.md`](docs/MODULE_10_FINALIZATION.md) — finalization notes

## 📌 Project Status

**Academic team project — active development**

The repository contains the modular C++17 simulation core, custom DSA implementations, automated tests, shared scenario contracts, and a React/TypeScript visualization layer. Features may continue to evolve as the team integrates and demonstrates the complete system.

## 📄 License

This project is maintained for **educational and academic use** by the CrisisMesh team.
