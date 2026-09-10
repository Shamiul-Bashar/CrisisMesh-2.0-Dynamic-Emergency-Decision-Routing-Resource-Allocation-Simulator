#include "dijkstra/JsonTrace.hpp"

#include <iomanip>
#include <sstream>

namespace crisismesh {

namespace {
std::string escape(const std::string& value) {
    std::string out;
    for (char c : value) {
        if (c == '\\') out += "\\\\";
        else if (c == '"') out += "\\\"";
        else if (c == '\n') out += "\\n";
        else out += c;
    }
    return out;
}
void quote(std::ostringstream& o, const std::string& v) { o << '"' << escape(v) << '"'; }
void number(std::ostringstream& o, double v) {
    if (v < -0.5) o << "null";
    else o << std::fixed << std::setprecision(3) << v;
}
}

std::string resultToJson(const DijkstraResult& result,
                         const std::string& source,
                         const std::string& destination,
                         const Graph&) {
    std::ostringstream o;
    o << "{";
    o << "\"sourceNodeId\":"; quote(o, source);
    o << ",\"destinationNodeId\":"; quote(o, destination);
    o << ",\"reachable\":" << (result.reachable ? "true" : "false");
    o << ",\"sourceEqualsDestination\":" << (result.sourceEqualsDestination ? "true" : "false");
    o << ",\"totalCost\":"; number(o, result.totalCost);
    o << ",\"totalDistance\":"; number(o, result.totalDistance);
    o << ",\"totalTravelTime\":"; number(o, result.totalTravelTime);
    o << ",\"nodesExplored\":" << result.nodesExplored;
    o << ",\"pathNodes\":[";
    for (std::size_t i=0;i<result.pathNodes.size();++i) { if(i) o<<","; quote(o,result.pathNodes[i]); }
    o << "],\"pathEdges\":[";
    for (std::size_t i=0;i<result.pathEdges.size();++i) { if(i) o<<","; quote(o,result.pathEdges[i]); }
    o << "],\"events\":[";
    for (std::size_t i=0;i<result.events.size();++i) {
        const auto& e=result.events[i];
        if(i) o<<",";
        o << "{";
        o << "\"type\":"; quote(o,toString(e.type));
        o << ",\"nodeId\":"; if(e.nodeId.empty()) o<<"null"; else quote(o,e.nodeId);
        o << ",\"edgeId\":"; if(e.edgeId.empty()) o<<"null"; else quote(o,e.edgeId);
        o << ",\"fromNodeId\":"; if(e.fromNodeId.empty()) o<<"null"; else quote(o,e.fromNodeId);
        o << ",\"toNodeId\":"; if(e.toNodeId.empty()) o<<"null"; else quote(o,e.toNodeId);
        o << ",\"currentDistance\":"; number(o,e.currentDistance);
        o << ",\"oldDistance\":"; number(o,e.oldDistance);
        o << ",\"candidateDistance\":"; number(o,e.candidateDistance);
        o << ",\"edgeCost\":"; number(o,e.edgeCost);
        o << ",\"queueSize\":" << e.queueSize;
        o << ",\"visitedCount\":" << e.visitedCount;
        o << ",\"message\":"; quote(o,e.message);
        o << "}";
    }
    o << "],\"pathMetrics\":{";
    o << "\"roads\":" << result.pathEdges.size();
    o << ",\"distanceKm\":"; number(o,result.totalDistance);
    o << ",\"travelTimeMin\":"; number(o,result.totalTravelTime);
    o << "}";
    o << "}";
    return o.str();
}

} // namespace crisismesh
