#include "simulation/SimulationEngine.hpp"
#include "bfs/BFS.hpp"
#include "dfs/DFS.hpp"
#include <algorithm>
#include <sstream>
#include <stdexcept>

namespace crisismesh {
namespace {
std::string quote(const std::string& value) {
    std::string out = "\"";
    for(char c : value) {
        if(c == '"' || c == '\\') { out += '\\'; out += c; }
        else if(c == '\n') out += "\\n";
        else if(c == '\r') out += "\\r";
        else if(c == '\t') out += "\\t";
        else out += c;
    }
    return out + "\"";
}
std::string strings(const std::vector<std::string>& values) {
    std::string out = "[";
    for(std::size_t i=0;i<values.size();++i) { if(i) out += ','; out += quote(values[i]); }
    return out + "]";
}
std::pair<double,double> aggregates(const Graph& graph, const DijkstraResult& route) {
    double risk=0, congestion=0;
    for(const auto& id:route.pathEdges) { const auto* edge=graph.getEdge(id); risk+=edge->riskLevel; congestion+=edge->congestionLevel; }
    return {risk,route.pathEdges.empty()?0:congestion/route.pathEdges.size()};
}
std::string metrics(const DijkstraResult& route,double risk,double congestion) {
    std::ostringstream o;
    o << "\"reachable\":" << (route.reachable?"true":"false")
      << ",\"distance\":" << route.totalDistance << ",\"estimatedTravelTime\":" << route.totalTravelTime
      << ",\"weightedCost\":" << route.totalCost << ",\"risk\":" << risk << ",\"congestion\":" << congestion
      << ",\"pathNodes\":" << strings(route.pathNodes) << ",\"pathEdges\":" << strings(route.pathEdges);
    return o.str();
}
const char* category(LocationType type) {
    switch(type) {
        case LocationType::Hospital:return "HOSPITAL"; case LocationType::Fire:return "FIRE_STATION";
        case LocationType::Police:return "POLICE_STATION"; case LocationType::School:return "SCHOOL";
        case LocationType::Market:return "COMMERCIAL"; case LocationType::Shelter:return "SHELTER";
        case LocationType::Residential:return "RESIDENTIAL"; case LocationType::Civic:return "CIVIC";
        case LocationType::Transport:return "TRANSPORT"; case LocationType::Industrial:return "INDUSTRIAL";
        default:return "INTERSECTION";
    }
}
}

void SimulationEngine::initializeFacilities() {
    facilities_ = {
        {"FAC-FIRE-01","FIRE_STATION","Main Fire Station","LOC-003"},
        {"FAC-FIRE-02","FIRE_STATION","East Fire Station","LOC-004"},
        {"FAC-FIRE-03","FIRE_STATION","South Terminal Fire Post","LOC-018"},
        {"FAC-MED-01","HOSPITAL","Central Hospital","LOC-001"},
        {"FAC-MED-02","HOSPITAL","North Hospital","LOC-002"},
        {"FAC-MED-03","HOSPITAL","East School Medical Post","LOC-010"},
        {"FAC-MED-04","HOSPITAL","West Shelter Medical Post","LOC-012"},
        {"FAC-POLICE-01","POLICE_STATION","Central Police Station","LOC-005"},
        {"FAC-POLICE-02","POLICE_STATION","North Police Station","LOC-006"},
        {"FAC-POLICE-03","POLICE_STATION","East Residential Police Post","LOC-016"},
        {"FAC-RESCUE-01","RESCUE_STATION","West Shelter Rescue Base","LOC-012"},
        {"FAC-RESCUE-02","RESCUE_STATION","East Shelter Rescue Base","LOC-013"},
        {"SHELTER-01","SHELTER","Emergency Shelter A","LOC-012"},
        {"SHELTER-02","SHELTER","Emergency Shelter B","LOC-013"}
    };
    responders_.clear();
    const char* types[]={"FIRE_TRUCK","AMBULANCE","POLICE_UNIT","RESCUE_TEAM"};
    const char* prefixes[]={"FIRE-UNIT-","AMB-UNIT-","POLICE-UNIT-","RESCUE-UNIT-"};
    const int counts[]={3,4,3,2};
    std::size_t facility=0;
    for(int type=0;type<4;++type) for(int unit=1;unit<=counts[type];++unit) {
        const auto& base=facilities_[facility++];
        responders_.push_back({std::string(prefixes[type])+"0"+std::to_string(unit),types[type],base.locationId,
            ResponderAvailability::Available,type==0?1:type==3?4:2,true,base.facilityId,{}});
    }
}

void SimulationEngine::saveDispatch(const Incident& incident,const Responder& responder,const DijkstraResult& route,bool reroute) {
    DispatchRecord record;
    record.incidentId=incident.incidentId; record.responderId=responder.responderId;
    record.responderStartLocationId=responder.currentLocation; record.destinationLocationId=incident.locationId;
    record.selectedRoute=route; record.graphRevision=graph_.revision(); record.dispatchSequence=++dispatchSequence_;
    const auto values=aggregates(graph_,route); record.risk=values.first; record.congestion=values.second;
    record.selectionReason="ASSIGNED_RESPONDER_REROUTE";
    if(!reroute) {
        record.candidateSummaries=lastCandidateSummaries_;
        std::size_t reachable=0; for(const auto& candidate:record.candidateSummaries) if(candidate.reachable) ++reachable;
        record.selectionReason="ONLY_REACHABLE_UNIT";
        if(reachable>1) {
            const auto& a=record.candidateSummaries[0]; const auto& b=record.candidateSummaries[1];
            record.selectionReason=a.weightedCost!=b.weightedCost?"LOWEST_WEIGHTED_COST":
                a.travelTime!=b.travelTime?"LOWER_TRAVEL_TIME_TIEBREAK":
                a.distance!=b.distance?"LOWER_DISTANCE_TIEBREAK":"RESPONDER_ID_TIEBREAK";
        }
    }
    for(auto& existing:dispatches_) if(existing.incidentId==incident.incidentId) { existing=std::move(record); return; }
    dispatches_.push_back(std::move(record));
}

void SimulationEngine::releaseResponder(const Incident& incident) {
    for(auto& responder:responders_) if(responder.assignedIncidentId==incident.incidentId) {
        responder.assignedIncidentId.clear(); responder.availability=ResponderAvailability::Available;
        responder.currentLocation=incident.locationId;
    }
    dispatches_.erase(std::remove_if(dispatches_.begin(),dispatches_.end(),
        [&](const DispatchRecord& record){return record.incidentId==incident.incidentId;}),dispatches_.end());
}

void SimulationEngine::retryWaiting() {
    for(auto& incident:incidents_) if(incident.status==IncidentStatus::WaitingForResource) {
        bool available=false;
        for(const auto& responder:responders_) if(responder.availability==ResponderAvailability::Available &&
            responderTypeMatches(incident.type,responder.type)) { available=true; break; }
        if(available) {
            incident.status=IncidentStatus::Queued; refreshIncidentIndex(incident); intakeQueue_.enqueue(incident);
            emit("INCIDENT_REQUEUED",&incident,incident.locationId,"","Waiting incident returned to FIFO intake");
        }
    }
}

void SimulationEngine::recoverRoads() {
    for(auto& incident:incidents_) if(incident.status==IncidentStatus::Unreachable && !incident.assignedResponderId.empty()) {
        incident.status=IncidentStatus::RerouteRequired;
        emit("REROUTE_REQUIRED",&incident,incident.locationId,"","Reopened network permits a routing retry");
        rerouteAssignedIncident(incident.incidentId);
    }
    retryWaiting();
}

std::string SimulationEngine::networkJson() const {
    std::ostringstream o;
    o << "\"network\":{\"graphRevision\":" << graph_.revision() << ",\"nodes\":[";
    bool first=true;
    std::vector<std::string> nodeIds;
    for(const auto& pair:graph_.vertices())nodeIds.push_back(pair.first);
    std::sort(nodeIds.begin(),nodeIds.end());
    for(const auto& id:nodeIds) {
        const auto* node=graph_.getVertex(id);
        if(!first) o<<',';
        first=false;
        o << "{\"locationId\":" << quote(node->id) << ",\"name\":" << quote(node->name)
          << ",\"zone\":" << quote(node->zone) << ",\"category\":" << quote(category(node->type))
          << ",\"x\":" << node->coordinate.x << ",\"y\":" << node->coordinate.y << ",\"status\":" << quote(node->status) << "}";
    }
    o << "],\"roads\":[";
    std::vector<std::string> ids; for(const auto& pair:graph_.edges())ids.push_back(pair.first);
    std::sort(ids.begin(),ids.end()); first=true;
    for(const auto& id:ids) {
        const auto& edge=*graph_.getEdge(id); if(!first) o<<',';
        first=false;
        o << "{\"roadId\":" << quote(id) << ",\"from\":" << quote(edge.from) << ",\"to\":" << quote(edge.to)
          << ",\"distance\":" << edge.distance << ",\"travelTime\":" << edge.travelTime
          << ",\"risk\":" << edge.riskLevel << ",\"congestion\":" << edge.congestionLevel
          << ",\"capacity\":" << edge.capacity << ",\"blocked\":" << (edge.blocked?"true":"false")
          << ",\"roadClass\":" << quote(edge.roadClass) << "}";
    }
    o << "]},\"facilities\":[";first=true;
    for(const auto& facility:facilities_) {
        if(!first) o<<',';
        first=false;
        o << "{\"facilityId\":" << quote(facility.facilityId) << ",\"category\":" << quote(facility.category)
          << ",\"name\":" << quote(facility.name) << ",\"locationId\":" << quote(facility.locationId) << "}";
    }
    return o.str()+"]";
}

std::string SimulationEngine::dispatchesJson() const {
    std::ostringstream o; o << '['; bool first=true;
    for(const auto& record:dispatches_) {
        if(!first) o<<',';
        first=false;
        const auto& route=record.selectedRoute;
        o << "{\"incidentId\":" << quote(record.incidentId) << ",\"responderId\":" << quote(record.responderId)
          << ",\"origin\":" << quote(record.responderStartLocationId) << ",\"destination\":" << quote(record.destinationLocationId)
          << ",\"status\":" << quote(toString(findIncident(record.incidentId)->status))
          << ",\"graphRevision\":" << record.graphRevision << ",\"dispatchSequence\":" << record.dispatchSequence
          << ",\"stale\":" << (record.graphRevision!=graph_.revision()?"true":"false")
          << ",\"selectionReason\":" << quote(record.selectionReason)
          << ",\"routeCost\":" << route.totalCost << ",\"travelTime\":" << route.totalTravelTime << ',' << metrics(route,record.risk,record.congestion)
          << ",\"candidateSummaries\":[";
        for(std::size_t i=0;i<record.candidateSummaries.size();++i) {
            if(i) o<<',';
            const auto& c=record.candidateSummaries[i];
            o << "{\"responderId\":" << quote(c.responderId) << ",\"responderType\":" << quote(c.responderType)
              << ",\"startLocationId\":" << quote(c.startLocationId) << ",\"destinationLocationId\":" << quote(c.destinationLocationId)
              << ",\"graphRevision\":" << c.graphRevision << ",\"reachable\":" << (c.reachable?"true":"false")
              << ",\"distance\":" << c.distance << ",\"estimatedTravelTime\":" << c.travelTime << ",\"weightedCost\":" << c.weightedCost
              << ",\"risk\":" << c.risk << ",\"congestion\":" << c.congestion << ",\"pathNodes\":" << strings(c.pathNodes)
              << ",\"pathEdges\":" << strings(c.pathEdges) << "}";
        }
        o << "]}";
    }
    return o.str()+"]";
}

std::string SimulationEngine::analyze(const std::string& algorithm,const std::string& source,const std::string& destination) const {
    std::ostringstream result,events;
    result << "{\"algorithm\":" << quote(algorithm) << ",\"source\":" << quote(source) << ",\"destination\":" << quote(destination)
           << ",\"graphRevision\":" << graph_.revision();
    events << '[';
    if(algorithm=="DIJKSTRA") {
        const auto route=dijkstra_.run(graph_,source,destination); const auto values=aggregates(graph_,route);
        result << ',' << metrics(route,values.first,values.second);
        for(std::size_t i=0;i<route.events.size();++i) {
            const auto& event=route.events[i];if(i)events<<',';
            events << "{\"type\":" << quote(toString(event.type)) << ",\"algorithm\":\"DIJKSTRA\",\"step\":" << i+1
                   << ",\"graphRevision\":" << graph_.revision() << ",\"nodeId\":" << quote(event.nodeId)
                   << ",\"edgeId\":" << quote(event.edgeId) << ",\"message\":" << quote(event.message) << "}";
        }
    } else if(algorithm=="BFS"||algorithm=="DFS") {
        const auto traversal=algorithm=="BFS"?BFS{}.run(graph_,source,destination):DFS{}.run(graph_,source,destination);
        result << ",\"reachable\":" << (traversal.reachable?"true":"false") << ",\"visitOrder\":" << strings(traversal.visitOrder)
               << ",\"pathNodes\":" << strings(traversal.pathNodes) << ",\"pathEdges\":" << strings(traversal.pathEdges);
        if(algorithm=="BFS")result << ",\"minimumHops\":" << (traversal.reachable?std::to_string(traversal.pathEdges.size()):"null");
        for(std::size_t i=0;i<traversal.events.size();++i) {
            const auto& event=traversal.events[i];if(i)events<<',';
            events << "{\"type\":" << quote(event.type) << ",\"algorithm\":" << quote(algorithm) << ",\"step\":" << i+1
                   << ",\"graphRevision\":" << graph_.revision() << ",\"nodeId\":" << quote(event.nodeId)
                   << ",\"edgeId\":" << quote(event.edgeId) << ",\"parentNodeId\":" << quote(event.parentNodeId)
                   << ",\"queueSize\":" << event.queueSize << ",\"stackSize\":" << event.stackSize
                   << ",\"message\":" << quote(event.message) << "}";
        }
    } else throw std::invalid_argument("Unknown analysis algorithm");
    result << '}';events << ']';
    return "{\"ok\":true,\"state\":"+stateToJson()+",\"events\":"+events.str()+",\"result\":"+result.str()+"}";
}
} // namespace crisismesh
