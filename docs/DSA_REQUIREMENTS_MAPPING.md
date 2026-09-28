# Operational DSA Requirements Mapping

Phase 2 keeps the existing DSA Lab and connects the required structures to the authoritative C++ emergency workflow.

| DSA / algorithm | Implementation | Operational use | Complexity | Verification |
|---|---|---|---|---|
| Array | `OperationalArray<T, Capacity>` | Bounded responder candidate evaluations inside `chooseResponder` | access/append O(1), space O(capacity) | capacity behavior and real ranked dispatch candidates |
| Linked List | `LinkedList` | Chronological resolved incident records containing sequence, ID, and status | append O(1), traversal O(n) | resolution appends a history entry |
| Stack | `Stack<T>` | Road block state undo and DFS frontier | push amortized O(1), pop O(1) | two road blocks restore in LIFO order; DFS stack events |
| Queue | `Queue<T>` | FIFO emergency intake and BFS frontier | enqueue amortized O(1), dequeue O(1) | intake preserves report order; BFS enqueue events |
| AVL Tree | `IncidentArchiveIndex` | Closed incidents indexed by stable report sequence | insert/search O(log n), traversal O(n) | rotations, lookup, inorder ordering, and balance checks |
| BFS | `BFS::run` | Minimum-hop reachability over open roads | O(V + E) average | reachable path and queue trace |
| DFS | `DFS::run` | Deep reachability traversal with dead-end/backtracking trace | O(V + E) average | unreachable case and `DFS_BACKTRACK` event |
| Binary Search | `LocationDirectory::find` | Validates every reported incident location in a sorted directory | search O(log n) | known location succeeds; invalid reports remain rejected |
| Merge Sort | `mergeSortCandidates` | Ranks real Dijkstra responder summaries by cost, time, distance, then ID | O(n log n), space O(n) | deterministic ties and selected responder equals first reachable rank |
| Max Heap | `MaxHeap` | Selects the highest-priority triaged emergency | insert/extract O(log n), peek O(1) | higher-priority incident dispatches first |
| Min Heap | `MinHeap` | Maintains Dijkstra's lowest-cost route frontier | push/pop O(log n), peek O(1) | existing Dijkstra and dispatch route tests |
| Hash Table | `HashTable` | Maps incident IDs to stable vector indices and current metadata | average insert/search/update O(1), worst O(n) | `findIncident` returns the authoritative vector object |
| Graph | `Graph` adjacency lists | Authoritative city roads, block state, and neighborhood queries | neighbor traversal O(degree) | graph, routing, block, and reroute tests |
| Dijkstra | `Dijkstra::run` | Authoritative weighted responder routing | O((V + E) log V) with Min Heap | route cost/distance/time and dispatch tests |

Responder ordering is deterministic: reachable candidates precede unreachable candidates, followed by weighted route cost, travel time, distance, and responder ID. The existing `DSALab` files and UI remain available as an educational surface; operational grading evidence comes from the simulation paths above and `backend/tests/operational_dsa_test.cpp`.
