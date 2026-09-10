#pragma once
#include "core/AlgorithmEvent.hpp"
#include "graph/Graph.hpp"
namespace crisismesh { class DFS { public: TraversalResult run(const Graph& graph,const std::string& source,const std::string& destination) const; }; }
