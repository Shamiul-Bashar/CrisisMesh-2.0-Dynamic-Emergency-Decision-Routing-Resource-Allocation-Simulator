#pragma once
#include "core/AlgorithmEvent.hpp"
#include "graph/Graph.hpp"
namespace crisismesh {

// DSA: Breadth-First Search (BFS)
// Operational role: finds minimum-hop reachability across open city roads.
// Why it matters: the manual Queue expands the emergency network layer by layer.
// Time complexity: O(V + E) average with hash-based discovery tracking.
// Space complexity: O(V).
class BFS {
public:
    TraversalResult run(const Graph& graph,const std::string& source,const std::string& destination) const;
};
}
