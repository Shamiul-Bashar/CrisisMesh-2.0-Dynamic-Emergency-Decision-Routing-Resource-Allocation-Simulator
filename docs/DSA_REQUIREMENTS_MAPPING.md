# Final DSA Requirements Mapping

This document maps every assessed structure to the final operational C++ path. The React DSA Architecture view summarizes the same mapping, and the optional Implementation Inspector shows supplementary C++-generated evidence. Operational decisions come from `SimulationEngine`, not from packaged frontend traces.

| Requirement | Exact C++ module | Operational use | Manual status | Main complexity | Test evidence |
|---|---|---|---|---|---|
| Array | `include/array/OperationalArray.hpp` | Bounded candidate buffer inside responder evaluation | Manual fixed-capacity template | access/append O(1), space O(capacity) | `operational_dsa_test.cpp`, `phase3_operational_test.cpp` |
| Linked List | `include/linkedlist/LinkedList.hpp`, `src/linkedlist/LinkedList.cpp` | Chronological resolved-incident records | Manual linked nodes | append O(1), traversal O(n) | `linkedlist_test.cpp`, `operational_dsa_test.cpp` |
| Stack | `include/stack/Stack.hpp` | Road-block undo and DFS support | Manual dynamic-array Stack | push/pop O(1) amortized | `stack_test.cpp`, `simulation_reroute_test.cpp`, `phase3_operational_test.cpp` |
| Queue | `include/queue/Queue.hpp` | FIFO incident intake and BFS frontier | Manual circular-array Queue | enqueue/dequeue O(1) amortized | `queue_test.cpp`, `bfs_test.cpp`, `operational_dsa_test.cpp` |
| Tree | `IncidentArchiveIndex` in `include/tree/IncidentArchiveIndex.hpp` and `src/tree/IncidentArchiveIndex.cpp` | Closed incidents indexed by report sequence | Manual AVL Tree with rotations | insert/search O(log n), traversal O(n) | `operational_dsa_test.cpp`, `phase3_operational_test.cpp` |
| BFS | `include/bfs/BFS.hpp`, `src/bfs/BFS.cpp` | Minimum-hop analysis on current open roads | Manual traversal using project Queue | O(V + E) | `bfs_test.cpp`, `phase3_operational_test.cpp`, `tests/phase3-bridge.test.mjs` |
| DFS | `include/dfs/DFS.hpp`, `src/dfs/DFS.cpp` | Reachability with explicit parent-linked backtracking | Manual iterative traversal frames | O(V + E) | `dfs_test.cpp`, `phase3_operational_test.cpp`, `tests/phase3-bridge.test.mjs` |
| Searching | `LocationDirectory` in `include/search/LocationDirectory.hpp` and `src/search/LocationDirectory.cpp` | Validate reported location IDs in a sorted directory | Manual Binary Search | O(log n) | `operational_dsa_test.cpp`, invalid-report integration tests |
| Sorting | `include/sort/CandidateMergeSort.hpp`, `src/sort/CandidateMergeSort.cpp` | Order actual responder route summaries deterministically | Manual Merge Sort | O(n log n), O(n) auxiliary space | `operational_dsa_test.cpp`, `phase3_operational_test.cpp` |
| Heap | `include/heap/MaxHeap.hpp`, `src/heap/MaxHeap.cpp` | Extract highest-priority waiting incident | Manual binary Max Heap | insert/extract O(log n), peek O(1) | `maxheap_test.cpp`, `dispatch_test.cpp`, `operational_dsa_test.cpp` |
| Min Heap | `include/dijkstra/MinHeap.hpp`, `src/dijkstra/MinHeap.cpp` | Dijkstra frontier ordered by lowest route cost | Manual binary Min Heap | push/pop O(log n), peek O(1) | `dijkstra_test.cpp`, `dispatch_test.cpp` |
| Hash Table | `include/hashtable/HashTable.hpp`, `src/hashtable/HashTable.cpp` | Incident ID to authoritative storage index/metadata | Manual separate-chaining table | average O(1), worst O(n) | `hashtable_test.cpp`, `operational_dsa_test.cpp` |
| Graph | `include/graph/Graph.hpp`, `src/graph/Graph.cpp`, `src/graph/CityData.cpp` | 24-node, 42-road authoritative city network | Manual adjacency-list behavior over project edge/vertex types | neighbor traversal O(degree), storage O(V + E) | `graph_test.cpp`, `phase3_operational_test.cpp` |
| Dijkstra | `include/dijkstra/Dijkstra.hpp`, `src/dijkstra/Dijkstra.cpp` | Weighted responder selection, dispatch route, and reroute | Manual algorithm using project Min Heap | O((V + E) log V) | `dijkstra_test.cpp`, `dispatch_test.cpp`, `simulation_reroute_test.cpp`, `tests/phase3-bridge.test.mjs` |

## Operational contracts

- Candidate ranking places reachable responders first, then compares weighted cost, travel time, distance, and responder ID.
- The Queue preserves report arrival order before priority triage; the Max Heap decides which triaged incident is dispatched first.
- The Stack stores successful road-block operations so `UNDO_BLOCK` reopens the latest road in LIFO order.
- BFS minimizes hops, DFS demonstrates reachability/backtracking, and Dijkstra minimizes weighted operational cost.
- Closed incidents are appended to Linked List history and indexed in the AVL archive.
- `std::unordered_map` used internally by graph storage is not claimed as the assessed manual Hash Table.

## Supplementary implementation evidence

`backend/include/dsa/DSALab.hpp`, `backend/src/dsa/DSALab.cpp`, `backend/tests/dsa_lab_test.cpp`, and `crisismesh_trace_exporter` are retained because they demonstrate additional manual structures requested during development. They are secondary evidence. The table above identifies the final operational grading paths.
