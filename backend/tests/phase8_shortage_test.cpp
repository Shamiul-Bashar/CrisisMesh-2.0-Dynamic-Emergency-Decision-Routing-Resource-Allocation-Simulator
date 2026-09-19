#include "simulation/SimulationEngine.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){
    SimulationEngine e;
    assert(e.setResponderAvailability("AMB-UNIT-01",ResponderAvailability::Offline));
    auto i=e.reportEmergency(IncidentType::Medical,"LOC-010",5,5,2,"No ambulance scenario");
    auto d=e.processNextIncident();
    assert(!d.success);
    assert(d.incident.incidentId==i.incidentId);
    assert(d.incident.status==IncidentStatus::WaitingForResource);
    const auto state=e.stateToJson();
    assert(state.find("WAITING_FOR_RESOURCE")!=std::string::npos);
    std::cout<<"Phase 8 responder shortage test: PASS\n";
}
