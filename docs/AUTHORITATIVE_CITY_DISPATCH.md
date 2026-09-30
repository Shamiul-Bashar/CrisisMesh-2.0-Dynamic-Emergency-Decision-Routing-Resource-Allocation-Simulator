# Authoritative City and Dispatch Contract

## Sources and coverage

The C++ city source is `backend/src/graph/CityData.cpp`: 24 locations and 42 undirected roads. Nodes expose ID, display name, category, zone, coordinates and operational status. Coordinates are presentation values, not GPS. Zones are assigned deterministically from city coordinates.

`SimulationEngine::initializeFacilities` in `OperationalData.cpp` supplies 14 facilities and 12 responders: three fire stations/units, four medical posts/ambulances, three police stations/units, two rescue bases/units and two shelters. Medical and emergency posts may share a school, terminal or shelter node; the facility category is separate from the node's primary land use. Shelter IDs match the allocation engine. All units initially are available and at their base facility.

`network`, `facilities`, `responders`, `incidents` and `dispatches` in `STATE` are the authoritative map inputs. The Command Center converts `network` with a presentation-only adapter. Obsolete static operational datasets and standalone trace visualizers were removed during final hardening. The optional Implementation Inspector is supplementary grading evidence and is never a dispatch or analysis decision source.

## Road semantics and revision

Each road exports distance, travel time, risk level, congestion level, capacity, blocked state and road class. The existing cost formula is unchanged:

`distance + 0.35 * travelTime + 0.75 * risk + 0.45 * congestion + 0.03 * max(0, 70 - capacity)`.

Blocked roads are excluded. Travel time is an input in simulation minutes, distance in simulation km; congestion is a separate penalty, not a multiplier silently applied to travel time. Default congestion categories: normal 1–3 (23 roads), moderate 4–5 (16), high 6–7 (3). Risk: level 1 (21), level 2 (19), level 3 (2). Zero roads are initially blocked. Tests verify that the weighted optimum can be longer than the shortest-distance path.

Road class is a presentation mapping from capacity: arterial ≥75, primary ≥70, secondary ≥60, local otherwise. It adds no extra cost.

`Graph::revision()` advances on successful topology mutations and changes to blocked state. Repeating an already-applied block state does not advance it. Initial construction produces revision 66. RESET clears dispatches and advances the revision beyond the prior network, preventing old traces from matching a new scenario. There is no road-cost editing command yet; a future setter must increment the same counter.

## Dispatch and selection

One `DispatchRecord` per active incident stores incident/responder IDs, responder start and destination, selected Dijkstra route, distance/time/cost, risk, congestion, graph revision, dispatch sequence, selection reason and ordered candidate summaries. `dispatches` is canonical; `activeDispatches` is a compatibility alias of the same records.

STATE only serializes saved routes; it never runs Dijkstra or reselects a responder. Analytics use those same records. A changed network marks older records `stale: true`; consumers must not animate a stale route as current. Blocking an edge on a saved route explicitly reroutes its assigned responder and replaces that incident's record. Unrelated road changes retain the original route/revision. Reroutes use reason `ASSIGNED_RESPONDER_REROUTE` and an empty candidate list because they do not select a new responder.

Compatible available responders are evaluated once in C++, held in the Phase 2 bounded Array and ranked by the manual Merge Sort: reachable first, then ascending weighted cost, travel time, distance, responder ID. The first reachable candidate is the actual selected responder. Reasons compare the winner with the next reachable candidate: `LOWEST_WEIGHTED_COST`, `LOWER_TRAVEL_TIME_TIEBREAK`, `LOWER_DISTANCE_TIEBREAK`, `RESPONDER_ID_TIEBREAK`; `ONLY_REACHABLE_UNIT` applies when only one is reachable.

Candidates expose responder ID/type, start/destination, reachable, distance, estimatedTravelTime, weightedCost, risk, congestion, pathNodes, pathEdges and graphRevision. Distance, time and weighted cost are sums of selected edge values/costs; risk is the sum of edge risk levels; congestion is the arithmetic mean of edge congestion levels (zero for zero-edge paths). Unreachable routes have empty paths and zero aggregate metrics; always inspect `reachable`.

## Lifecycle, ownership, and recovery

