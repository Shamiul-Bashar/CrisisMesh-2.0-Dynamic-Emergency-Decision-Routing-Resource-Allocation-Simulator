#include "graph/CityData.hpp"

#include <cassert>
#include <iostream>

using namespace crisismesh;

int main() {
    Graph graph = createCrisisMeshCity();

    assert(graph.getVertexCount() == 24);
    assert(graph.getEdgeCount() == 42);
    assert(graph.vertexExists("LOC-001"));
    assert(graph.edgeExists("R-005"));
    assert(graph.getVertex("LOC-999") == nullptr);
    assert(graph.getEdge("R-999") == nullptr);
    assert(!graph.isBlocked("R-005"));

    const auto neighbors = graph.getNeighbors("LOC-001");
    assert(!neighbors.empty());

    assert(graph.blockEdge("R-005"));
    assert(graph.isBlocked("R-005"));
    assert(graph.unblockEdge("R-005"));
    assert(!graph.isBlocked("R-005"));

    assert(!graph.addVertex(Vertex{"LOC-001", "Duplicate", LocationType::Hospital, {0,0}, "OPERATIONAL"}));
    assert(!graph.addEdge(Edge{"R-005","LOC-001","LOC-020",1,1,1,1,100,false}));
    assert(!graph.addEdge(Edge{"BAD-001","LOC-001","LOC-999",1,1,1,1,100,false}));
    assert(!graph.blockEdge("R-999"));

    std::cout << "Graph test: PASSED\n";
    std::cout << "Vertices: " << graph.getVertexCount() << "\n";
    std::cout << "Edges: " << graph.getEdgeCount() << "\n";
    std::cout << "Neighbors(LOC-001): " << neighbors.size() << "\n";
    return 0;
}
