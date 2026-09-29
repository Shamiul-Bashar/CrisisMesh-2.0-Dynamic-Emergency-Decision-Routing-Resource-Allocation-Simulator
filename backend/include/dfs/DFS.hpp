#pragma once
#include "core/AlgorithmEvent.hpp"
#include "graph/Graph.hpp"
namespace crisismesh {

// DSA: Depth-First Search (DFS)
// Operational role: explores open roads deeply with the manual Stack.
// Why it matters: reachability and explicit dead-end events support route inspection.
// Time complexity: O(V + E) average with hash-based discovery tracking.
// Space complexity: O(V + E), including cached adjacency and trace events.
class DFS { public: TraversalResult run(const Graph& graph,const std::string& source,const std::string& destination) const; };
}
