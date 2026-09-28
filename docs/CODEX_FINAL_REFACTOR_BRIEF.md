# CrisisMesh 2.0 — Final Product Refactor Brief for Codex

## Repository and working branch

Repository:
`Shamiul-Bashar/CrisisMesh-2.0-Dynamic-Emergency-Decision-Routing-Resource-Allocation-Simulator`

Work ONLY on:
`feature/crisismesh-final-product-redesign`

Base checkpoint:
`94652b7` — Merge existing GitHub history with current CrisisMesh checkpoint

Do not work directly on `main`.

---

## 1. Product identity

CrisisMesh 2.0 is a C++17 Data Structures & Algorithms emergency decision, dispatch, routing, and resource-allocation simulator with a React/TypeScript visualization layer.

The project must feel like ONE coherent emergency-operations product, not a collection of unrelated DSA demos.

Core operational story:

Citizen reports emergency
→ request enters intake queue
→ C++ triages and prioritizes
→ compatible responders are evaluated
→ weighted route is computed
→ responder is dispatched
→ live tactical map visualizes the route/algorithm
→ field response completes
→ citizen confirms YES/NO
→ YES closes incident, NO escalates/requeues.

C++ remains authoritative for operational decisions. React is controller/visualization.

---

## 2. Teacher grading requirements — mandatory DSA coverage

These topics MUST exist as meaningful C++ implementations and MUST be connected to real CrisisMesh workflows:

- Array
- Linked List
- Stack
- Queue
- Tree
- BFS
- DFS
- Searching
- Sorting
- Heap

Teacher guidance: STL may be used for the graph, but using STL stack/queue/list instead of scratch implementations can reduce marks. Therefore assessed structures should be manually implemented.

### Required mapping to product behavior

#### Array
Use a genuine C++ array/manual array abstraction in a real operational context, preferably for a bounded city registry such as responder/facility candidate storage or another fixed-capacity operational collection.

Do not create a disconnected “array demo”.

#### Linked List
Use the existing manual linked list for incident lifecycle/history/archive sequencing where append/traversal is meaningful.

#### Stack
Use the existing manual stack for a real LIFO behavior such as road-control undo history and/or iterative DFS support.

#### Queue
Use the existing manual queue for incoming emergency intake / waiting work. BFS should also use a queue implementation appropriate to the manual DSA requirement.

#### Tree
Use ONE meaningful manual tree in the real product. Prefer a practical ordered incident archive/index or shelter/resource index.

Do not keep BST + AVL merely as two unrelated lab demos. Choose the version that best supports a real workflow, document why, and remove redundant tree-demo surface area.

#### BFS
Use BFS for unweighted/minimum-hop reachability and educational comparison on the city graph.

Do NOT present BFS as the weighted operational route when road cost matters.

#### DFS
Use DFS for traversal/reachability/network exploration.

Do NOT claim DFS is a shortest-path algorithm.

#### Searching
Implement at least one meaningful manual C++ search in the actual product, such as:
- binary search over a sorted facility/responder/location directory, or
- another naturally sorted operational collection.

It must not exist only as a toy lab button.

#### Sorting
Keep a small, relevant manual sorting implementation rather than a large sorting-algorithm playground.

Preferred use: manually sort responder candidate summaries / operational history / analytics data for presentation or comparison while keeping the C++ dispatcher authoritative.

One well-integrated algorithm such as Merge Sort is preferable to many disconnected algorithms.

#### Heap
Keep:
- manual Max Heap for emergency priority scheduling
- manual Min Heap for Dijkstra

These directly strengthen the project and should remain.

### Additional useful DSA
A manual Hash Table may remain if it is genuinely used for fast incident lookup. Do not remove useful structures merely because they are not in the minimum rubric.

---

## 3. Remove or refactor DSA features that reduce product coherence

Current repository inspection shows a standalone `DSALab` implementation containing several demo-oriented features such as:
- both BST and AVL
- Bubble Sort
- Selection Sort
- Insertion Sort
- Merge Sort
- Quick Sort
- Heap Sort
- Linear/Binary Search traces
- Sparse Matrix
- stack-based expression processing

