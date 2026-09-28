#include "dijkstra/Dijkstra.hpp"
#include "dijkstra/JsonTrace.hpp"
#include "graph/CityData.hpp"
#include "utils/Constants.hpp"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

using namespace crisismesh;

int main(int argc, char** argv) {
    try {
        Graph graph = createCrisisMeshCity();

        std::cout << "CRISISMESH C++ DSA ENGINE\n";
        std::cout << "=========================\n\n";
        std::cout << "Graph initialized.\n";
        std::cout << "Vertices: " << graph.getVertexCount() << "\n";
        std::cout << "Edges: " << graph.getEdgeCount() << "\n\n";

        std::cout << "Vertex LOC-001: " << (graph.getVertex("LOC-001") ? "FOUND" : "MISSING") << "\n";
        std::cout << "Road R-005: " << (graph.getEdge("R-005") ? "FOUND" : "MISSING") << "\n\n";

        std::cout << "Neighbors of LOC-001:\n";
        for (const auto& edge : graph.getNeighbors("LOC-001")) {
            const std::string neighbor = edge.from == "LOC-001" ? edge.to : edge.from;
            std::cout << "  " << edge.id << " -> " << neighbor
                      << " (" << edge.distance << " km)\n";
        }

        std::cout << "\nRoad R-005:\n";
        std::cout << "Status: " << (graph.isBlocked("R-005") ? "BLOCKED" : "OPEN") << "\n";
        std::cout << "Blocking R-005...\n";
        graph.blockEdge("R-005");
        std::cout << "Status: " << (graph.isBlocked("R-005") ? "BLOCKED" : "OPEN") << "\n";
        std::cout << "Unblocking R-005...\n";
        graph.unblockEdge("R-005");
        std::cout << "Status: " << (graph.isBlocked("R-005") ? "BLOCKED" : "OPEN") << "\n";

        std::cout << "\nInvalid lookup checks:\n";
        std::cout << "Vertex LOC-999: " << (graph.getVertex("LOC-999") ? "FOUND" : "NOT FOUND") << "\n";
        std::cout << "Road R-999: " << (graph.getEdge("R-999") ? "FOUND" : "NOT FOUND") << "\n";

        Dijkstra dijkstra;
        const auto result = dijkstra.run(graph, constants::DEFAULT_DIJKSTRA_SOURCE,
                                         constants::DEFAULT_DIJKSTRA_DESTINATION);
        std::cout << "\nDijkstra smoke test: "
                  << (result.reachable ? "REACHABLE" : "UNREACHABLE")
                  << ", events=" << result.events.size()
                  << ", path nodes=" << result.pathNodes.size() << "\n";

        if (argc > 1 && std::string(argv[1]) == "--json") {
            const auto json = resultToJson(result,
                                           constants::DEFAULT_DIJKSTRA_SOURCE,
                                           constants::DEFAULT_DIJKSTRA_DESTINATION,
                                           graph);
            std::filesystem::path executablePath = std::filesystem::absolute(argv[0]);
            std::filesystem::path projectRoot = executablePath.parent_path().parent_path().parent_path();
            std::filesystem::path outputPath = projectRoot / "src" / "data" / "dijkstra-events.json";
            std::filesystem::create_directories(outputPath.parent_path());
            std::ofstream out(outputPath);
            if (!out) throw std::runtime_error("Could not write frontend trace file: " + outputPath.string());
            out << json << "\n";
            std::cout << "Wrote " << outputPath.string() << "\n";
        }

        std::cout << "\nGraph foundation test: PASSED\n";
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "ENGINE ERROR: " << ex.what() << '\n';
        return 1;
    }
}
