#include "simulation/SimulationEngine.hpp"
#include <algorithm>
#include <cassert>
#include <iostream>
using namespace crisismesh;

int main(){
    {
        SimulationEngine e;
        auto i1=e.reportEmergency(IncidentType::Medical,"LOC-010",5,5,3,"Medical emergency");
        auto i2=e.reportEmergency(IncidentType::Fire,"LOC-007",4,4,5,"Fire emergency");
        auto d=e.processNextIncident();
        assert(d.success);
        assert(d.incident.incidentId==i1.incidentId || d.incident.incidentId==i2.incidentId);
        assert(!d.route.pathEdges.empty());
        const auto blocked=d.route.pathEdges.front();
        assert(e.blockRoad(blocked));
        const auto& ev=e.events();
        assert(std::any_of(ev.begin(),ev.end(),[](const AlgorithmEvent&x){return x.type=="REROUTE_REQUIRED";}));
        assert(std::any_of(ev.begin(),ev.end(),[](const AlgorithmEvent&x){return x.type=="REROUTE_CALCULATED" || x.type=="DESTINATION_UNREACHABLE";}));
        assert(e.resolveIncident(d.incident.incidentId));
        assert(std::any_of(ev.begin(),ev.end(),[](const AlgorithmEvent&x){return x.type=="HISTORY_UPDATED";}));
    }
    {
        SimulationEngine e;
        // Disconnect LOC-007 from the city by blocking all three of its incident roads.
        assert(e.blockRoad("R-019"));
        assert(e.blockRoad("R-020"));
        assert(e.blockRoad("R-021"));
        e.reportEmergency(IncidentType::Fire,"LOC-007",5,5,8,"Disconnected fire");
        auto d=e.processNextIncident();
        assert(!d.success);
        assert(d.incident.status==IncidentStatus::WaitingForResource || d.incident.status==IncidentStatus::Unreachable);
    }
    std::cout<<"End-to-end simulation test: PASS\n";
}
