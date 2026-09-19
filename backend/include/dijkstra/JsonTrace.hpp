#pragma once

#include "dijkstra/Dijkstra.hpp"
#include <string>

namespace crisismesh {
std::string resultToJson(const DijkstraResult& result,
                         const std::string& source,
                         const std::string& destination,
                         const Graph& graph);
}
