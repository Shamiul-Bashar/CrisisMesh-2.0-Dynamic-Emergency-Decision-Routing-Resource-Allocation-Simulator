#include "simulation/SimulationEngine.hpp"
#include <cassert>
#include <iostream>
#include <string>

using namespace crisismesh;

int main() {
    SimulationEngine engine;
    auto incident = engine.reportEmergency(IncidentType::Medical, "LOC-007", 5, 5, 2, "State export test");
    auto dispatch = engine.processNextIncident();
    assert(dispatch.success);

    const auto state = engine.stateToJson();
    assert(state.find("\"graph\"") != std::string::npos);
    assert(state.find("\"incidents\"") != std::string::npos);
    assert(state.find("\"responders\"") != std::string::npos);
    assert(state.find("\"activeDispatches\"") != std::string::npos);
    assert(state.find("\"recentEvents\"") != std::string::npos);
    assert(state.find("\"pendingIncidents\"") != std::string::npos);
    assert(state.find(incident.incidentId) != std::string::npos);
    assert(state.find(dispatch.responder.responderId) != std::string::npos);

    assert(engine.resolveIncident(incident.incidentId));
    const auto resolved = engine.stateToJson();
    assert(resolved.find("INCIDENT_CLOSED") != std::string::npos);
    assert(resolved.find("\"history\":{\"size\":1") != std::string::npos);

    engine.reset();
    const auto reset = engine.stateToJson();
    assert(reset.find("\"incidents\":[]") != std::string::npos);
    assert(reset.find("\"history\":{\"size\":0") != std::string::npos);
    assert(reset.find("\"blockedRoads\":0") != std::string::npos);

    std::cout << "Simulation state test: PASS\n";
    return 0;
}
