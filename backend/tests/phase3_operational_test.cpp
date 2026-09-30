#include "simulation/SimulationEngine.hpp"
#include "bfs/BFS.hpp"
#include "dfs/DFS.hpp"
#include <cmath>
#include <iostream>
#include <set>
#include <stdexcept>
using namespace crisismesh;
void check(bool value,const char* message) { if(!value)throw std::runtime_error(message); }
void near(double a,double b) { check(std::abs(a-b)<1e-8,"Route metric mismatch"); }
const DispatchRecord& record(const SimulationEngine& engine,const std::string& id) {
    for(const auto& value:engine.dispatches())if(value.incidentId==id)return value;
    throw std::runtime_error("Dispatch record missing");
}
int main() {
    SimulationEngine e;
    check(e.graph().getVertexCount()==24 && e.graph().getEdgeCount()==42,"City scale");
    for(const auto& type:{"FIRE_TRUCK","AMBULANCE","POLICE_UNIT","RESCUE_TEAM"}) {
        std::set<std::string> origins;
        for(const auto& r:e.responders())if(r.type==type) {
            origins.insert(r.currentLocation);check(!r.baseFacilityId.empty(),"Responder base");
        }
        check(origins.size()>=(std::string(type)=="RESCUE_TEAM"?2u:3u),"Distributed compatible origins");
    }
    auto fire=e.reportEmergency(IncidentType::Fire,"LOC-007",5,5,2,"fire","citizen");
    auto d=e.processNextIncident();check(d.success,"Dispatch");
    const auto snapshot=record(e,fire.incidentId);
    check(snapshot.candidateSummaries.size()==3,"All fire candidates evaluated");
    check(snapshot.responderId==snapshot.candidateSummaries.front().responderId,"Actual sorted selection");
    Dijkstra router;
    Dijkstra distanceOnly({1,0,0,0,0});
    bool tradeoff=false;
    for(const auto& from:e.locationDirectory().entries())for(const auto& to:e.locationDirectory().entries()) {
        const auto operational=router.run(e.graph(),from.id,to.id);
        const auto shortest=distanceOnly.run(e.graph(),from.id,to.id);
        if(operational.totalDistance>shortest.totalDistance+1e-8)tradeoff=true;
    }
    check(tradeoff,"City must demonstrate distance versus operational cost tradeoffs");
    for(const auto& c:snapshot.candidateSummaries) {
        const auto actual=router.run(e.graph(),c.startLocationId,c.destinationLocationId);
        check(c.pathEdges==actual.pathEdges && c.reachable==actual.reachable,"Candidate route");
        near(c.distance,actual.totalDistance);near(c.travelTime,actual.totalTravelTime);near(c.weightedCost,actual.totalCost);
        double risk=0,congestion=0;
        for(const auto& id:c.pathEdges){risk+=e.graph().getEdge(id)->riskLevel;congestion+=e.graph().getEdge(id)->congestionLevel;}
        near(c.risk,risk);near(c.congestion,c.pathEdges.empty()?0:congestion/c.pathEdges.size());
    }
    const auto state=e.stateToJson();const auto events=e.events().size();
    check(e.stateToJson()==state && e.events().size()==events,"STATE is read only");
    check(record(e,fire.incidentId).selectedRoute.pathEdges==snapshot.selectedRoute.pathEdges,"Persisted route");
    SimulationEngine duplicate;
    duplicate.reportEmergency(IncidentType::Fire,"LOC-007",5,5,2);
    check(duplicate.processNextIncident().responder.responderId==d.responder.responderId,"Deterministic selection");
    const auto medical=e.reportEmergency(IncidentType::Medical,"LOC-019",3,3,1,"medical","citizen");
    check(e.processNextIncident().success && e.dispatches().size()==2,"Simultaneous dispatches");
    check(record(e,medical.incidentId).responderId!=snapshot.responderId,"Independent responders");
    const auto revision=e.graph().revision();
    const auto blocked=snapshot.selectedRoute.pathEdges.front();
    check(e.blockRoad(blocked) && e.graph().revision()==revision+1,"Block revision");
    check(record(e,fire.incidentId).graphRevision==e.graph().revision(),"Reroute revision");
    check(record(e,fire.incidentId).selectedRoute.pathEdges!=snapshot.selectedRoute.pathEdges,"Reroute replaces route");
    check(e.unblockRoad(blocked) && e.graph().revision()==revision+2,"Unblock revision");
    check(e.markResponseCompleted(fire.incidentId),"Field completion");
    for(const auto& r:e.responders())if(r.responderId==d.responder.responderId)
        check(r.assignedIncidentId.empty() && r.availability==ResponderAvailability::Available && r.currentLocation=="LOC-007","Release assignment and relocate");
    check(!e.confirmIncidentResolved(fire.incidentId,"wrong"),"Owner enforcement");
    const auto nextFire=e.reportEmergency(IncidentType::Fire,"LOC-007",5,5,1,"new response","citizen");
    const auto nextDispatch=e.processNextIncident();
    check(nextDispatch.success && nextDispatch.responder.responderId==d.responder.responderId,"Released responder reused");
    check(e.confirmIncidentResolved(fire.incidentId,"citizen"),"User confirmation");
    for(const auto& r:e.responders())if(r.responderId==d.responder.responderId)
        check(r.assignedIncidentId==nextFire.incidentId && r.availability==ResponderAvailability::Assigned,"Old confirmation cannot release new assignment");
    const auto stable=record(e,nextFire.incidentId);
    const auto beforeState=e.stateToJson();
    check(e.stateToJson()==beforeState,"Repeated snapshots identical");
    check(e.blockRoad("R-001"),"Unrelated block");
    check(record(e,nextFire.incidentId).graphRevision==stable.graphRevision,"Unrelated road does not silently recompute route");

    SimulationEngine waiting;
    for(const auto& r:waiting.responders())if(r.type=="AMBULANCE")waiting.setResponderAvailability(r.responderId,ResponderAvailability::Offline);
    auto incident=waiting.reportEmergency(IncidentType::Medical,"LOC-019",4,4,1);
    check(!waiting.processNextIncident().success,"Waiting state");
    check(waiting.findIncident(incident.incidentId)->status==IncidentStatus::WaitingForResource,"Waiting retained");
    waiting.setResponderAvailability("AMB-UNIT-01",ResponderAvailability::Available);
    check(waiting.intakeIncidentIds().size()==1,"Restored responder requeues once");
    waiting.setResponderAvailability("AMB-UNIT-01",ResponderAvailability::Available);
    check(waiting.intakeIncidentIds().size()==1 && waiting.processNextIncident().success,"Recovery dispatch without duplicates");

    SimulationEngine roads;
    const auto stranded=roads.reportEmergency(IncidentType::Fire,"LOC-007",4,4,1);
    check(roads.processNextIncident().success,"Initial road dispatch");
    for(const auto& edge:roads.graph().getIncidentEdges("LOC-007"))roads.blockRoad(edge.id);
    check(roads.findIncident(stranded.incidentId)->status==IncidentStatus::Unreachable,"Unreachable assigned incident");
    for(const auto& algorithm:{"BFS","DFS","DIJKSTRA"}) {
        const auto analysis=roads.analyze(algorithm,"LOC-003","LOC-007");
        check(analysis.find("\"result\":{\"algorithm\":\""+std::string(algorithm)+"\"")!=std::string::npos,"Live result");
        check(analysis.find("\"graphRevision\":"+std::to_string(roads.graph().revision()))!=std::string::npos,"Analysis revision");
        check(analysis.find("\"reachable\":false")!=std::string::npos,"Current blocked graph");
    }
    roads.unblockRoad("R-019");
    check(roads.findIncident(stranded.incidentId)->status==IncidentStatus::EnRoute,"Road reopening recovers");
    check(record(roads,stranded.incidentId).graphRevision==roads.graph().revision(),"Recovery revision");
    check(BFS{}.run(roads.graph(),"LOC-003","LOC-007").reachable && DFS{}.run(roads.graph(),"LOC-003","LOC-007").reachable,"Traversals recover");
    check(roads.analyze("DIJKSTRA","LOC-003","LOC-007").find("\"reachable\":true")!=std::string::npos,"Dijkstra recovery");
    const auto oldRevision=roads.graph().revision();
    roads.reset();
    check(roads.graph().revision()>oldRevision && roads.dispatches().empty(),"Reset invalidates prior routes and traces");
    std::cout<<"Phase 3 city, dispatch, lifecycle, recovery, analysis: PASS\n";
}
