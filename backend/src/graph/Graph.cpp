#include "graph/Graph.hpp"

#include <algorithm>
#include <stdexcept>

namespace crisismesh {

bool Graph::containsEdgeId(const std::vector<std::string>& ids, const std::string& edgeId) {
    return std::find(ids.begin(), ids.end(), edgeId) != ids.end();
}

bool Graph::addVertex(const Vertex& vertex) {
    if (vertex.id.empty() || vertexExists(vertex.id)) {
        return false;
    }
    vertices_.emplace(vertex.id, vertex);
    adjacency_.emplace(vertex.id, std::vector<std::string>{});
    return true;
}

bool Graph::removeVertex(const std::string& vertexId) {
    auto it = vertices_.find(vertexId);
    if (it == vertices_.end()) {
        return false;
    }

    const auto incident = adjacency_.at(vertexId);
    for (const auto& edgeId : incident) {
        removeEdge(edgeId);
    }

    adjacency_.erase(vertexId);
    vertices_.erase(it);
    return true;
}

bool Graph::addEdge(const Edge& edge) {
    if (edge.id.empty() || edge.from.empty() || edge.to.empty()) {
        return false;
    }
    if (edge.from == edge.to || edgeExists(edge.id)) {
        return false;
    }
    if (!vertexExists(edge.from) || !vertexExists(edge.to)) {
        return false;
    }

    edges_.emplace(edge.id, edge);
    adjacency_.at(edge.from).push_back(edge.id);
    adjacency_.at(edge.to).push_back(edge.id);
    return true;
}

bool Graph::removeEdge(const std::string& edgeId) {
    auto it = edges_.find(edgeId);
    if (it == edges_.end()) {
        return false;
    }

    const Edge edge = it->second;
    auto eraseFrom = [&](const std::string& vertexId) {
        auto& list = adjacency_.at(vertexId);
        list.erase(std::remove(list.begin(), list.end(), edgeId), list.end());
    };

    eraseFrom(edge.from);
    eraseFrom(edge.to);
    edges_.erase(it);
    return true;
}

const Vertex* Graph::getVertex(const std::string& vertexId) const {
    const auto it = vertices_.find(vertexId);
    return it == vertices_.end() ? nullptr : &it->second;
}

const Edge* Graph::getEdge(const std::string& edgeId) const {
    const auto it = edges_.find(edgeId);
    return it == edges_.end() ? nullptr : &it->second;
}

std::vector<Edge> Graph::getIncidentEdges(const std::string& vertexId) const {
    std::vector<Edge> result;
    const auto it = adjacency_.find(vertexId);
    if (it == adjacency_.end()) {
        return result;
    }

    result.reserve(it->second.size());
    for (const auto& edgeId : it->second) {
        const auto edgeIt = edges_.find(edgeId);
        if (edgeIt != edges_.end()) {
            result.push_back(edgeIt->second);
        }
    }
    return result;
}

std::vector<Edge> Graph::getNeighbors(const std::string& vertexId) const {
    std::vector<Edge> result;
    for (const auto& edge : getIncidentEdges(vertexId)) {
        result.push_back(edge);
    }
    return result;
}

bool Graph::vertexExists(const std::string& vertexId) const {
    return vertices_.find(vertexId) != vertices_.end();
}

bool Graph::edgeExists(const std::string& edgeId) const {
    return edges_.find(edgeId) != edges_.end();
}

bool Graph::blockEdge(const std::string& edgeId) {
    auto it = edges_.find(edgeId);
    if (it == edges_.end()) {
        return false;
    }
    it->second.blocked = true;
    return true;
}

bool Graph::unblockEdge(const std::string& edgeId) {
    auto it = edges_.find(edgeId);
    if (it == edges_.end()) {
        return false;
    }
    it->second.blocked = false;
    return true;
}

bool Graph::isBlocked(const std::string& edgeId) const {
    const auto edge = getEdge(edgeId);
    if (!edge) {
        throw std::out_of_range("Unknown edge: " + edgeId);
    }
    return edge->blocked;
}

std::size_t Graph::getVertexCount() const {
    return vertices_.size();
}

std::size_t Graph::getEdgeCount() const {
    return edges_.size();
}

std::size_t Graph::getOpenEdgeCount() const {
    std::size_t count = 0;
    for (const auto& [id, edge] : edges_) {
        (void)id;
        if (!edge.blocked) {
            ++count;
        }
    }
    return count;
}

std::size_t Graph::getBlockedEdgeCount() const {
    return getEdgeCount() - getOpenEdgeCount();
}

} // namespace crisismesh
