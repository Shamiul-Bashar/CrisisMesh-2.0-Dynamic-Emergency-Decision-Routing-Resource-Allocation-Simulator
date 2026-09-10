# CRISISMESH C++17 Engine

The backend is the authoritative deterministic decision engine for CRISISMESH.

## Build

```bash
cmake -S backend -B backend/build
cmake --build backend/build -j2
```

## Main targets

- `crisismesh_simulation_cli` — persistent stdin/stdout development bridge protocol
- `crisismesh_trace_exporter` — exports C++ algorithm traces to `public/data`
- `crisismesh_engine_demo` — console demonstration
- DSA/unit/integration test executables listed by `CMakeLists.txt`

## Authoritative DSA

Manual implementations are retained for Queue, Stack, LinkedList, HashTable, MaxHeap, MinHeap, Graph, BFS, DFS and Dijkstra. The final DSA Lab also contains manual BST, AVL, sorting, searching, sparse-matrix and expression-processing implementations in `dsa/DSALab.*`.

`std::unordered_map` remains an internal graph storage/lookup detail and is not the assessed Hash Table implementation. The assessed heap/queue/stack/list structures are not replaced with STL equivalents.

## Simulation lifecycle

```text
REPORT → FIFO Queue → TRIAGE → PRIORITY → Max Heap → PROCESS_NEXT
→ responder evaluation → Dijkstra → DISPATCH / EN_ROUTE
→ BLOCK → REROUTE_REQUIRED → Dijkstra → REROUTE_CALCULATED
→ RESOLVE → CLOSED → LinkedList history
```

## Road undo Stack

Authoritative road-block operations are recorded in the manual Stack. `UNDO_BLOCK` pops the most recent recorded road block and reopens that edge.

## DSA trace export

From `backend/build`:

```bash
./crisismesh_trace_exporter --algorithm=structures
```

The exporter produces packaged traces for Queue, Stack, Linked List, Hash Table, BST, AVL, sorting, searching, sparse matrix, expression processing and related traversal/routing structures.

## Limitations

This is an academic simulation backend. State is in-memory. The CLI bridge is local development infrastructure; it is not a production REST/WebSocket service and does not connect to real emergency authorities, GPS, SMS, or external dispatch systems.
