#pragma once
#include <string>
#include <vector>

namespace crisismesh {

struct AlgorithmEvent {
    std::string type;
    std::string algorithm;
    std::size_t step{0};
    std::string nodeId;
    std::string edgeId;
    std::string parentNodeId;
    std::size_t queueSize{0};
    std::size_t stackSize{0};
    std::size_t visitedCount{0};
    std::size_t size{0};
    std::size_t bucket{0};
    std::size_t collisionCount{0};
    std::string key;
    std::string value;
    std::string message;
    // Phase 5 domain-event extensions. Existing Phase 3/4 fields remain unchanged.
    int priority{0};
    double value1{0.0};
    double value2{0.0};
    std::string responderId;
    std::string status;
    std::vector<std::string> pathNodes;
    std::vector<std::string> pathEdges;
};

struct TraversalResult {
    bool reachable{false};
    bool sourceEqualsDestination{false};
    std::vector<std::string> visitOrder;
    std::vector<std::string> pathNodes;
    std::vector<std::string> pathEdges;
    std::vector<AlgorithmEvent> events;
};

const char* algorithmEventType(const AlgorithmEvent& event);
std::string algorithmEventsToJson(const TraversalResult& result,
                                  const std::string& source,
                                  const std::string& destination,
                                  const std::string& algorithm);

} // namespace crisismesh
