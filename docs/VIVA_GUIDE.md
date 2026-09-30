# CrisisMesh 2.0 Viva Guide

## A. 60-second project explanation

CrisisMesh 2.0 is a deterministic emergency coordination simulator. Citizens report incidents through React, and a local Vite bridge sends each command to a persistent C++17 `SimulationEngine`. C++ owns priority, scheduling, responder selection, routing, road state, rerouting, lifecycle, and history. The Author sees those decisions on a 24-node, 42-road tactical map; citizens see only their own emergency, responder status, messages, confirmation, and history. The project demonstrates manual Queue, Stack, Linked List, AVL Tree, Hash Table, Array, Max Heap, Min Heap, Graph, Binary Search, Merge Sort, BFS, DFS, and Dijkstra in one operational workflow.

## B. End-to-end workflow

Citizen report → FIFO Queue → triage → Max Heap priority → compatible responder Array → Dijkstra route per candidate → Merge Sort ranking → dispatch → tactical map → response completed → citizen YES closes or NO escalates and requeues.

## C. Where is each DSA used?

| DSA | Operational use |
|---|---|
| Array | Bounded responder candidate evaluations |
| Linked List | Ordered resolved-incident history |
| Stack | Road-block undo and DFS traversal |
| Queue | Incident intake and BFS frontier |
| AVL Tree | Balanced closed-incident archive index |
| Binary Search | Location validation in a sorted directory |
| Merge Sort | Deterministic responder candidate ordering |
| Max Heap | Highest-priority incident scheduling |
| Min Heap | Lowest-cost Dijkstra frontier |
| Hash Table | Incident ID lookup |
| Graph | City locations and roads |
| BFS | Minimum-hop route analysis |
| DFS | Reachability and backtracking analysis |
| Dijkstra | Minimum weighted operational route |

## D. Why Queue instead of Stack for emergency intake?

A Queue preserves FIFO arrival order before triage. A Stack would process the newest report first and could indefinitely delay older incidents.

## E. Why Max Heap for incident priority?

The next dispatch needs the greatest priority score. A Max Heap provides O(1) access to the maximum and O(log n) insertion/extraction without sorting every waiting incident.

## F. Why Min Heap for Dijkstra?

Dijkstra repeatedly needs the unsettled node with the smallest known cost. A Min Heap performs that frontier extraction and update efficiently.

## G. BFS vs DFS vs Dijkstra

- BFS finds a minimum-hop path in an unweighted view using a Queue.
- DFS explores deeply using a Stack and is useful for reachability/backtracking, not shortest paths.
- Dijkstra finds the minimum non-negative weighted cost using a Min Heap.

## H. Why AVL Tree?

The closed-incident archive needs ordered lookup with predictable depth. AVL rotations keep the tree balanced, so insert and search remain O(log n).

## I. Why does Binary Search need sorted input?

Binary Search discards half of the remaining range after each comparison. That decision is valid only when records are ordered by the searched key.

## J. Why Merge Sort?

Merge Sort guarantees O(n log n), produces deterministic ordering, and is straightforward to implement manually. CrisisMesh uses it to order candidate responders by reachability, cost, time, distance, and ID.

## K. Why Hash Table lookup?

Incident commands arrive with an incident ID. The Hash Table maps that ID to authoritative incident metadata in average O(1) time instead of scanning the full collection.

## L. Main time complexities

| Operation | Complexity |
|---|---|
| Queue enqueue/dequeue | O(1) amortized |
| Stack push/pop | O(1) amortized |
| Hash lookup | average O(1), worst O(n) |
| AVL insert/search | O(log n) |
| Binary Search | O(log n) |
| Merge Sort | O(n log n) |
| Heap insert/extract | O(log n) |
| BFS / DFS | O(V + E) |
| Dijkstra | O((V + E) log V) |

## M. How C++ and React communicate

React posts commands to `/api/simulation`. A Vite development plugin converts them to a line protocol for `crisismesh_simulation_cli --server`. The persistent C++ process returns one JSON envelope containing `ok`, `state`, `events`, and `result`.

## N. Why React cannot choose responders or routes

Two decision engines could disagree and produce misleading UI. C++ is the single authority; React only submits commands and presents returned state, routes, candidates, and traces.

## O. How rerouting works after a road blockage

C++ blocks the road, increments the graph revision, checks active saved routes, marks affected incidents for rerouting, and reruns Dijkstra for the assigned responder. It stores the replacement route or marks the incident unreachable.

## P. How graph revision prevents stale visualization

Dispatch and analysis results store the revision they were calculated against. The frontend will not animate a route or trace when that revision differs from the current network revision.

## Q. How citizen YES/NO works

After the Author marks field work complete, C++ enters `AWAITING_USER_CONFIRMATION`. YES is accepted only from the reporting citizen and closes the incident. NO requires a reason, increases urgency, clears the old assignment, and returns the incident to the FIFO intake queue.

## R. Current limitations

The development bridge and simulation are in-memory; restarting them resets operational state. Users and messages use browser `localStorage`. The map is fictional, there is no GPS or external map API, and responder movement is presentation-only. Authentication is designed for academic demonstration rather than production deployment.
