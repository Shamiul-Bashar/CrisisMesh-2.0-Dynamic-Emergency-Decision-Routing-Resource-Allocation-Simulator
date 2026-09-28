#include "simulation/SimulationEngine.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){
    SimulationEngine e;
    const auto low=e.reportEmergency(IncidentType::Medical,"LOC-010",2,2,1,"Low priority");
    const auto high=e.reportEmergency(IncidentType::Fire,"LOC-007",5,5,8,"High priority");
    const auto medium=e.reportEmergency(IncidentType::Police,"LOC-022",3,4,2,"Medium priority");
    const auto queued=e.stateToJson();
    assert(queued.find("\"queue\":{\"size\":3")!=std::string::npos);
    auto d=e.processNextIncident();
    assert(d.success);
    assert(d.incident.incidentId==high.incidentId);
    const auto state=e.stateToJson();
    assert(state.find(medium.incidentId)!=std::string::npos);
    assert(state.find(low.incidentId)!=std::string::npos);
    assert(e.priorityHeap().size()==2);
    std::cout<<"Phase 8 multi-incident ordering test: PASS\n";
}