The current `DSAVisualizer.tsx` also exposes a “PRE-GENERATED TRACE LAB” with tabs for Queue, Stack, Linked List, Hash Table, Max Heap, BFS, DFS, etc.

This makes the application look like a DSA laboratory attached to an emergency simulator.

Refactor this.

### Target
The final product should NOT have a prominent standalone “DSA Lab” experience.

Instead:
- integrate BFS/DFS/Dijkstra visualizations directly into the tactical map
- show queue/heap/stack/linked-list usage contextually in the operational workflow
- provide a compact “DSA Architecture / Under the Hood” section for viva/teacher inspection
- surface complexity and current structure usage when relevant
- remove dead/demo-only algorithms that do not serve the emergency product

Strong candidates to remove unless a genuine product use exists:
- Sparse Matrix demo
- Expression Processing demo
- redundant sorting algorithms
- duplicate tree implementations
- toy-only DSA traces

Before deleting source, inspect dependencies/tests and migrate any required functionality into properly named production modules.

Do not delete required teacher topics.

---

## 4. Desired backend structure

Prefer clear production-oriented naming over “lab” naming.

A possible structure is:

```
backend/
  include/
    array/
    linkedlist/
    stack/
    queue/
    tree/
    search/
    sort/
    heap/
    graph/
    bfs/
    dfs/
    dijkstra/
    domain/
    simulation/
    allocation/

  src/
    array/
    linkedlist/
    stack/
    queue/
    tree/
    search/
    sort/
    heap/
    graph/
    bfs/
    dfs/
    dijkstra/
    domain/
    simulation/
    allocation/
```

Do not restructure just for appearance if it creates unnecessary risk. Prefer incremental migration with tests.

Each required DSA module should contain a concise comment near the class/function declaration using this format:

```cpp
// DSA REQUIREMENT: Manual Queue
// CrisisMesh use: incoming emergency reports waiting for triage.
// Why this structure: FIFO preserves report arrival order before prioritization.
// Implementation: scratch-built; no std::queue.
// Complexity: enqueue O(1), dequeue O(1).
```

Use similar comments for Array, Linked List, Stack, Tree, BFS, DFS, Search, Sort, and Heap.

Comments must explain real project use, not generic textbook definitions.

---

## 5. DSA evidence for teacher / viva

Create or update one concise document:

`docs/DSA_REQUIREMENTS_MAPPING.md`

Use a table:

| Requirement | Manual C++ Module | CrisisMesh Use | Main Operations | Complexity | UI Evidence |
|---|---|---|---|---|---|

It must make it immediately obvious where every required topic is used.

Also update README so the project is described primarily as an emergency simulation system, not as a collection of DSA demos.

---

## 6. Tactical map — highest UI priority

The city map is the hero feature.

The desired visual direction is an original, dark, cinematic tactical city road network inspired by algorithm-on-map simulations.

Do NOT make a Google Maps clone.

### Visual requirements
- dense but readable fictional road network
- primary/secondary road hierarchy
- district/zone boundaries
- compact professional facility markers
- multiple hospitals, fire stations, police/rescue facilities, shelters
- subtle labels
- dark emergency-operations palette
- controlled glow
- no giant neon bubbles
- no childish node-graph appearance

### Operational layers
- city base
- roads
- congestion
- risk
- blocked roads
- facilities
- incidents
- algorithm exploration
- candidate routes
- selected route
- responders
- labels/tooltips

Prefer scalable SVG if compatible with the current architecture.

### Algorithm animation
BFS:
- level-by-level wave/frontier
- minimum-hop/unweighted framing

DFS:
- deep traversal + backtracking
- reachability/traversal framing

Dijkstra:
- weighted exploration/frontier
- visited road/node illumination
- final path strong highlight
- operational route

Dijkstra remains the default operational algorithm.

### Multiple responders / facilities
A fire incident must be able to evaluate multiple compatible fire units/stations.
A medical incident must be able to evaluate multiple medical responders.

Show candidate comparison using actual C++ metrics.

