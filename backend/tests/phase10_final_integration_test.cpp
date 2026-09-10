#include "simulation/SimulationEngine.hpp"
#include <algorithm>
#include <cassert>
#include <iostream>

using namespace crisismesh;

int main() {
    SimulationEngine engine;

    const auto a = engine.reportEmergency(IncidentType::Medical, "LOC-010", 2, 2, 1, "Phase 10 medical intake");
    const auto b = engine.reportEmergency(IncidentType::Fire, "LOC-007", 5, 5, 8, "Phase 10 fire priority");
    const auto c = engine.reportEmergency(IncidentType::Police, "LOC-022", 3, 4, 2, "Phase 10 police intake");

    assert(engine.findIncident(a.incidentId));
    assert(engine.findIncident(b.incidentId));
    assert(engine.findIncident(c.incidentId));

    const auto first = engine.processNextIncident();
    assert(first.success);
    assert(first.incident.incidentId == b.incidentId);
    assert(first.route.reachable);
    assert(!first.route.pathEdges.empty());
    assert(first.incident.status == IncidentStatus::EnRoute);

    const auto blockedEdge = first.route.pathEdges.front();
    assert(engine.blockRoad(blockedEdge));
    const auto* rerouted = engine.findIncident(b.incidentId);
    assert(rerouted);
    assert(rerouted->status == IncidentStatus::EnRoute || rerouted->status == IncidentStatus::Unreachable);
    const auto& eventsAfterBlock = engine.events();
    const auto rerouteRequiredIt = std::find_if(eventsAfterBlock.begin(), eventsAfterBlock.end(), [](const AlgorithmEvent& e) {
        return e.type == "REROUTE_REQUIRED";
    });
    assert(rerouteRequiredIt != eventsAfterBlock.end());
    assert(rerouteRequiredIt->status == "REROUTE_REQUIRED");
    assert(std::any_of(eventsAfterBlock.begin(), eventsAfterBlock.end(), [](const AlgorithmEvent& e) {
        return e.type == "REROUTE_CALCULATED" || e.type == "DESTINATION_UNREACHABLE";
    }));

    assert(engine.unblockRoad(blockedEdge));
    assert(engine.resolveIncident(b.incidentId));
    assert(engine.findIncident(b.incidentId)->status == IncidentStatus::Closed);

    const auto second = engine.processNextIncident();
    assert(second.success || second.incident.status == IncidentStatus::WaitingForResource);
    if (second.success) assert(engine.resolveIncident(second.incident.incidentId));

    const auto third = engine.processNextIncident();
    assert(third.success || third.incident.status == IncidentStatus::WaitingForResource);
    if (third.success) assert(engine.resolveIncident(third.incident.incidentId));

    const auto finalState = engine.stateToJson();
    assert(finalState.find("\"queue\":{\"size\":0") != std::string::npos);
    assert(finalState.find("\"priorityHeap\":{\"size\":0") != std::string::npos);
    assert(finalState.find("\"history\":{\"size\":") != std::string::npos);

    engine.reset();
    const auto resetState = engine.stateToJson();
    assert(resetState.find("\"incidents\":[]") != std::string::npos);
    assert(resetState.find("\"blockedRoads\":0") != std::string::npos);
    assert(resetState.find("\"history\":{\"size\":0") != std::string::npos);

    std::cout << "Phase 10 final integration test: PASS\n";
    return 0;
}
