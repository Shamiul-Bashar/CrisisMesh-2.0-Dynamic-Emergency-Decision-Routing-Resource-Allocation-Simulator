#pragma once
#include "core/AlgorithmEvent.hpp"
#include "graph/Graph.hpp"
namespace crisismesh {

// ================================================================
// DSA: Breadth-First Search (BFS)
// CrisisMesh role:
// BFS is used as a graph exploration and shortest-hop demonstration for the
// city network. It is particularly relevant for reachability checks and layered
// propagation across adjacent locations.
//
// Why it matters:
// BFS helps demonstrate how network exploration expands in distance order from
// a source node, which is useful for understanding road connectivity and route
// feasibility in a controlled academic simulation.
// Time complexity: O(V + E)
// Space complexity: O(V)
// ================================================================
class BFS {
public:
    TraversalResult run(const Graph& graph,const std::string& source,const std::string& destination) const;
};
}
