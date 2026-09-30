#include "array/OperationalArray.hpp"
#include "bfs/BFS.hpp"
#include "dfs/DFS.hpp"
#include "graph/CityData.hpp"
#include "simulation/SimulationEngine.hpp"
#include "sort/CandidateMergeSort.hpp"
#include "tree/IncidentArchiveIndex.hpp"

#include <algorithm>
#include <cassert>
#include <iostream>

using namespace crisismesh;

int main() {
    OperationalArray<int, 2> bounded;
    assert(bounded.pushBack(10) && bounded.pushBack(20));
    assert(!bounded.pushBack(30) && bounded.at(1) == 20);

    IncidentArchiveIndex avl;
    assert(avl.insert({3, "INC-3", "CLOSED"}));
    assert(avl.insert({2, "INC-2", "CLOSED"}));
    assert(avl.insert({1, "INC-1", "CLOSED"}));
    assert(avl.isBalanced() && avl.search(2)->incidentId == "INC-2");
    const auto orderedArchive = avl.inorder();
    assert(orderedArchive.front().reportedSequence == 1 && orderedArchive.back().reportedSequence == 3);

    std::vector<ResponderCandidateSummary> summaries{
        {"R-B", true, 7.0, 3.0, 4.0}, {"R-C", false, 0.0, 0.0, 0.0},
        {"R-A", true, 7.0, 3.0, 4.0}, {"R-D", true, 4.0, 5.0, 5.0}
    };
    mergeSortCandidates(summaries);
    assert(summaries[0].responderId == "R-D");
    assert(summaries[1].responderId == "R-A");
    assert(!summaries.back().reachable);

    Graph graph = createCrisisMeshCity();
    BFS bfs;
    const auto breadth = bfs.run(graph, "LOC-003", "LOC-007");
    assert(breadth.reachable && breadth.pathNodes.front() == "LOC-003" && breadth.pathNodes.back() == "LOC-007");
    assert(std::any_of(breadth.events.begin(), breadth.events.end(), [](const AlgorithmEvent& event) { return event.type == "BFS_ENQUEUE"; }));

    for (const auto& edge : graph.getIncidentEdges("LOC-007")) graph.blockEdge(edge.id);
    DFS dfs;
    const auto depth = dfs.run(graph, "LOC-003", "LOC-007");
    assert(!depth.reachable);
    assert(std::any_of(depth.events.begin(), depth.events.end(), [](const AlgorithmEvent& event) { return event.type == "DFS_BACKTRACK"; }));

    SimulationEngine engine;
    assert(engine.locationDirectory().find("LOC-010") != nullptr);
    const auto low = engine.reportEmergency(IncidentType::Fire, "LOC-007", 1, 1, 0, "low");
    const auto high = engine.reportEmergency(IncidentType::Fire, "LOC-010", 5, 5, 4, "high");
    const auto fifo = engine.intakeIncidentIds();
    assert(fifo.size() == 2 && fifo[0] == low.incidentId && fifo[1] == high.incidentId);
    assert(engine.findIncident(high.incidentId) == &engine.incidents()[1]);

    const auto dispatch = engine.processNextIncident();
    assert(dispatch.success && dispatch.incident.incidentId == high.incidentId);
    const auto& ranked = engine.lastCandidateSummaries();
    assert(!ranked.empty() && ranked.front().reachable && ranked.front().responderId == dispatch.responder.responderId);
    assert(engine.resolveIncident(high.incidentId));
    assert(engine.archiveIndex().search(high.reportedSequence) != nullptr);
    assert(engine.archiveIndex().isBalanced());
    assert(!engine.historyEntries().empty());

    assert(engine.blockRoad("R-001"));
    assert(engine.blockRoad("R-002"));
    assert(engine.undoLastRoadBlock());
    assert(engine.graph().isBlocked("R-001") && !engine.graph().isBlocked("R-002"));

    std::cout << "Operational DSA integration test: PASS\n";
}
