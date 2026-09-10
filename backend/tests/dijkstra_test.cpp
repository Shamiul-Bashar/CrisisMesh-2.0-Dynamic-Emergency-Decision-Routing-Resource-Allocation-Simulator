#include "dijkstra/Dijkstra.hpp"
#include "graph/CityData.hpp"

#include <cassert>
#include <iostream>

using namespace crisismesh;

int main() {
    {
        Graph graph = createCrisisMeshCity();
        Dijkstra dijkstra;
        auto result = dijkstra.run(graph, "LOC-003", "LOC-007");
        assert(result.reachable);
        assert(!result.pathNodes.empty());
        assert(result.pathNodes.front() == "LOC-003");
        assert(result.pathNodes.back() == "LOC-007");
        assert(!result.pathEdges.empty());
        assert(!result.events.empty());
    }

    {
        Graph graph = createCrisisMeshCity();
        Dijkstra dijkstra;
        const auto baseline = dijkstra.run(graph, "LOC-003", "LOC-007");
        assert(baseline.reachable);
        assert(!baseline.pathEdges.empty());

        // R-019 is on the verified default route. Blocking it should force
        // Dijkstra to choose another valid path if one remains available.
        graph.blockEdge("R-019");
        const auto rerouted = dijkstra.run(graph, "LOC-003", "LOC-007");
        assert(rerouted.reachable);
        assert(rerouted.pathEdges != baseline.pathEdges);
        for (const auto& id : rerouted.pathEdges) {
            assert(!graph.isBlocked(id));
        }
    }

    {
        Graph graph = createCrisisMeshCity();
        Dijkstra dijkstra;
        auto result = dijkstra.run(graph, "LOC-003", "LOC-003");
        assert(result.reachable);
        assert(result.sourceEqualsDestination);
        assert(result.pathNodes.size() == 1);
    }

    {
        Graph graph = createCrisisMeshCity();
        // Isolate destination LOC-007 by blocking all of its incident roads.
        for (const auto& edge : graph.getIncidentEdges("LOC-007")) {
            graph.blockEdge(edge.id);
        }
        Dijkstra dijkstra;
        auto result = dijkstra.run(graph, "LOC-003", "LOC-007");
        assert(!result.reachable);
        assert(!result.events.empty());
    }

    {
        Graph graph = createCrisisMeshCity();
        Dijkstra dijkstra;
        bool threw = false;
        try {
            (void)dijkstra.run(graph, "LOC-999", "LOC-007");
        } catch (...) {
            threw = true;
        }
        assert(threw);
    }

    std::cout << "Dijkstra tests: PASSED\n";
    return 0;
}
