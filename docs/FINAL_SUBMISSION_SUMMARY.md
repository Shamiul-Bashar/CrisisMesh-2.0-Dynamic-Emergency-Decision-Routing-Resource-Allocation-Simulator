# CrisisMesh 2.0 Final Submission Summary

## Final architecture

CrisisMesh uses React and TypeScript for interaction and visualization, a Vite development bridge for validated local transport, and a persistent C++17 `SimulationEngine` for every operational decision. The engine owns the 24-node, 42-road city, incidents, responders, priority, routing, road changes, lifecycle, and history. React never duplicates responder selection or route calculation.

## Major features

- Emergency Operations Center with priority work, tactical map, route inspection, road controls, responder/resource views, and live analysis
- Citizen portal with reporting, owner-filtered response status, YES/NO confirmation, messages, history, and safe profile data
- Compatible responder evaluation and deterministic candidate comparison
- Road blocking, Dijkstra rerouting, unreachable handling, graph-revision safety, and Stack undo
- BFS, DFS, and Dijkstra event playback against the current network
- Direct and broadcast communication with citizen privacy
- DSA Architecture view plus an optional C++ Implementation Inspector

## DSA coverage

The operational engine uses a manual Array, Linked List, Stack, Queue, AVL Tree, Binary Search, Merge Sort, Max Heap, Min Heap, Hash Table, Graph, BFS, DFS, and Dijkstra. Exact modules, complexities, and tests are listed in `DSA_REQUIREMENTS_MAPPING.md`.

## Verified tests

- Phase 1 authentication and bridge: 6 passing
- Phase 3 development bridge: 1 passing
- Phase 4 map presentation: 18 passing
- Phase 6 citizen ownership and lifecycle: 7 passing
- Native CTest: 23 passing
- TypeScript typecheck: passing
- Vite production build: passing

## Known limitations

- The bridge and operational simulation state are in-memory and reset with the engine process.
- Users, sessions, and messages persist in browser `localStorage` for the academic demo.
- The city and responder movement are simulated; there is no GPS or external map service.
- The Vite bridge is development infrastructure rather than a deployed production backend.
- Authentication is designed for university demonstration, not production identity security.

## Final demo sequence

1. Sign in as Author and Citizen.
2. Submit a FIRE incident from the Citizen Portal.
3. Process the incident and explain Queue → Max Heap → candidates → Dijkstra.
4. Inspect the selected responder, candidate table, and tactical route.
5. Block an active-route road, observe revision-safe rerouting, then undo the block.
6. Run BFS, DFS, and Dijkstra analysis.
7. Mark field response complete and confirm YES from the reporting citizen.
8. Submit another incident and demonstrate NO with an escalation reason.
9. Demonstrate recipient-only direct messaging and a broadcast.
10. Open DSA Architecture and the optional Implementation Inspector for viva evidence.

## Important source files

- `backend/src/simulation/SimulationEngine.cpp` — authoritative workflow
- `backend/src/simulation/OperationalData.cpp` — city facilities, responders, recovery, and state output
- `backend/src/graph/Graph.cpp` and `CityData.cpp` — network and revision behavior
- `backend/src/dijkstra/Dijkstra.cpp` — weighted routing
- `features/command-center/CommandCenter.tsx` — Author application shell
- `features/command-center/TacticalMap.tsx` — operational map
- `features/command-center/AlgorithmPlayback.tsx` — live graph analysis playback
- `features/citizen/CitizenDashboard.tsx` — citizen workflow
- `vite.config.ts` — local simulation and Author OTP bridges
