#include "simulation/SimulationEngine.hpp"
#include "graph/CityData.hpp"
#include "array/OperationalArray.hpp"
#include <algorithm>
#include <sstream>
#include <stdexcept>
#include <unordered_set>

namespace crisismesh {
namespace {
std::string q(const std::string&s){std::string o="\"";for(char c:s){if(c=='\\')o+="\\\\";else if(c=='"')o+="\\\"";else if(c=='\n')o+="\\n";else o+=c;}return o+"\"";}
std::string arr(const std::vector<std::string>&v){std::ostringstream o;o<<"[";for(size_t i=0;i<v.size();++i){if(i)o<<',';o<<q(v[i]);}return o.str()+"]";}
}

SimulationEngine::SimulationEngine() : graph_(createCrisisMeshCity()), incidentTable_(17) {
    initializeFacilities();
    rebuildLocationDirectory();
}

void SimulationEngine::emit(const std::string&type,const Incident*in,const std::string&node,const std::string&edge,const std::string&message,int value){
    AlgorithmEvent e; e.type=type;e.algorithm="SIMULATION";e.step=events_.size()+1;e.nodeId=node;e.edgeId=edge;e.message=message;e.priority=in?in->priorityScore:value;e.key=in?in->incidentId:"";e.status=in?toString(in->status):"";e.size=events_.size()+1;e.value1=value; if(in)e.responderId=in->assignedResponderId;events_.push_back(std::move(e));
}
Incident& SimulationEngine::mutableIncident(const std::string&id){const auto* record=incidentTable_.search(id);if(record&&record->incidentIndex<incidents_.size()&&incidents_[record->incidentIndex].incidentId==id)return incidents_[record->incidentIndex];throw std::invalid_argument("Unknown incident: "+id);}
const Incident* SimulationEngine::findIncident(const std::string&id) const {const auto* record=incidentTable_.search(id,false);if(record&&record->incidentIndex<incidents_.size()&&incidents_[record->incidentIndex].incidentId==id)return &incidents_[record->incidentIndex];return nullptr;}
const Shelter* SimulationEngine::findShelter(const std::string&id) const { for (const auto& s : allocationEngine_.shelters()) if (s.shelterId == id) return &s; return nullptr; }
std::vector<std::string> SimulationEngine::intakeIncidentIds() const { std::vector<std::string> ids; for(const auto& incident:intakeQueue_.values()) ids.push_back(incident.incidentId); return ids; }
void SimulationEngine::rebuildLocationDirectory(){locationDirectory_.clear();for(const auto& pair:graph_.vertices())locationDirectory_.insert({pair.second.id,pair.second.name,pair.second.type});}
void SimulationEngine::refreshIncidentIndex(const Incident& incident){const auto* record=incidentTable_.search(incident.incidentId);if(record)incidentTable_.update({incident.incidentId,toString(incident.type),toString(incident.status),incident.priorityScore,record->incidentIndex});}
void SimulationEngine::archiveClosedIncident(const Incident& incident){if(archiveIndex_.insert({incident.reportedSequence,incident.incidentId,toString(incident.status)}))emit("AVL_ARCHIVE_INSERT",&incident,incident.locationId,"","Closed incident indexed in balanced AVL archive");}

Incident SimulationEngine::reportEmergency(
    IncidentType type,
    const std::string& locationId,
    int severity,
    int urgency,
    int victimCount,
    const std::string& description,
    const std::string& reportedByUserId
){
    if(!locationDirectory_.find(locationId)) rebuildLocationDirectory();
    if(!locationDirectory_.find(locationId) || !graph_.vertexExists(locationId))
        throw std::invalid_argument("Invalid incident location: " + locationId);

    if(!Incident::validSeverity(severity) ||
       !Incident::validUrgency(urgency) ||
       victimCount < 0)
        throw std::invalid_argument("Invalid incident severity, urgency, or victim count");

    Incident i;

    i.incidentId = "INC-" + std::to_string(nextIncidentNumber_++);
    i.type = type;
    i.locationId = locationId;
    i.severity = severity;
    i.urgency = urgency;
    i.victimCount = victimCount;

    i.priorityScore =
        Incident::calculatePriority(
            severity,
            urgency,
            victimCount,
            type
        );

    i.status = IncidentStatus::Reported;
    i.reportedSequence = ++sequence_;

    i.requiredResponderType =
        (
            type == IncidentType::Fire
                ? "FIRE_TRUCK"
                : type == IncidentType::Medical ||
                  type == IncidentType::Accident
                    ? "AMBULANCE"
                    : type == IncidentType::Police
                        ? "POLICE_UNIT"
                        : "RESCUE_TEAM"
        );

    i.description = description;

    // User ownership of the emergency request.
    i.reportedByUserId = reportedByUserId;
    i.userConfirmedResolved = false;
    i.escalationReason.clear();

    incidents_.push_back(i);

    incidentTable_.insert({
        i.incidentId,
        toString(i.type),
        toString(i.status),
        i.priorityScore,
        incidents_.size() - 1
    });

    emit(
        "INCIDENT_CREATED",
        &i,
        i.locationId,
        "",
        "Emergency created in C++ authoritative engine"
    );

    i.status = IncidentStatus::Queued;

    mutableIncident(i.incidentId).status = i.status;
    refreshIncidentIndex(mutableIncident(i.incidentId));

    intakeQueue_.enqueue(i);

    emit(
        "INCIDENT_QUEUED",
        &i,
        i.locationId,
        "",
        "Incident entered FIFO emergency intake queue"
    );

    return i;
}
DispatchResult SimulationEngine::processNextIncident(){
    retryWaiting();
    // Move every waiting request through triage/priority into the authoritative
    // manual Max Heap, then select exactly one highest-priority incident.
    while(!intakeQueue_.isEmpty()) {
        Incident queued=intakeQueue_.dequeue();
        Incident&i=mutableIncident(queued.incidentId);
        if(i.status!=IncidentStatus::Queued) continue;
        i.status=IncidentStatus::Triaged; emit("INCIDENT_TRIAGED",&i,i.locationId,"","Incident triaged");
        i.status=IncidentStatus::Prioritized;
        i.priorityScore=Incident::calculatePriority(i.severity,i.urgency,i.victimCount,i.type);
        refreshIncidentIndex(i);
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
    while(mutableIncident(selected.incidentId).status!=IncidentStatus::Prioritized) {
        if(maxHeap_.isEmpty()) return {false,{},{},{},"No incident waiting for dispatch"};
        selected=maxHeap_.extractMax();
    }
    Incident&si=mutableIncident(selected.incidentId); si.status=IncidentStatus::Prioritized;
    emit("MAX_HEAP_EXTRACT",&si,si.locationId,"","Highest-priority incident selected from max heap");
    AlgorithmEvent h; h.type="MAX_HEAP_STATE"; h.algorithm="MAX_HEAP"; h.step=events_.size()+1; h.size=maxHeap_.size(); h.message="Actual Max Heap array snapshot after extraction";
    for(std::size_t k=0;k<maxHeap_.values().size();++k){ if(k) h.value += "|"; h.value += maxHeap_.values()[k].incidentId + ":" + std::to_string(maxHeap_.values()[k].priorityScore); }
    events_.push_back(std::move(h));
    return dispatchIncident(si.incidentId);
}

Responder* SimulationEngine::chooseResponder(const Incident&incident,DijkstraResult&bestRoute){
    struct Evaluation { Responder* responder{nullptr}; DijkstraResult route{}; };
    OperationalArray<Evaluation, 32> candidates;
    lastCandidateSummaries_.clear();
    for(auto&r:responders_){
        if(r.availability!=ResponderAvailability::Available||!responderTypeMatches(incident.type,r.type))continue;
        emit("RESPONDER_CHECKED",&incident,r.currentLocation,"","Eligible responder evaluated");
        auto route=dijkstra_.run(graph_,r.currentLocation,incident.locationId);
        if(!candidates.pushBack({&r,route})) throw std::overflow_error("Responder candidate array capacity exceeded");
        ResponderCandidateSummary summary;
        summary.responderId=r.responderId; summary.reachable=route.reachable;
        summary.weightedCost=route.totalCost; summary.travelTime=route.totalTravelTime; summary.distance=route.totalDistance;
        summary.responderType=r.type; summary.startLocationId=r.currentLocation; summary.destinationLocationId=incident.locationId;
        summary.pathNodes=route.pathNodes; summary.pathEdges=route.pathEdges; summary.graphRevision=graph_.revision();
        for(const auto& edgeId:route.pathEdges) { const auto* edge=graph_.getEdge(edgeId);summary.risk+=edge->riskLevel;summary.congestion+=edge->congestionLevel; }
        if(!route.pathEdges.empty())summary.congestion/=route.pathEdges.size();
        lastCandidateSummaries_.push_back(std::move(summary));
        if(!route.reachable){
            AlgorithmEvent candidate; candidate.type="RESPONDER_CANDIDATE"; candidate.algorithm="ALLOCATION_ENGINE"; candidate.step=events_.size()+1; candidate.key=incident.incidentId; candidate.responderId=r.responderId; candidate.status="UNREACHABLE"; candidate.message="Eligible responder has no reachable C++ Dijkstra route"; events_.push_back(std::move(candidate));
            continue;
        }
        AlgorithmEvent candidate; candidate.type="RESPONDER_CANDIDATE"; candidate.algorithm="ALLOCATION_ENGINE"; candidate.step=events_.size()+1; candidate.key=incident.incidentId; candidate.responderId=r.responderId; candidate.status="REACHABLE"; candidate.value1=route.totalCost; candidate.value2=route.totalDistance; candidate.message="Eligible responder route cost evaluated by C++ Dijkstra"; events_.push_back(std::move(candidate));
    }
    mergeSortCandidates(lastCandidateSummaries_);
    if(lastCandidateSummaries_.empty()||!lastCandidateSummaries_.front().reachable)return nullptr;
    for(std::size_t index=0;index<candidates.size();++index)if(candidates[index].responder->responderId==lastCandidateSummaries_.front().responderId){bestRoute=candidates[index].route;return candidates[index].responder;}
    return nullptr;
}
DispatchResult SimulationEngine::dispatchIncident(const std::string&id){
    Incident&i=mutableIncident(id);
    if(i.status!=IncidentStatus::Queued && i.status!=IncidentStatus::Prioritized && i.status!=IncidentStatus::WaitingForResource)
        return {false,i,{},{},"Incident is not eligible for dispatch"};
    DijkstraResult route;Responder*r=chooseResponder(i,route);
    if(!r){i.status=IncidentStatus::WaitingForResource;refreshIncidentIndex(i);emit("WAITING_FOR_RESOURCE",&i,i.locationId,"","No available eligible responder has a valid route");return {false,i,{},route,"No eligible reachable responder"};}
    i.assignedResponderId=r->responderId;i.status=IncidentStatus::Assigned;r->availability=ResponderAvailability::Assigned;
    r->assignedIncidentId=i.incidentId;
    saveDispatch(i,*r,route);
    refreshIncidentIndex(i);
    emit("RESPONDER_SELECTED",&i,r->currentLocation,"","Best reachable responder selected");
    emit("DISPATCH_STARTED",&i,r->currentLocation,"","Dispatch started");
    emit("ROUTE_CALCULATED",&i,r->currentLocation,"","C++ Dijkstra route selected");
    i.status=IncidentStatus::EnRoute;refreshIncidentIndex(i);emit("INCIDENT_EN_ROUTE",&i,i.locationId,"","Responder is en route");
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
    const auto active=dispatches_;
    graph_.blockEdge(id);
    roadUndoStack_.push({id,false});
    emit("ROAD_BLOCKED",nullptr,"",id,"Road blocked in authoritative C++ graph");
    for(const auto&a:active){
        if(std::find(a.selectedRoute.pathEdges.begin(),a.selectedRoute.pathEdges.end(),id)!=a.selectedRoute.pathEdges.end()){
            Incident& inc=mutableIncident(a.incidentId);
            inc.status=IncidentStatus::RerouteRequired;
            refreshIncidentIndex(inc);
            emit("REROUTE_REQUIRED",&inc,inc.locationId,id,"Active route used the blocked road");
            rerouteAssignedIncident(a.incidentId);
        }
    }
    return true;
}
bool SimulationEngine::unblockRoad(const std::string&id){if(!graph_.unblockEdge(id))return false;emit("ROAD_UNBLOCKED",nullptr,"",id,"Road reopened in authoritative C++ graph");recoverRoads();return true;}
bool SimulationEngine::undoLastRoadBlock(){
    if(roadUndoStack_.isEmpty()) return false;
    const RoadUndoAction action=roadUndoStack_.pop();
    if(action.wasBlocked) graph_.blockEdge(action.edgeId); else graph_.unblockEdge(action.edgeId);
    recoverRoads();
    emit("ROAD_OPERATION_UNDONE",nullptr,"",action.edgeId,"Last road block restored using the manual Stack");
    return true;
}
DispatchResult SimulationEngine::rerouteAssignedIncident(const std::string&id){
    Incident&i=mutableIncident(id);Responder*r=nullptr;for(auto&x:responders_)if(x.responderId==i.assignedResponderId)r=&x;
    if(!r || r->assignedIncidentId!=i.incidentId)return {false,i,{},{},"Active assigned responder not found"};
    auto route=dijkstra_.run(graph_,r->currentLocation,i.locationId);
    saveDispatch(i,*r,route,true);
    if(!route.reachable){i.status=IncidentStatus::Unreachable;refreshIncidentIndex(i);emit("DESTINATION_UNREACHABLE",&i,i.locationId,"","No route after road change");return {false,i,*r,route,"Destination unreachable"};}
    i.status=IncidentStatus::EnRoute;refreshIncidentIndex(i);emit("REROUTE_CALCULATED",&i,r->currentLocation,"","New route calculated by C++ Dijkstra");
    return {true,i,*r,route,"Reroute successful"};
}
bool SimulationEngine::setResponderAvailability(const std::string& responderId, ResponderAvailability availability){
    for(auto& r:responders_) if(r.responderId==responderId){
        if(!r.assignedIncidentId.empty()) return false;
        r.availability=availability;
        if(availability==ResponderAvailability::Available) retryWaiting();
        emit("RESPONDER_STATE_CHANGED",nullptr,r.currentLocation,"","Responder availability updated: "+std::string(toString(availability)));
        return true;
    }
    return false;
}

bool SimulationEngine::resolveIncident(const std::string&id){
    Incident&i=mutableIncident(id);

    if (
        i.status == IncidentStatus::Resolved ||
        i.status == IncidentStatus::Closed
    ) return false;

    i.status=IncidentStatus::Resolved;

    history_.insertBack(std::to_string(i.reportedSequence)+" | "+i.incidentId+" | "+toString(i.status));

    emit(
        "INCIDENT_RESOLVED",
        &i,
        i.locationId,
        "",
        "Incident marked resolved"
    );

    emit(
        "HISTORY_UPDATED",
        &i,
        i.locationId,
        "",
        "Resolved incident appended to manual linked-list history"
    );

    releaseResponder(i);
    retryWaiting();

    i.status=IncidentStatus::Closed;

    refreshIncidentIndex(i);
    archiveClosedIncident(i);

    emit(
        "INCIDENT_CLOSED",
        &i,
        i.locationId,
        "",
        "Incident lifecycle closed"
    );

    return true;
}


/* =========================================================
   AUTHOR / RESPONDER COMPLETES FIELD RESPONSE
   ========================================================= */

bool SimulationEngine::markResponseCompleted(
    const std::string& incidentId
){
    Incident& i =
        mutableIncident(incidentId);

    if (
        i.status != IncidentStatus::EnRoute &&
        i.status != IncidentStatus::Assigned &&
        i.status != IncidentStatus::RerouteRequired
    ){
        return false;
    }

    i.status =
        IncidentStatus::ResponseCompleted;

    emit(
        "RESPONSE_COMPLETED",
        &i,
        i.locationId,
        "",
        "Field response completed; waiting for reporting-user confirmation"
    );

    /*
     * Once the response team reaches/completes the operation,
     * the responder can become available again.
     */
    releaseResponder(i);
    retryWaiting();

    i.status =
        IncidentStatus::AwaitingUserConfirmation;

    refreshIncidentIndex(i);

    emit(
        "AWAITING_USER_CONFIRMATION",
        &i,
        i.locationId,
        "",
        "User must confirm whether the emergency has been resolved"
    );

    return true;
}


/* =========================================================
   USER: YES, PROBLEM HAS BEEN SOLVED
   ========================================================= */

bool SimulationEngine::confirmIncidentResolved(
    const std::string& incidentId,
    const std::string& userId
){
    Incident& i =
        mutableIncident(incidentId);

    if(
        i.status !=
        IncidentStatus::AwaitingUserConfirmation
    ){
        return false;
    }

    /*
     * Only the user who reported this incident
     * may confirm final resolution.
     */
    if(
        !i.reportedByUserId.empty() &&
        i.reportedByUserId != userId
    ){
        return false;
    }

    i.userConfirmedResolved = true;
    i.escalationReason.clear();

    emit(
        "USER_CONFIRMED_RESOLUTION",
        &i,
        i.locationId,
        "",
        "Reporting user confirmed that the emergency was resolved"
    );

    i.status =
        IncidentStatus::Resolved;

    history_.insertBack(std::to_string(i.reportedSequence)+" | "+i.incidentId+" | "+toString(i.status));

    emit(
        "INCIDENT_RESOLVED",
        &i,
        i.locationId,
        "",
        "Incident resolved after user confirmation"
    );

    emit(
        "HISTORY_UPDATED",
        &i,
        i.locationId,
        "",
        "Resolved incident appended to manual linked-list history"
    );

    /*
     * CLOSED means the incident must no longer appear
     * as an active/red emergency on the operations map.
     */
    i.status =
        IncidentStatus::Closed;

    refreshIncidentIndex(i);
    archiveClosedIncident(i);

    emit(
        "INCIDENT_CLOSED",
        &i,
        i.locationId,
        "",
        "User-confirmed incident closed and removed from active emergency state"
    );

    return true;
}


/* =========================================================
   USER: NO, I STILL NEED HELP
   ========================================================= */

bool SimulationEngine::escalateIncident(
    const std::string& incidentId,
    const std::string& userId,
    const std::string& reason
){
    Incident& i =
        mutableIncident(incidentId);

    if(
        i.status !=
        IncidentStatus::AwaitingUserConfirmation
    ){
        return false;
    }

    if(
        !i.reportedByUserId.empty() &&
        i.reportedByUserId != userId
    ){
        return false;
    }

    i.userConfirmedResolved = false;
    i.escalationReason = reason;

    i.status =
        IncidentStatus::Escalated;

    /*
     * Escalation increases urgency by one level,
     * while still respecting the academic 1..5 rule.
     */
    if(i.urgency < 5){
        ++i.urgency;
    }

    i.priorityScore =
        Incident::calculatePriority(
            i.severity,
            i.urgency,
            i.victimCount,
            i.type
        );

    emit(
        "INCIDENT_ESCALATED",
        &i,
        i.locationId,
        "",
        reason.empty()
            ? "User reported that further assistance is required"
            : reason
    );

    /*
     * Previous responder assignment remains in event/history,
     * but the incident must be eligible for a new dispatch.
     */
    i.assignedResponderId.clear();

    i.status =
        IncidentStatus::Queued;

    refreshIncidentIndex(i);

    /*
     * Re-enter the authoritative manual FIFO intake queue.
     * PROCESS_NEXT will triage it and place it in Max Heap again.
     */
    intakeQueue_.enqueue(i);

    emit(
        "INCIDENT_REQUEUED",
        &i,
        i.locationId,
        "",
        "Escalated incident returned to FIFO intake queue for redispatch"
    );

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
     <<",\"reportedByUserId\":"<<(i.reportedByUserId.empty()?"null":q(i.reportedByUserId))
     <<",\"userConfirmedResolved\":"<<(i.userConfirmedResolved?"true":"false")
     <<",\"escalationReason\":"<<(i.escalationReason.empty()?"null":q(i.escalationReason))
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
      << ",\"incidentArchive\":{\"size\":" << archiveIndex_.size() << ",\"balanced\":" << (archiveIndex_.isBalanced()?"true":"false") << "}"
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
        const std::string& assignedIncident=r.assignedIncidentId;
        std::string operationalStatus=toString(r.availability);
        if(!assignedIncident.empty()) {
            const auto* incident=findIncident(assignedIncident);
            if(incident)operationalStatus=toString(incident->status);
        }
        o << "{\"responderId\":"<<q(r.responderId)
          <<",\"type\":"<<q(r.type)
          <<",\"locationId\":"<<q(r.currentLocation)
          <<",\"availability\":"<<q(toString(r.availability))
          <<",\"status\":"<<q(operationalStatus)
          <<",\"assignedIncidentId\":"<<(assignedIncident.empty()?"null":q(assignedIncident))
          <<",\"baseFacilityId\":"<<q(r.baseFacilityId)
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

    o << ',' << networkJson();
    const auto savedDispatches=dispatchesJson();
    o << ",\"activeDispatches\":" << savedDispatches << ",\"dispatches\":" << savedDispatches;

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
    for (const auto& record : dispatches_) {
        const auto& route=record.selectedRoute;
        if(route.reachable) { ++activeRouteCount;distanceSum+=route.totalDistance;travelTimeSum+=route.totalTravelTime; }
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
    dispatches_.clear(); dispatchSequence_=0;
    graph_.replaceWith(createCrisisMeshCity()); intakeQueue_.clear(); maxHeap_.clear(); incidents_.clear(); responders_.clear();
    incidentTable_.clear(); history_.clear(); archiveIndex_.clear(); locationDirectory_.clear(); lastCandidateSummaries_.clear(); events_.clear(); allocationEngine_.reset(); roadUndoStack_.clear(); sequence_=0; nextIncidentNumber_=201;
    initializeFacilities();
    rebuildLocationDirectory();
}

} // namespace crisismesh