The selected responder must come from C++.

### Simultaneous incidents
Support multiple active emergencies and routes without visual chaos.
Selecting an incident focuses it while other routes remain visible at reduced emphasis.

### Lifecycle visualization
REPORTED / QUEUED:
active emergency marker

ASSIGNED / EN_ROUTE:
route + responder

RESPONSE_COMPLETED / AWAITING_USER_CONFIRMATION:
calmer pending-confirmation visual; do not keep aggressive emergency pulse

YES:
RESOLVED → CLOSED
remove active emergency marker/route but preserve history

NO:
ESCALATED → QUEUED
reactivate emergency styling and re-enter dispatch workflow

---

## 7. Map route explanation

For a selected dispatch show actual engine data:

- responder/facility
- algorithm
- distance
- ETA/travel time
- congestion
- risk
- weighted cost
- explored nodes
- route path
- why this route was selected

Never invent metrics.

Example language:
“Central Fire Unit was selected because its route has the lowest weighted operational cost among available compatible responders.”

Only state reasons supported by actual C++ results.

---

## 8. Author dashboard redesign

The Author dashboard should look like a professional Emergency Operations Center.

Prioritize:
- situational awareness
- active incidents
- pending queue
- responder availability
- blocked/congested roads
- map
- selected incident context
- user communications
- compact audit/event timeline

The current User Database is REQUIRED and must remain.

Keep:
- registered citizen directory
- no password display
- search/filter
- individual messaging
- broadcast messaging to all citizens
- recent communication history

Do not build a second account system.

Messages must continue to use the same existing registered users.

---

## 9. User dashboard redesign

The User dashboard should share the same visual system as the Author dashboard:
- same typography
- spacing system
- panel language
- icons
- status pills
- responsive behavior
- dark professional emergency aesthetic

But it should be simpler and citizen-focused.

Recommended hierarchy:

1. Emergency CTA / Report Emergency
2. Current active emergency status
3. Dispatch/responder progress
4. Awaiting confirmation action when applicable
5. Messages from CrisisMesh / Author
6. Incident history
7. Profile/account details

Avoid exposing internal coordinator controls.

For AWAITING_USER_CONFIRMATION show a highly clear card:
“Has your emergency been resolved?”

YES:
confirm and close

NO:
show structured reason selector and re-escalate

---

## 10. Forgot Password bug — must fix

A reported bug exists:
After completing Forgot Password and setting a new password, the new password is not reliably accepted/persisted.

Audit BOTH Author and User reset flows end-to-end.

Current code has:
- Author recovery via real Gmail OTP
- author password override stored through `cm-author-password`
- user passwords stored as hashes inside `cm-users`

Do not assume these are correct merely because setters exist.

Required test cases:

### Author
1. Login with current password.
2. Start Forgot Password.
3. Verify registered author email before OTP.
4. Send real email OTP.
5. Verify within 60 seconds.
6. Set a new password.
7. Log out.
8. Login with NEW password → must succeed.
9. Login with OLD password → must fail.
10. Reload browser/app and login with NEW password → must still succeed.

### User
1. Register user.
2. Forgot Password using the registered phone.
3. Verify OTP.
4. Set new password.
5. New password succeeds.
6. Old password fails.
7. Reload persists the new password.

Centralize credential read/write logic enough that Login and Forgot Password cannot use different stores.

Never expose passwords in the Author User Database.

Do not commit `.env` or Gmail App Password.

---

## 11. Current C++ bridge bug — fix before map work

There is a current runtime issue where the Command Center can report:
“C++ Simulation Development Bridge returned no STATE snapshot.”

Diagnose the actual response contract between:
- `backend/src/simulation/simulation_cli.cpp`
- `vite.config.ts`
- `core/simulation/api.ts`
- `core/simulation/types.ts`
- Command Center state loader

Do not paper over the issue with mock frontend state.

Fix the real contract and verify the engine displays ONLINE before doing major map integration.

---

## 12. Keep these current features

