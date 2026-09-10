#include "simulation/SimulationEngine.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){
    SimulationEngine e;
    auto i=e.reportEmergency(IncidentType::Flood,"LOC-019",5,5,6,"Flood evacuation");
    auto d=e.processNextIncident();
    assert(d.success);
    const auto* stored=e.findIncident(i.incidentId); assert(stored);
    assert(!stored->shelterId.empty());
    assert(stored->allocatedResourceType=="WATER");
    assert(stored->allocatedResourceQuantity==12);
    const auto state=e.stateToJson();
    assert(state.find("SHELTER_SELECTED")!=std::string::npos);
    assert(state.find("RESOURCE_ALLOCATED")!=std::string::npos);
    assert(state.find("\"shelters\"")!=std::string::npos);
    assert(state.find("\"resources\"")!=std::string::npos);
    std::cout<<"Phase 8 shelter/resource allocation test: PASS\n";
}
