#pragma once

#include "graph/Graph.hpp"
#include <string>
#include <vector>

namespace crisismesh {

enum class DijkstraEventType {
    START, SOURCE_SELECTED, NODE_EXTRACTED, NODE_VISITED, EDGE_EXAMINED,
    DISTANCE_CHECKED, EDGE_RELAXED, DISTANCE_UPDATED, PREDECESSOR_UPDATED,
    DESTINATION_REACHED, PATH_RECONSTRUCTION, PATH_EDGE_SELECTED, COMPLETE,
    UNREACHABLE, SOURCE_EQUALS_DESTINATION
};

struct DijkstraEvent {
    DijkstraEventType type;
    std::string nodeId;
    std::string edgeId;
    std::string fromNodeId;
    std::string toNodeId;
    double currentDistance{-1.0};
    double oldDistance{-1.0};
    double candidateDistance{-1.0};
    double edgeCost{0.0};
    std::size_t queueSize{0};
    std::size_t visitedCount{0};
    std::string message;
};

struct DijkstraResult {
    bool reachable{false};
    bool sourceEqualsDestination{false};
    double totalCost{0.0};
    double totalDistance{0.0};
    double totalTravelTime{0.0};
    std::vector<std::string> pathNodes;
    std::vector<std::string> pathEdges;
    std::size_t nodesExplored{0};
    std::vector<DijkstraEvent> events;
};

struct WeightConfig {
    double distanceWeight{1.0};
    double travelTimeWeight{0.35};
    double riskWeight{0.75};
    double congestionWeight{0.45};
    double capacityPenaltyWeight{0.03};
};

class Dijkstra {
public:
    explicit Dijkstra(WeightConfig config = {});
    double edgeCost(const Edge& edge) const;

    DijkstraResult run(const Graph& graph,
                       const std::string& source,
                       const std::string& destination) const;

private:
    WeightConfig config_;
};

const char* toString(DijkstraEventType type);

} // namespace crisismesh
