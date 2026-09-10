#pragma once

#include "graph/Edge.hpp"
#include "graph/Vertex.hpp"
#include <string>
#include <unordered_map>
#include <vector>

namespace crisismesh {

// ================================================================
// DSA: Graph (adjacency-list representation)
// CrisisMesh role:
// The graph models the city road network as vertices and weighted roads.
// Dispatch, rerouting, responder reachability, and road-block analysis all
// depend on this authoritative topology.
//
// Why it matters:
// A graph is the backbone of emergency routing. Every node represents a city
// location, and each edge represents an operational road with cost, capacity,
// and congestion metadata.
// ================================================================
class Graph {
public:
    bool addVertex(const Vertex& vertex);
    bool removeVertex(const std::string& vertexId);

    bool addEdge(const Edge& edge);
    bool removeEdge(const std::string& edgeId);

    const Vertex* getVertex(const std::string& vertexId) const;
    const Edge* getEdge(const std::string& edgeId) const;

    std::vector<Edge> getNeighbors(const std::string& vertexId) const;
    std::vector<Edge> getIncidentEdges(const std::string& vertexId) const;

    bool vertexExists(const std::string& vertexId) const;
    bool edgeExists(const std::string& edgeId) const;

    bool blockEdge(const std::string& edgeId);
    bool unblockEdge(const std::string& edgeId);
    bool isBlocked(const std::string& edgeId) const;

    std::size_t getVertexCount() const;
    std::size_t getEdgeCount() const;
    std::size_t getOpenEdgeCount() const;
    std::size_t getBlockedEdgeCount() const;

    const std::unordered_map<std::string, Vertex>& vertices() const { return vertices_; }
    const std::unordered_map<std::string, Edge>& edges() const { return edges_; }

private:
    std::unordered_map<std::string, Vertex> vertices_;
    std::unordered_map<std::string, Edge> edges_;
    std::unordered_map<std::string, std::vector<std::string>> adjacency_;

    static bool containsEdgeId(const std::vector<std::string>& ids, const std::string& edgeId);
};

} // namespace crisismesh
