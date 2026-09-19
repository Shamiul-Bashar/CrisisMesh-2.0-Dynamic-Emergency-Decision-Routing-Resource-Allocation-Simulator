#include "simulation/SimulationEngine.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){
    SimulationEngine e;
    e.reset();
    auto a=e.reportEmergency(IncidentType::Medical,"LOC-019",5,5,8,"A");
    auto b=e.reportEmergency(IncidentType::Fire,"LOC-007",4,4,3,"B");
    auto c=e.reportEmergency(IncidentType::Police,"LOC-005",2,2,1,"C");
    assert(e.priorityHeap().isEmpty());
    auto d=e.processNextIncident(); assert(d.success); assert(d.incident.incidentId==a.incidentId); assert(!d.route.pathEdges.empty());
    const auto before=e.roadUndoDepth(); assert(e.blockRoad(d.route.pathEdges.front())); assert(e.roadUndoDepth()==before+1);
    assert(e.unblockRoad(d.route.pathEdges.front()));
    assert(e.blockRoad(d.route.pathEdges.front()));
    assert(e.undoLastRoadBlock()); assert(!e.graph().isBlocked(d.route.pathEdges.front()));
    assert(e.resolveIncident(a.incidentId));
    auto d2=e.processNextIncident(); assert(d2.success); assert(d2.incident.incidentId==b.incidentId);
    assert(e.resolveIncident(b.incidentId));
    auto d3=e.processNextIncident(); assert(d3.success); assert(d3.incident.incidentId==c.incidentId);
    assert(e.resolveIncident(c.incidentId));
    const auto state=e.stateToJson(); assert(state.find("\"history\":{\"size\":3")!=std::string::npos); assert(state.find("\"roadUndoStack\"")!=std::string::npos);
    e.reset(); assert(e.incidents().empty()); assert(e.roadUndoDepth()==0);
    std::cout<<"Final master integration test: PASS\n"; return 0;
}
