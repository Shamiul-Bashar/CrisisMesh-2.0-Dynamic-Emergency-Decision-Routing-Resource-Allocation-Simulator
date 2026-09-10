#include "simulation/SimulationEngine.hpp"
#include <algorithm>
#include <cassert>
#include <iostream>

using namespace crisismesh;

int main() {
    SimulationEngine engine;

    const auto first = engine.reportEmergency(IncidentType::Medical, "LOC-010", 2, 2, 1, "Low priority medical request");
    const auto second = engine.reportEmergency(IncidentType::Fire, "LOC-007", 5, 5, 8, "Critical market fire");
    const auto third = engine.reportEmergency(IncidentType::Police, "LOC-022", 3, 4, 2, "Police assistance request");

    const auto intakeState = engine.stateToJson();
    assert(intakeState.find("\"queue\":{\"size\":3") != std::string::npos);
    assert(intakeState.find(first.incidentId) != std::string::npos);
    assert(intakeState.find(second.incidentId) != std::string::npos);
    assert(intakeState.find(third.incidentId) != std::string::npos);
    assert(intakeState.find("\"pendingIncidents\"") != std::string::npos);

    const auto dispatch = engine.processNextIncident();
    assert(dispatch.success);
    assert(dispatch.incident.incidentId == second.incidentId);
    assert(dispatch.incident.status == IncidentStatus::EnRoute);
    assert(!dispatch.responder.responderId.empty());
    assert(dispatch.route.reachable);
    assert(!dispatch.route.pathEdges.empty());

    const auto routeEdge = dispatch.route.pathEdges.front();
    assert(engine.blockRoad(routeEdge));
    const auto* afterBlock = engine.findIncident(second.incidentId);
    assert(afterBlock);
    assert(afterBlock->status == IncidentStatus::EnRoute || afterBlock->status == IncidentStatus::Unreachable);

    const auto& events = engine.events();
    assert(std::any_of(events.begin(), events.end(), [](const AlgorithmEvent& e) { return e.type == "REROUTE_REQUIRED"; }));
    assert(std::any_of(events.begin(), events.end(), [](const AlgorithmEvent& e) {
        return e.type == "REROUTE_CALCULATED" || e.type == "DESTINATION_UNREACHABLE";
    }));

    if (afterBlock->status != IncidentStatus::Unreachable) {
        assert(engine.resolveIncident(second.incidentId));
        const auto* closed = engine.findIncident(second.incidentId);
        assert(closed && closed->status == IncidentStatus::Closed);
        const auto resolvedState = engine.stateToJson();
        assert(resolvedState.find("\"history\":{\"size\":1") != std::string::npos);
    }

    const auto next = engine.processNextIncident();
    assert(next.success || next.incident.status == IncidentStatus::WaitingForResource || next.message.find("No incident") != std::string::npos);

    engine.reset();
    const auto resetState = engine.stateToJson();
    assert(resetState.find("\"incidents\":[]") != std::string::npos);
    assert(resetState.find("\"queue\":{\"size\":0") != std::string::npos);
    assert(resetState.find("\"priorityHeap\":{\"size\":0") != std::string::npos);
    assert(resetState.find("\"history\":{\"size\":0") != std::string::npos);
    assert(resetState.find("\"blockedRoads\":0") != std::string::npos);

    std::cout << "Phase 9 deterministic end-to-end test: PASS\n";
    return 0;
}
