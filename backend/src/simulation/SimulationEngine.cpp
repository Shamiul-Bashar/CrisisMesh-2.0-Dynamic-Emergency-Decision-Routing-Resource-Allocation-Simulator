#include "simulation/SimulationEngine.hpp"
#include "graph/CityData.hpp"
#include <algorithm>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <unordered_set>

namespace crisismesh {
namespace {
std::string q(const std::string&s){std::string o="\"";for(char c:s){if(c=='\\')o+="\\\\";else if(c=='"')o+="\\\"";else if(c=='\n')o+="\\n";else o+=c;}return o+"\"";}
std::string arr(const std::vector<std::string>&v){std::ostringstream o;o<<"[";for(size_t i=0;i<v.size();++i){if(i)o<<',';o<<q(v[i]);}return o.str()+"]";}
}

SimulationEngine::SimulationEngine() : graph_(createCrisisMeshCity()), incidentTable_(17) {
    responders_ = {
        {"FIRE-UNIT-01","FIRE_TRUCK","LOC-003",ResponderAvailability::Available,1,true},
        {"FIRE-UNIT-02","FIRE_TRUCK","LOC-004",ResponderAvailability::Available,1,true},
        {"FIRE-UNIT-03","FIRE_TRUCK","LOC-004",ResponderAvailability::Assigned,1,true},
        {"AMB-UNIT-01","AMBULANCE","LOC-018",ResponderAvailability::Available,2,true},
        {"AMB-UNIT-02","AMBULANCE","LOC-023",ResponderAvailability::Busy,2,true},
        {"POLICE-UNIT-01","POLICE_UNIT","LOC-005",ResponderAvailability::Available,2,true},
        {"POLICE-UNIT-02","POLICE_UNIT","LOC-006",ResponderAvailability::Available,2,true},
        {"RESCUE-UNIT-01","RESCUE_TEAM","LOC-012",ResponderAvailability::Available,4,true}
    };
}

void SimulationEngine::emit(const std::string&type,const Incident*in,const std::string&node,const std::string&edge,const std::string&message,int value){
    AlgorithmEvent e; e.type=type;e.algorithm="SIMULATION";e.step=events_.size()+1;e.nodeId=node;e.edgeId=edge;e.message=message;e.priority=in?in->priorityScore:value;e.key=in?in->incidentId:"";e.status=in?toString(in->status):"";e.size=events_.size()+1;e.value1=value; if(in)e.responderId=in->assignedResponderId;events_.push_back(std::move(e));
}
Incident& SimulationEngine::mutableIncident(const std::string&id){for(auto&i:incidents_)if(i.incidentId==id)return i;throw std::invalid_argument("Unknown incident: "+id);}
const Incident* SimulationEngine::findIncident(const std::string&id) const {for(const auto&i:incidents_)if(i.incidentId==id)return &i;return nullptr;}
const Shelter* SimulationEngine::findShelter(const std::string&id) const { for (const auto& s : allocationEngine_.shelters()) if (s.shelterId == id) return &s; return nullptr; }

Incident SimulationEngine::reportEmergency(IncidentType type,const std::string&locationId,int severity,int urgency,int victimCount,const std::string&description){
    if(!graph_.vertexExists(locationId))throw std::invalid_argument("Invalid incident location: "+locationId);
    if(!Incident::validSeverity(severity)||!Incident::validUrgency(urgency)||victimCount<0)throw std::invalid_argument("Invalid incident severity, urgency, or victim count");
    Incident i; i.incidentId="INC-"+std::to_string(nextIncidentNumber_++);i.type=type;i.locationId=locationId;i.severity=severity;i.urgency=urgency;i.victimCount=victimCount;i.priorityScore=Incident::calculatePriority(severity,urgency,victimCount,type);i.status=IncidentStatus::Reported;i.reportedSequence=++sequence_;i.requiredResponderType=(type==IncidentType::Fire?"FIRE_TRUCK":type==IncidentType::Medical||type==IncidentType::Accident?"AMBULANCE":type==IncidentType::Police?"POLICE_UNIT":"RESCUE_TEAM");i.description=description;
    incidents_.push_back(i);
    incidentTable_.insert({i.incidentId,toString(i.type),toString(i.status),i.priorityScore});
    emit("INCIDENT_CREATED",&i,i.locationId,"","Emergency created in C++ authoritative engine");
    i.status=IncidentStatus::Queued; mutableIncident(i.incidentId).status=i.status;
    intakeQueue_.enqueue(i); emit("INCIDENT_QUEUED",&i,i.locationId,"","Incident entered FIFO emergency intake queue");
    return i;
}
DispatchResult SimulationEngine::processNextIncident(){
    // Move every waiting request through triage/priority into the authoritative
    // manual Max Heap, then select exactly one highest-priority incident.
    while(!intakeQueue_.isEmpty()) {
        Incident queued=intakeQueue_.dequeue();
        Incident&i=mutableIncident(queued.incidentId);
        i.status=IncidentStatus::Triaged; emit("INCIDENT_TRIAGED",&i,i.locationId,"","Incident triaged");
        i.status=IncidentStatus::Prioritized;
        i.priorityScore=Incident::calculatePriority(i.severity,i.urgency,i.victimCount,i.type);
        emit("PRIORITY_CALCULATED",&i,i.locationId,"","Deterministic emergency priority calculated",i.priorityScore);
        const int victimScore = std::min(i.victimCount, 10) * 3;
        const int severityScore = i.severity * 12;
        const int urgencyScore = i.urgency * 10;
        AlgorithmEvent priorityDetail; priorityDetail.type="PRIORITY_BREAKDOWN"; priorityDetail.algorithm="PRIORITY_ENGINE"; priorityDetail.step=events_.size()+1; priorityDetail.key=i.incidentId; priorityDetail.priority=i.priorityScore; priorityDetail.value1=severityScore; priorityDetail.value2=urgencyScore; priorityDetail.value=std::to_string(victimScore)+"|"+std::to_string(i.priorityScore-severityScore-urgencyScore-victimScore); priorityDetail.message="severity + urgency + victims + incident-type contribution"; events_.push_back(std::move(priorityDetail));
        maxHeap_.insert(i);
        emit("MAX_HEAP_INSERT",&i,i.locationId,"","Incident inserted into manual binary max heap");
        AlgorithmEvent h; h.type="MAX_HEAP_STATE"; h.algorithm="MAX_HEAP"; h.step=events_.size()+1; h.size=maxHeap_.size(); h.message="Actual Max Heap array snapshot after insertion";
        for(std::size_t k=0;k<maxHeap_.values().size();++k){ if(k) h.value += "|"; h.value += maxHeap_.values()[k].incidentId + ":" + std::to_string(maxHeap_.values()[k].priorityScore); }
        events_.push_back(std::move(h));
    }
    if(maxHeap_.isEmpty()) return {false,{},{} ,{} ,"No incident waiting for dispatch"};
    Incident selected=maxHeap_.extractMax();
    Incident&si=mutableIncident(selected.incidentId); si.status=IncidentStatus::Prioritized;
    emit("MAX_HEAP_EXTRACT",&si,si.locationId,"","Highest-priority incident selected from max heap");
    AlgorithmEvent h; h.type="MAX_HEAP_STATE"; h.algorithm="MAX_HEAP"; h.step=events_.size()+1; h.size=maxHeap_.size(); h.message="Actual Max Heap array snapshot after extraction";
    for(std::size_t k=0;k<maxHeap_.values().size();++k){ if(k) h.value += "|"; h.value += maxHeap_.values()[k].incidentId + ":" + std::to_string(maxHeap_.values()[k].priorityScore); }
    events_.push_back(std::move(h));
    return dispatchIncident(si.incidentId);
}

Responder* SimulationEngine::chooseResponder(const Incident&incident,DijkstraResult&bestRoute){
    Responder*best=nullptr;double bestCost=std::numeric_limits<double>::infinity();
    for(auto&r:responders_){
        if(r.availability!=ResponderAvailability::Available||!responderTypeMatches(incident.type,r.type))continue;
        emit("RESPONDER_CHECKED",&incident,r.currentLocation,"","Eligible responder evaluated");
        auto route=dijkstra_.run(graph_,r.currentLocation,incident.locationId);
        if(!route.reachable){
            AlgorithmEvent candidate; candidate.type="RESPONDER_CANDIDATE"; candidate.algorithm="ALLOCATION_ENGINE"; candidate.step=events_.size()+1; candidate.key=incident.incidentId; candidate.responderId=r.responderId; candidate.status="UNREACHABLE"; candidate.message="Eligible responder has no reachable C++ Dijkstra route"; events_.push_back(std::move(candidate));
            continue;
        }
        AlgorithmEvent candidate; candidate.type="RESPONDER_CANDIDATE"; candidate.algorithm="ALLOCATION_ENGINE"; candidate.step=events_.size()+1; candidate.key=incident.incidentId; candidate.responderId=r.responderId; candidate.status="REACHABLE"; candidate.value1=route.totalCost; candidate.value2=route.totalDistance; candidate.message="Eligible responder route cost evaluated by C++ Dijkstra"; events_.push_back(std::move(candidate));
        if(route.totalCost<bestCost){bestCost=route.totalCost;best=&r;bestRoute=std::move(route);}
    }
    return best;
}
DispatchResult SimulationEngine::dispatchIncident(const std::string&id){
    Incident&i=mutableIncident(id);DijkstraResult route;Responder*r=chooseResponder(i,route);
    if(!r){i.status=IncidentStatus::WaitingForResource;emit("WAITING_FOR_RESOURCE",&i,i.locationId,"","No available eligible responder has a valid route");return {false,i,{},route,"No eligible reachable responder"};}
    i.assignedResponderId=r->responderId;i.status=IncidentStatus::Assigned;r->availability=ResponderAvailability::Assigned;
    incidentTable_.remove(i.incidentId);incidentTable_.insert({i.incidentId,toString(i.type),toString(i.status),i.priorityScore});
    emit("RESPONDER_SELECTED",&i,r->currentLocation,"","Best reachable responder selected");
    emit("DISPATCH_STARTED",&i,r->currentLocation,"","Dispatch started");
    emit("ROUTE_CALCULATED",&i,r->currentLocation,"","C++ Dijkstra route selected");
    i.status=IncidentStatus::EnRoute;emit("INCIDENT_EN_ROUTE",&i,i.locationId,"","Responder is en route");
    const bool shelterNeeded = i.victimCount > 0 && (i.type == IncidentType::Flood || i.type == IncidentType::Structural || i.type == IncidentType::Rescue);
    if (shelterNeeded) {
        const auto shelter = allocationEngine_.selectShelter(graph_, i, dijkstra_);
        if (shelter.allocated) { i.shelterId = shelter.shelter.shelterId; emit("SHELTER_SELECTED", &i, shelter.shelter.locationId, "", shelter.message); }
        else emit("SHELTER_UNAVAILABLE", &i, i.locationId, "", shelter.message);
    }
    const auto allocations = allocationEngine_.allocateResources(i);
    if (!allocations.empty()) {
        i.allocatedResourceType = allocations.front().resourceType;
        i.allocatedResourceQuantity = allocations.front().quantity;
        emit("RESOURCE_ALLOCATED", &i, i.locationId, "", "Emergency resource allocation confirmed by C++ engine", allocations.front().quantity);
    } else if (i.type == IncidentType::Medical || i.type == IncidentType::Accident || i.type == IncidentType::Flood || i.type == IncidentType::Rescue || i.type == IncidentType::Structural) {
        emit("RESOURCE_UNAVAILABLE", &i, i.locationId, "", "Required emergency resource is currently insufficient");
    }
    DispatchResult out{true,i,*r,route,"Dispatch successful"};
    return out;
}
bool SimulationEngine::blockRoad(const std::string&id){
    if(!graph_.edgeExists(id) || graph_.isBlocked(id)) return false;
    // Capture active routes before mutating the graph so we can determine whether
    // the blocked road was actually part of an in-progress dispatch.
    struct ActiveRoute { std::string incidentId; std::string responderId; DijkstraResult route; };
    std::vector<ActiveRoute> active;
    for(const auto&i:incidents_) if(!i.assignedResponderId.empty() && (i.status==IncidentStatus::EnRoute || i.status==IncidentStatus::Assigned)){
        const auto rIt = std::find_if(responders_.begin(), responders_.end(), [&](const Responder&r){return r.responderId==i.assignedResponderId;});
        if(rIt!=responders_.end()) {
            ActiveRoute a{i.incidentId,i.assignedResponderId,dijkstra_.run(graph_,rIt->currentLocation,i.locationId)};
            active.push_back(std::move(a));
        }
    }
    graph_.blockEdge(id);
    roadUndoStack_.push(id);
    emit("ROAD_BLOCKED",nullptr,"",id,"Road blocked in authoritative C++ graph");
    for(const auto&a:active){
        if(std::find(a.route.pathEdges.begin(),a.route.pathEdges.end(),id)!=a.route.pathEdges.end()){
            Incident& inc=mutableIncident(a.incidentId);
            inc.status=IncidentStatus::RerouteRequired;
            incidentTable_.remove(inc.incidentId);
            incidentTable_.insert({inc.incidentId,toString(inc.type),toString(inc.status),inc.priorityScore});
            emit("REROUTE_REQUIRED",&inc,inc.locationId,id,"Active route used the blocked road");
            rerouteAssignedIncident(a.incidentId);
        }
    }
    return true;
}
bool SimulationEngine::unblockRoad(const std::string&id){if(!graph_.unblockEdge(id))return false;emit("ROAD_UNBLOCKED",nullptr,"",id,"Road reopened in authoritative C++ graph");return true;}
bool SimulationEngine::undoLastRoadBlock(){
    if(roadUndoStack_.isEmpty()) return false;
    const std::string id=roadUndoStack_.pop();
    if(!graph_.isBlocked(id)) return false;
    graph_.unblockEdge(id);
    emit("ROAD_OPERATION_UNDONE",nullptr,"",id,"Last road block undone using the manual Stack");
    return true;
}
DispatchResult SimulationEngine::rerouteAssignedIncident(const std::string&id){
    Incident&i=mutableIncident(id);Responder*r=nullptr;for(auto&x:responders_)if(x.responderId==i.assignedResponderId)r=&x;
    if(!r)return {false,i,{},{},"Assigned responder not found"};
    auto route=dijkstra_.run(graph_,r->currentLocation,i.locationId);
    if(!route.reachable){i.status=IncidentStatus::Unreachable;emit("DESTINATION_UNREACHABLE",&i,i.locationId,"","No route after road change");return {false,i,*r,route,"Destination unreachable"};}
    i.status=IncidentStatus::EnRoute;emit("REROUTE_CALCULATED",&i,r->currentLocation,"","New route calculated by C++ Dijkstra");
    return {true,i,*r,route,"Reroute successful"};
}
bool SimulationEngine::setResponderAvailability(const std::string& responderId, ResponderAvailability availability){
    for(auto& r:responders_) if(r.responderId==responderId){
        r.availability=availability;
        emit("RESPONDER_STATE_CHANGED",nullptr,r.currentLocation,"","Responder availability updated: "+std::string(toString(availability)));
        return true;
    }
    return false;
}

bool SimulationEngine::resolveIncident(const std::string&id){
    Incident&i=mutableIncident(id);
    if (i.status == IncidentStatus::Resolved || i.status == IncidentStatus::Closed) return false;
    i.status=IncidentStatus::Resolved;
    history_.insertBack(i.incidentId+" / "+toString(i.status));
    emit("INCIDENT_RESOLVED",&i,i.locationId,"","Incident marked resolved");
    emit("HISTORY_UPDATED",&i,i.locationId,"","Resolved incident appended to manual linked-list history");
    for(auto&r:responders_) if(r.responderId==i.assignedResponderId){r.availability=ResponderAvailability::Available;r.currentLocation=i.locationId;}
    i.status=IncidentStatus::Closed;
    incidentTable_.remove(i.incidentId);
    incidentTable_.insert({i.incidentId,toString(i.type),toString(i.status),i.priorityScore});
    emit("INCIDENT_CLOSED",&i,i.locationId,"","Incident lifecycle closed");
    return true;
}
std::string SimulationEngine::incidentToJson(const Incident&i){
    std::ostringstream o;
    o<<"{\"incidentId\":"<<q(i.incidentId)
     <<",\"type\":"<<q(toString(i.type))
     <<",\"locationId\":"<<q(i.locationId)
     <<",\"severity\":"<<i.severity
     <<",\"urgency\":"<<i.urgency
     <<",\"victimCount\":"<<i.victimCount
     <<",\"priorityScore\":"<<i.priorityScore
     <<",\"status\":"<<q(toString(i.status))
     <<",\"reportedSequence\":"<<i.reportedSequence
     <<",\"requiredResponderType\":"<<q(i.requiredResponderType)
     <<",\"assignedResponderId\":"<<q(i.assignedResponderId)
     <<",\"description\":"<<q(i.description)
     <<",\"shelterId\":"<<q(i.shelterId)
     <<",\"allocatedResourceType\":"<<q(i.allocatedResourceType)
     <<",\"allocatedResourceQuantity\":"<<i.allocatedResourceQuantity
     <<"}";
    return o.str();
}

std::string SimulationEngine::stateToJson() const {
    std::ostringstream o;
    const auto blockedEdges = [&]() {
        std::vector<std::string> ids;
        for (const auto& [id, edge] : graph_.edges()) if (edge.blocked) ids.push_back(id);
        std::sort(ids.begin(), ids.end());
        return ids;
    }();

    o << "{\"ok\":true"
      << ",\"bridge\":\"C++ Simulation Development Bridge\""
      << ",\"engine\":\"ONLINE\""
      << ",\"graph\":{\"vertices\":" << graph_.getVertexCount()
      << ",\"roads\":" << graph_.getEdgeCount()
      << ",\"openRoads\":" << (graph_.getEdgeCount() - blockedEdges.size())
      << ",\"blockedRoads\":" << blockedEdges.size()
      << ",\"blockedEdgeIds\":" << arr(blockedEdges) << "}"
      << ",\"roadUndoStack\":{\"depth\":" << roadUndoStack_.size() << ",\"canUndo\":" << (roadUndoStack_.isEmpty()?"false":"true") << "}"
      << ",\"incidents\":[";
    for (std::size_t i=0;i<incidents_.size();++i) { if(i) o<<','; o<<incidentToJson(incidents_[i]); }
    o << "]";

    // The manual FIFO queue is authoritative. This is a read-only snapshot of its contents.
    const auto queued = intakeQueue_.values();
    o << ",\"queue\":{\"size\":" << queued.size() << ",\"incidentIds\":[";
    for (std::size_t i=0;i<queued.size();++i) { if(i) o<<','; o<<q(queued[i].incidentId); }
    o << "]}";

    // The manual binary max heap is authoritative for priority scheduling.
    const auto& heapValues = maxHeap_.values();
    MaxHeap previewHeap;
    for (const auto& queuedIncident : queued) previewHeap.insert(queuedIncident);
    for (const auto& heapIncident : heapValues) previewHeap.insert(heapIncident);
    o << ",\"pendingIncidents\":[";
    bool firstPending = true;
    for (std::size_t i = 0; i < queued.size(); ++i) {
        if (!firstPending) o << ',';
        firstPending = false;
        o << "{\"incidentId\":" << q(queued[i].incidentId)
          << ",\"stage\":\"INTAKE_QUEUE\",\"position\":" << (i + 1)
          << ",\"priority\":" << queued[i].priorityScore << "}";
    }
    for (std::size_t i = 0; i < heapValues.size(); ++i) {
        if (!firstPending) o << ',';
        firstPending = false;
        o << "{\"incidentId\":" << q(heapValues[i].incidentId)
          << ",\"stage\":\"PRIORITY_HEAP\",\"position\":" << (i + 1)
          << ",\"priority\":" << heapValues[i].priorityScore << "}";
    }
    o << "]";
    o << ",\"priorityHeap\":{\"size\":" << heapValues.size() << ",\"incidentIds\":[";
    for (std::size_t i=0;i<heapValues.size();++i) { if(i) o<<','; o<<q(heapValues[i].incidentId); }
    o << "],\"entries\":[";
    for (std::size_t i=0;i<heapValues.size();++i) {
        if(i) o<<',';
        o << "{\"incidentId\":" << q(heapValues[i].incidentId) << ",\"priority\":" << heapValues[i].priorityScore << "}";
    }
    o << "]}";
    o << ",\"nextDispatch\":";
    if (previewHeap.isEmpty()) o << "null";
    else { const auto& next = previewHeap.peekMax(); o << "{\"incidentId\":" << q(next.incidentId) << ",\"priority\":" << next.priorityScore << "}"; }

    o << ",\"responders\":[";
    for (std::size_t i=0;i<responders_.size();++i) {
        if(i) o<<',';
        const auto& r=responders_[i];
        std::string assignedIncident;
        std::string operationalStatus=toString(r.availability);
        for (const auto& inc:incidents_) if (inc.assignedResponderId==r.responderId && inc.status!=IncidentStatus::Closed) {
            assignedIncident=inc.incidentId;
            if (inc.status==IncidentStatus::EnRoute) operationalStatus="EN_ROUTE";
            else if (inc.status==IncidentStatus::Assigned) operationalStatus="ASSIGNED";
            else if (inc.status==IncidentStatus::Resolved) operationalStatus="AVAILABLE";
            break;
        }
        o << "{\"responderId\":"<<q(r.responderId)
          <<",\"type\":"<<q(r.type)
          <<",\"locationId\":"<<q(r.currentLocation)
          <<",\"availability\":"<<q(toString(r.availability))
          <<",\"status\":"<<q(operationalStatus)
          <<",\"assignedIncidentId\":"<<(assignedIncident.empty()?"null":q(assignedIncident))
          <<",\"capacity\":"<<r.capacity<<"}";
    }
    o << "]";

    o << ",\"shelters\":[";
    for (std::size_t i=0;i<allocationEngine_.shelters().size();++i) {
        if(i)o<<',';
        const auto& s=allocationEngine_.shelters()[i];
        o << "{\"shelterId\":"<<q(s.shelterId)<<",\"locationId\":"<<q(s.locationId)
          <<",\"capacity\":"<<s.capacity<<",\"occupancy\":"<<s.occupancy
          <<",\"availableCapacity\":"<<s.availableCapacity()<<",\"status\":"<<q(s.operational?"OPERATIONAL":"OFFLINE")<<"}";
    }
    o << "]";
    o << ",\"resources\":[";
    for (std::size_t i=0;i<allocationEngine_.resources().size();++i) {
        if(i)o<<',';
        const auto& r=allocationEngine_.resources()[i];
        o << "{\"resourceType\":"<<q(r.resourceType)<<",\"quantity\":"<<r.quantity<<",\"source\":"<<q(r.source)<<"}";
    }
    o << "]";

    o << ",\"activeDispatches\":[";
    bool firstDispatch=true;
    for (const auto& inc:incidents_) {
        if (inc.assignedResponderId.empty() || (inc.status!=IncidentStatus::Assigned && inc.status!=IncidentStatus::EnRoute && inc.status!=IncidentStatus::RerouteRequired)) continue;
        const Responder* r=nullptr;
        for (const auto& candidate:responders_) if(candidate.responderId==inc.assignedResponderId){r=&candidate;break;}
        if(!r) continue;
        auto route=dijkstra_.run(graph_,r->currentLocation,inc.locationId);
        if(!firstDispatch) o<<',';
        firstDispatch=false;
        o << "{\"incidentId\":"<<q(inc.incidentId)
          <<",\"responderId\":"<<q(r->responderId)
          <<",\"origin\":"<<q(r->currentLocation)
          <<",\"destination\":"<<q(inc.locationId)
          <<",\"status\":"<<q(toString(inc.status))
          <<",\"reachable\":"<<(route.reachable?"true":"false")
          <<",\"routeCost\":"<<route.totalCost
          <<",\"distance\":"<<route.totalDistance
          <<",\"travelTime\":"<<route.totalTravelTime
          <<",\"pathNodes\":"<<arr(route.pathNodes)
          <<",\"pathEdges\":"<<arr(route.pathEdges)<<"}";
    }
    o << "]";

    const auto historyValues=history_.values();
    o << ",\"history\":{\"size\":"<<historyValues.size()<<",\"entries\":[";
    for(std::size_t i=0;i<historyValues.size();++i){if(i)o<<',';o<<q(historyValues[i]);}
    o << "]}"
      << ",\"hashTable\":{\"size\":"<<incidentTable_.size()<<"}";
    std::size_t activeCount=0,resolvedCount=0,unreachableCount=0,dispatchCount=0;
    double prioritySum=0.0,distanceSum=0.0,travelTimeSum=0.0;
    std::unordered_set<std::string> rerouteIncidentIds;
    for (const auto& inc : incidents_) {
        if (inc.status != IncidentStatus::Closed && inc.status != IncidentStatus::Resolved) ++activeCount;
        if (inc.status == IncidentStatus::Closed || inc.status == IncidentStatus::Resolved) ++resolvedCount;
        if (inc.status == IncidentStatus::Unreachable) ++unreachableCount;
        prioritySum += inc.priorityScore;
    }
    for (const auto& e : events_) {
        if (e.type == "DISPATCH_STARTED") ++dispatchCount;
        if (e.type == "REROUTE_CALCULATED") rerouteIncidentIds.insert(e.key);
    }
    std::size_t activeRouteCount=0;
    for (const auto& inc : incidents_) {
        if (inc.assignedResponderId.empty() || (inc.status != IncidentStatus::Assigned && inc.status != IncidentStatus::EnRoute && inc.status != IncidentStatus::RerouteRequired)) continue;
        const Responder* rr=nullptr;
        for (const auto& candidate : responders_) if (candidate.responderId == inc.assignedResponderId) { rr=&candidate; break; }
        if (!rr) continue;
        const auto route = dijkstra_.run(graph_, rr->currentLocation, inc.locationId);
        if (route.reachable) { ++activeRouteCount; distanceSum += route.totalDistance; travelTimeSum += route.totalTravelTime; }
    }
    std::size_t availableCount=0;
    for (const auto& r : responders_) if (r.availability == ResponderAvailability::Available) ++availableCount;
    o << ",\"analytics\":{\"totalIncidents\":"<<incidents_.size()<<",\"activeIncidents\":"<<activeCount
      <<",\"resolvedIncidents\":"<<resolvedCount<<",\"unreachableIncidents\":"<<unreachableCount
      <<",\"averagePriority\":"<<(incidents_.empty()?0.0:prioritySum/incidents_.size())
      <<",\"averageRouteDistance\":"<<(activeRouteCount?distanceSum/activeRouteCount:0.0)
      <<",\"averageTravelTime\":"<<(activeRouteCount?travelTimeSum/activeRouteCount:0.0)
      <<",\"dispatchCount\":"<<dispatchCount<<",\"rerouteCount\":"<<rerouteIncidentIds.size()
      <<",\"availableResponders\":"<<availableCount<<"}"
      << ",\"recentEvents\":[";
    const std::size_t start=events_.size()>30?events_.size()-30:0;
    for(std::size_t i=start;i<events_.size();++i){
        if(i>start)o<<',';
        const auto&e=events_[i];
        o<<"{\"type\":"<<q(e.type)<<",\"algorithm\":"<<q(e.algorithm)<<",\"step\":"<<e.step
         <<",\"incidentId\":"<<(e.key.empty()?"null":q(e.key))
         <<",\"nodeId\":"<<(e.nodeId.empty()?"null":q(e.nodeId))
         <<",\"edgeId\":"<<(e.edgeId.empty()?"null":q(e.edgeId))
         <<",\"priority\":"<<e.priority<<",\"value1\":"<<e.value1<<",\"value2\":"<<e.value2<<",\"value\":"<<(e.value.empty()?"null":q(e.value))<<",\"responderId\":"<<(e.responderId.empty()?"null":q(e.responderId))
         <<",\"status\":"<<(e.status.empty()?"null":q(e.status))<<",\"message\":"<<q(e.message)<<"}";
    }
    o << "]";
    o << ",\"eventHistory\":[";
    for(std::size_t i=0;i<events_.size();++i){
        if(i)o<<',';
        const auto&e=events_[i];
        o<<"{\"type\":"<<q(e.type)<<",\"algorithm\":"<<q(e.algorithm)<<",\"step\":"<<e.step
          <<",\"incidentId\":"<<(e.key.empty()?"null":q(e.key))
          <<",\"nodeId\":"<<(e.nodeId.empty()?"null":q(e.nodeId))
          <<",\"edgeId\":"<<(e.edgeId.empty()?"null":q(e.edgeId))
          <<",\"priority\":"<<e.priority<<",\"value1\":"<<e.value1<<",\"value2\":"<<e.value2<<",\"value\":"<<(e.value.empty()?"null":q(e.value))<<",\"responderId\":"<<(e.responderId.empty()?"null":q(e.responderId))
          <<",\"status\":"<<(e.status.empty()?"null":q(e.status))<<",\"message\":"<<q(e.message)<<"}";
    }
    o << "]}\n";
    auto out=o.str();
    if(!out.empty() && out.back()=='\n') out.pop_back();
    return out;
}
std::string SimulationEngine::eventsToJson(const std::vector<AlgorithmEvent>&ev,const DispatchResult*result){
    std::ostringstream o;o<<"{\"ok\":true,\"algorithm\":\"EmergencySimulation\",\"events\":[";
    for(size_t i=0;i<ev.size();++i){if(i)o<<',';const auto&e=ev[i];o<<"{\"type\":"<<q(e.type)<<",\"algorithm\":"<<q(e.algorithm)<<",\"step\":"<<e.step<<",\"nodeId\":"<<(e.nodeId.empty()?"null":q(e.nodeId))<<",\"edgeId\":"<<(e.edgeId.empty()?"null":q(e.edgeId))<<",\"incidentId\":"<<(e.key.empty()?"null":q(e.key))<<",\"priority\":"<<e.priority<<",\"value1\":"<<e.value1<<",\"message\":"<<q(e.message)<<",\"value\":"<<(e.value.empty()?"null":q(e.value))<<",\"responderId\":"<<(e.responderId.empty()?"null":q(e.responderId))<<",\"status\":"<<(e.status.empty()?"null":q(e.status))<<"}";}
    o<<"]";if(result){o<<",\"result\":{\"success\":"<<(result->success?"true":"false")<<",\"message\":"<<q(result->message)<<",\"incident\":"<<incidentToJson(result->incident)<<",\"responder\":{\"responderId\":"<<q(result->responder.responderId)<<",\"type\":"<<q(result->responder.type)<<",\"locationId\":"<<q(result->responder.currentLocation)<<"},\"route\":{\"reachable\":"<<(result->route.reachable?"true":"false")<<",\"totalCost\":"<<result->route.totalCost<<",\"totalDistance\":"<<result->route.totalDistance<<",\"totalTravelTime\":"<<result->route.totalTravelTime<<",\"pathNodes\":"<<arr(result->route.pathNodes)<<",\"pathEdges\":"<<arr(result->route.pathEdges)<<"}}";}return o.str()+"}";}
void SimulationEngine::reset(){
    graph_=createCrisisMeshCity(); intakeQueue_.clear(); maxHeap_.clear(); incidents_.clear(); responders_.clear();
    incidentTable_.clear(); history_.clear(); events_.clear(); allocationEngine_.reset(); roadUndoStack_.clear(); sequence_=0; nextIncidentNumber_=201;
    responders_ = {
        {"FIRE-UNIT-01","FIRE_TRUCK","LOC-003",ResponderAvailability::Available,1,true},
        {"FIRE-UNIT-02","FIRE_TRUCK","LOC-004",ResponderAvailability::Available,1,true},
        {"FIRE-UNIT-03","FIRE_TRUCK","LOC-004",ResponderAvailability::Assigned,1,true},
        {"AMB-UNIT-01","AMBULANCE","LOC-018",ResponderAvailability::Available,2,true},
        {"AMB-UNIT-02","AMBULANCE","LOC-023",ResponderAvailability::Busy,2,true},
        {"POLICE-UNIT-01","POLICE_UNIT","LOC-005",ResponderAvailability::Available,2,true},
        {"POLICE-UNIT-02","POLICE_UNIT","LOC-006",ResponderAvailability::Available,2,true},
        {"RESCUE-UNIT-01","RESCUE_TEAM","LOC-012",ResponderAvailability::Available,4,true}
    };
}

} // namespace crisismesh