Responders hold their active `assignedIncidentId` explicitly. Field completion releases that assignment, removes the active dispatch, moves the responder to the incident location, and advances the incident through `RESPONSE_COMPLETED` to `AWAITING_USER_CONFIRMATION`. The incident retains its historical responder ID while awaiting its owner's confirmation. YES from the reporting owner closes the incident. NO requires a reason, records the escalation, raises urgency, and requeues the incident. Confirming an old incident cannot release a responder already assigned elsewhere.

Waiting incidents remain in authoritative incident storage. PROCESS_NEXT, restored responder availability and field completion retry waiting incidents in report order by appending them once to the manual FIFO intake queue; the Max Heap then applies normal priority. Failed routing with no assignment also waits and may be retried. No automatic busy loop is used.

An assigned unreachable incident retains its unit and an unreachable dispatch record. Road reopening (including undo) retries it through REROUTE_REQUIRED, producing EN_ROUTE on success or UNREACHABLE on failure. It does not allocate consumables or a shelter a second time. Existing consumable shortages remain advisory allocation results; they are not a new replenishment subsystem.

The Author's generic report buttons are disabled until citizen selection exists. Both HTTP bridge and CLI REPORT reject a missing citizen ID. Legacy direct C++ demo/test calls may still create ownerless incidents; this compatibility path is not exposed as an operator reporting policy.

## Live analysis envelope

HTTP actions `ANALYZE_BFS`, `ANALYZE_DFS`, `ANALYZE_DIJKSTRA` accept `source` and `destination`. CLI equivalents are `ANALYZE_BFS|SOURCE|DEST`, etc. Each returns `{ok, state, events, result}`; failures retain the Phase 1 error envelope.

All results contain algorithm, source, destination, graphRevision, reachable, pathNodes and pathEdges. BFS adds minimumHops (null if unreachable) and visitOrder. DFS adds visitOrder; its manual stack stores traversal frames and emits parent-linked DFS_BACKTRACK events. Dijkstra adds distance, estimatedTravelTime, weightedCost, risk and congestion. Every analysis event carries the analyzed revision. Analysis does not mutate simulation scheduling or dispatches.

BFS minimizes hop count; DFS tests reachability and exposes depth-first exploration, without a shortest-path guarantee; Dijkstra minimizes the weighted operational cost. All operate on current open roads, not generated trace assets.

## Validation

`phase3_operational_test.cpp` covers coverage, metric sums, deterministic selection, persistence, simultaneous incidents, revisions, reassignment, user confirmation and recovery. `tests/phase3-bridge.test.mjs` starts an isolated development bridge and validates the HTTP contract, owner rejection, all three analyses before/after blocking, and reopening recovery. Run it with `node --test tests/phase3-bridge.test.mjs`. The Phase 2 DSA test and all prior CTest cases remain registered.

## Historical Phase 3 file inventory

Added:

- `backend/include/simulation/DispatchRecord.hpp`
- `backend/src/simulation/OperationalData.cpp`
- `backend/tests/phase3_operational_test.cpp`
- `core/simulation/presentation.ts`
- `tests/phase3-bridge.test.mjs`
- `docs/AUTHORITATIVE_CITY_DISPATCH.md`

Changed:

- `backend/CMakeLists.txt`
- `backend/include/dfs/DFS.hpp`, `backend/src/dfs/DFS.cpp`
- `backend/include/domain/Responder.hpp`
- `backend/include/graph/Edge.hpp`, `Graph.hpp`, `Vertex.hpp`
- `backend/src/graph/CityData.cpp`, `Graph.cpp`
- `backend/include/hashtable/HashTable.hpp`, `backend/src/hashtable/HashTable.cpp`
- `backend/include/simulation/SimulationEngine.hpp`, `backend/src/simulation/SimulationEngine.cpp`
- `backend/include/sort/CandidateMergeSort.hpp`
- `backend/src/simulation/simulation_cli.cpp`
- `backend/tests/phase8_shortage_test.cpp`, `simulation_test.cpp` (coverage-aware scenario setup)
- `core/simulation/api.ts`, `types.ts`
- `features/command-center/CommandCenter.tsx`
- `vite.config.ts`
- `docs/DSA_REQUIREMENTS_MAPPING.md`

Validation at delivery: C++ build passed; all 23 CTest cases passed; Phase 1 tests 6/6 passed; typecheck and production build passed; live HTTP bridge smoke test passed for STATE, REPORT, PROCESS_NEXT, BLOCK, UNBLOCK, BFS, DFS and Dijkstra.
