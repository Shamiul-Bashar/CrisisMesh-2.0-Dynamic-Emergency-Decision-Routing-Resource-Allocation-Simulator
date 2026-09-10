#include "simulation/SimulationEngine.hpp"
#include <cassert>
#include <iostream>
#include <set>

using namespace crisismesh;

int main() {
    SimulationEngine engine;
    const auto incident = engine.reportEmergency(IncidentType::Fire, "LOC-007", 5, 5, 8, "Reroute integration test");
    const auto dispatch = engine.processNextIncident();
    assert(dispatch.success);
    assert(!dispatch.route.pathEdges.empty());

    const auto original = dispatch.route.pathEdges;
    assert(engine.blockRoad(original.front()));
    const auto* afterBlock = engine.findIncident(incident.incidentId);
    assert(afterBlock);
    const auto stateAfterBlock = engine.stateToJson();
    assert(stateAfterBlock.find("REROUTE_REQUIRED") != std::string::npos);
    assert(stateAfterBlock.find("REROUTE_CALCULATED") != std::string::npos || stateAfterBlock.find("DESTINATION_UNREACHABLE") != std::string::npos);

    if (afterBlock->status != IncidentStatus::Unreachable) {
        const auto destinationEdges = engine.graph().getIncidentEdges(incident.locationId);
        for (const auto& edge : destinationEdges) {
            if (engine.graph().isBlocked(edge.id)) continue;
            engine.blockRoad(edge.id);
        }
    }

    const auto* finalIncident = engine.findIncident(incident.incidentId);
    assert(finalIncident);
    assert(finalIncident->status == IncidentStatus::Unreachable);
    const auto finalState = engine.stateToJson();
    assert(finalState.find("DESTINATION_UNREACHABLE") != std::string::npos);

    std::cout << "Simulation reroute/unreachable test: PASS\n";
    return 0;
}
