#pragma once
#include "core/AlgorithmEvent.hpp"
#include "graph/Graph.hpp"
namespace crisismesh {

// ================================================================
// DSA: Depth-First Search (DFS)
// CrisisMesh role:
// DFS examines a route or graph branch deeply before backtracking. It is used as
// an educational traversal mechanism alongside BFS and Dijkstra.
//
// Why it matters:
// DFS is part of the project’s DSA visibility and makes the graph traversal
// family explicit for academic explanations and visual trace output.
// Time complexity: O(V + E)
// Space complexity: O(V)
// ================================================================
class DFS { public: TraversalResult run(const Graph& graph,const std::string& source,const std::string& destination) const; };
}