Do not break:
- C++17 authoritative SimulationEngine
- emergency reporting
- incident ownership by user ID
- max-heap triage
- responder compatibility matching
- Dijkstra weighted routing
- road block/unblock/reroute
- resource/shelter allocation if still operationally relevant
- user-confirmed resolution lifecycle
- real Gmail OTP for Author
- user registration/login
- User Database
- direct messages
- broadcast messages
- existing useful backend tests

---

## 13. Remove visual/product clutter

Audit every screen and feature.

Delete, merge, or hide anything that does not strengthen one of these product pillars:
1. emergency reporting
2. dispatch/priority
3. routing/map
4. required DSA evidence
5. resource allocation
6. incident lifecycle
7. citizen/coordinator communication
8. authentication/account recovery

Avoid filler metrics, fake live text, repeated “demo/lab” wording, duplicated controls, and disconnected academic widgets.

Do not remove something simply because it is complex; remove it if it is irrelevant or redundant.

---

## 14. UI/UX quality bar

Act as a senior product designer.

Use a cohesive design system:
- consistent spacing scale
- restrained border radius
- professional typography hierarchy
- high contrast where operationally needed
- subtle surfaces
- controlled accent colors
- accessible focus states
- useful hover states
- meaningful empty/loading/error states
- responsive layouts
- reduced-motion support

Animations should communicate state, not decorate randomly.

The product should look suitable for:
- university project showcase
- viva
- portfolio
- GitHub demonstration

---

## 15. Implementation order

### Phase 0 — Audit and stability
- inspect entire repo
- create dependency map
- run baseline tests/build
- fix bridge STATE bug
- reproduce Forgot Password bug

### Phase 1 — DSA architecture cleanup
- map each teacher requirement to a real workflow
- move required algorithms out of standalone-lab framing
- remove irrelevant lab-only modules
- keep useful Hash Table/Heap/Dijkstra
- add DSA requirement comments
- create `docs/DSA_REQUIREMENTS_MAPPING.md`

### Phase 2 — Authentication fix
- unify reset/login credential storage
- verify Author + User reset flows

### Phase 3 — Backend city model
- multiple facilities/responders
- meaningful congestion/risk
- expose actual comparison metrics needed by UI
- keep C++ authoritative

### Phase 4 — Tactical map
- rebuild visual map system
- facilities/incidents/congestion/routes
- responsive map layout

### Phase 5 — Algorithm animation
- BFS
- DFS
- Dijkstra
- play/pause/step/speed/restart
- integrate into map instead of separate DSA Lab

### Phase 6 — Author dashboard polish
- map-first EOC layout
- user database/messaging integration

### Phase 7 — User dashboard polish
- visually consistent citizen portal
- incident progress
- confirmation
- messages/history

### Phase 8 — documentation and final validation
- README
- DSA mapping doc
- architecture notes
- screenshots if appropriate
- remove dead code
- test all flows

---

## 16. Validation

Run after relevant phases:

```bash
npm run typecheck
npm run build
cmake --build backend/build
ctest --test-dir backend/build --output-on-failure
```

Do not reduce passing tests merely to make refactoring easier.

Add focused tests for any new DSA integration and lifecycle/bridge behavior.

Manual end-to-end validation:
- Author login/reset
- User register/login/reset
- User report emergency
- Author receives incident
- process next
- responder assigned
- route visualized
- response completed
- user YES closes/removes active marker
- user NO escalates/requeues
- direct user message
- broadcast message
- multiple simultaneous incidents
- BFS/DFS/Dijkstra map visualization

---

## 17. Codex working rules

Before editing, print:
1. current branch
2. latest commit
3. baseline test results
4. files likely to change
5. DSA requirement-to-feature mapping
6. features proposed for removal and why

Do not make a huge rewrite in one commit.

Use small coherent commits, for example:
- fix bridge and password reset
- refactor DSA architecture
- add tactical city data
- implement tactical map
- integrate algorithm animation
- redesign dashboards
- documentation/tests

After each phase rerun relevant tests.

Do not modify `main` directly.

Do not commit secrets or `.env`.

If an existing feature conflicts with this brief, preserve core emergency product behavior and teacher-required DSA first.
