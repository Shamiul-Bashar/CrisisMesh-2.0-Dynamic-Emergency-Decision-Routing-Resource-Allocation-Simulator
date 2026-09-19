#include "dijkstra/Dijkstra.hpp"
#include "dijkstra/MinHeap.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>

namespace crisismesh {

Dijkstra::Dijkstra(WeightConfig config) : config_(config) {}

double Dijkstra::edgeCost(const Edge& edge) const {
    if (edge.blocked) return std::numeric_limits<double>::infinity();

    // Default emergency-operational cost:
    // physical distance + travel-time burden + risk + congestion.
    // Low capacity adds a small penalty without dominating route choice.
    const double capacityPenalty = std::max(0, 70 - edge.capacity);
    return config_.distanceWeight * edge.distance
         + config_.travelTimeWeight * edge.travelTime
         + config_.riskWeight * edge.riskLevel
         + config_.congestionWeight * edge.congestionLevel
         + config_.capacityPenaltyWeight * capacityPenalty;
}

DijkstraResult Dijkstra::run(const Graph& graph,
                             const std::string& source,
                             const std::string& destination) const {
    DijkstraResult result;
    result.events.push_back({DijkstraEventType::START, "", "", "", "", -1, -1, -1, 0, 0, 0, "Dijkstra execution started"});

    if (!graph.vertexExists(source) || !graph.vertexExists(destination)) {
        throw std::invalid_argument("Source or destination vertex does not exist");
    }

    result.events.push_back({DijkstraEventType::SOURCE_SELECTED, source, "", "", "", 0.0, -1, 0.0, 0, 1, 0, "Source selected"});
    if (source == destination) {
        result.sourceEqualsDestination = true;
        result.reachable = true;
        result.pathNodes = {source};
        result.totalCost = 0.0;
        result.nodesExplored = 1;
        result.events.push_back({DijkstraEventType::SOURCE_EQUALS_DESTINATION, source, "", "", "", 0.0, 0.0, 0.0, 0, 1, 1, "Source and destination are identical"});
        result.events.push_back({DijkstraEventType::COMPLETE, source, "", "", "", 0.0, 0.0, 0.0, 0, 1, 1, "Path complete"});
        return result;
    }

    constexpr double INF = std::numeric_limits<double>::infinity();
    std::unordered_map<std::string, double> distance;
    std::unordered_map<std::string, std::string> predecessorNode;
    std::unordered_map<std::string, std::string> predecessorEdge;
    std::unordered_set<std::string> visited;

    for (const auto& [id, vertex] : graph.vertices()) {
        (void)vertex;
        distance[id] = INF;
    }
    distance[source] = 0.0;

    MinHeap queue;
    queue.push({source, 0.0});

    while (!queue.empty()) {
        const auto item = queue.pop();
        const auto known = distance[item.nodeId];
        if (item.priority > known + 1e-9) continue;
        if (visited.count(item.nodeId)) continue;

        result.events.push_back({DijkstraEventType::NODE_EXTRACTED, item.nodeId, "", "", "",
                                 known, known, known, 0, queue.size(), result.nodesExplored, "Node extracted from priority queue"});
        if (item.nodeId == destination) {
            result.events.push_back({DijkstraEventType::DESTINATION_REACHED, item.nodeId, "", "", "",
                                     known, known, known, 0, queue.size(), result.nodesExplored, "Destination reached"});
            break;
        }

        visited.insert(item.nodeId);
        ++result.nodesExplored;
        result.events.push_back({DijkstraEventType::NODE_VISITED, item.nodeId, "", "", "",
                                 known, known, known, 0, queue.size(), result.nodesExplored, "Node marked visited"});

        for (const auto& edge : graph.getIncidentEdges(item.nodeId)) {
            if (edge.blocked) continue;

            const std::string neighbor = edge.from == item.nodeId ? edge.to : edge.from;
            const double cost = edgeCost(edge);
            const double candidate = known + cost;
            const double old = distance[neighbor];

            result.events.push_back({DijkstraEventType::EDGE_EXAMINED, item.nodeId, edge.id, item.nodeId, neighbor,
                                     known, old == INF ? -1.0 : old, candidate, cost, queue.size(), result.nodesExplored, "Examining road"});
            result.events.push_back({DijkstraEventType::DISTANCE_CHECKED, neighbor, edge.id, item.nodeId, neighbor,
                                     old == INF ? -1.0 : old, old == INF ? -1.0 : old, candidate, cost, queue.size(), result.nodesExplored,
                                     candidate < old ? "Candidate improves distance" : "Candidate does not improve distance"});

            if (candidate + 1e-9 < old) {
                distance[neighbor] = candidate;
                predecessorNode[neighbor] = item.nodeId;
                predecessorEdge[neighbor] = edge.id;
                queue.push({neighbor, candidate});

                result.events.push_back({DijkstraEventType::EDGE_RELAXED, neighbor, edge.id, item.nodeId, neighbor,
                                         known, old == INF ? -1.0 : old, candidate, cost, queue.size(), result.nodesExplored, "Edge relaxed"});
                result.events.push_back({DijkstraEventType::DISTANCE_UPDATED, neighbor, edge.id, item.nodeId, neighbor,
                                         candidate, old == INF ? -1.0 : old, candidate, cost, queue.size(), result.nodesExplored, "Distance updated"});
                result.events.push_back({DijkstraEventType::PREDECESSOR_UPDATED, neighbor, edge.id, item.nodeId, neighbor,
                                         candidate, old == INF ? -1.0 : old, candidate, cost, queue.size(), result.nodesExplored, "Predecessor updated"});
            }
        }
    }

    if (!std::isfinite(distance[destination])) {
        result.events.push_back({DijkstraEventType::UNREACHABLE, destination, "", "", "",
                                 -1.0, -1.0, -1.0, 0, queue.size(), result.nodesExplored, "Destination unreachable"});
        result.events.push_back({DijkstraEventType::COMPLETE, destination, "", "", "",
                                 -1.0, -1.0, -1.0, 0, queue.size(), result.nodesExplored, "Execution complete: unreachable"});
        return result;
    }

    result.reachable = true;
    result.totalCost = distance[destination];

    result.events.push_back({DijkstraEventType::PATH_RECONSTRUCTION, destination, "", "", "",
                             distance[destination], distance[destination], distance[destination], 0, queue.size(), result.nodesExplored,
                             "Reconstructing predecessor chain"});

    std::string current = destination;
    while (current != source) {
        result.pathNodes.push_back(current);
        const auto edgeIt = predecessorEdge.find(current);
        const auto nodeIt = predecessorNode.find(current);
        if (edgeIt == predecessorEdge.end() || nodeIt == predecessorNode.end()) {
            result.reachable = false;
            result.pathNodes.clear();
            result.pathEdges.clear();
            result.events.push_back({DijkstraEventType::UNREACHABLE, destination, "", "", "",
                                     -1.0, -1.0, -1.0, 0, queue.size(), result.nodesExplored, "Predecessor chain incomplete"});
            return result;
        }
        result.pathEdges.push_back(edgeIt->second);
        result.events.push_back({DijkstraEventType::PATH_EDGE_SELECTED, current, edgeIt->second,
                                 nodeIt->second, current, distance[current], distance[current], distance[current], 0,
                                 queue.size(), result.nodesExplored, "Path edge selected"});
        current = nodeIt->second;
    }
    result.pathNodes.push_back(source);
    std::reverse(result.pathNodes.begin(), result.pathNodes.end());
    std::reverse(result.pathEdges.begin(), result.pathEdges.end());

    for (const auto& edgeId : result.pathEdges) {
        const auto* edge = graph.getEdge(edgeId);
        if (edge) {
            result.totalDistance += edge->distance;
            result.totalTravelTime += edge->travelTime;
        }
    }

    result.events.push_back({DijkstraEventType::COMPLETE, destination, "", "", "",
                             result.totalCost, result.totalCost, result.totalCost, 0, queue.size(), result.nodesExplored, "Optimal path confirmed"});
    return result;
}

const char* toString(DijkstraEventType type) {
    switch (type) {
        case DijkstraEventType::START: return "START";
        case DijkstraEventType::SOURCE_SELECTED: return "SOURCE_SELECTED";
        case DijkstraEventType::NODE_EXTRACTED: return "NODE_EXTRACTED";
        case DijkstraEventType::NODE_VISITED: return "NODE_VISITED";
        case DijkstraEventType::EDGE_EXAMINED: return "EDGE_EXAMINED";
        case DijkstraEventType::DISTANCE_CHECKED: return "DISTANCE_CHECKED";
        case DijkstraEventType::EDGE_RELAXED: return "EDGE_RELAXED";
        case DijkstraEventType::DISTANCE_UPDATED: return "DISTANCE_UPDATED";
        case DijkstraEventType::PREDECESSOR_UPDATED: return "PREDECESSOR_UPDATED";
        case DijkstraEventType::DESTINATION_REACHED: return "DESTINATION_REACHED";
        case DijkstraEventType::PATH_RECONSTRUCTION: return "PATH_RECONSTRUCTION";
        case DijkstraEventType::PATH_EDGE_SELECTED: return "PATH_EDGE_SELECTED";
        case DijkstraEventType::COMPLETE: return "COMPLETE";
        case DijkstraEventType::UNREACHABLE: return "UNREACHABLE";
        case DijkstraEventType::SOURCE_EQUALS_DESTINATION: return "SOURCE_EQUALS_DESTINATION";
    }
    return "UNKNOWN";
}

} // namespace crisismesh
