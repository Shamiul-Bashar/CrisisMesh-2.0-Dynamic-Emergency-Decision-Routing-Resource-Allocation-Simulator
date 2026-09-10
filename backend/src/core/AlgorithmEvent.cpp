#include "core/AlgorithmEvent.hpp"
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
void nullable(std::ostringstream& o, const std::string& v) { if (v.empty()) o << "null"; else quote(o, v); }
}

const char* algorithmEventType(const AlgorithmEvent& event) { return event.type.c_str(); }

std::string algorithmEventsToJson(const TraversalResult& result,
                                  const std::string& source,
                                  const std::string& destination,
                                  const std::string& algorithm) {
    std::ostringstream o;
    o << "{\"algorithm\":"; quote(o, algorithm);
    o << ",\"sourceNodeId\":"; quote(o, source);
    o << ",\"destinationNodeId\":"; quote(o, destination);
    o << ",\"reachable\":" << (result.reachable ? "true" : "false");
    o << ",\"sourceEqualsDestination\":" << (result.sourceEqualsDestination ? "true" : "false");
    o << ",\"visitOrder\":[";
    for (std::size_t i=0;i<result.visitOrder.size();++i) { if(i) o<<','; quote(o,result.visitOrder[i]); }
    o << "],\"pathNodes\":[";
    for (std::size_t i=0;i<result.pathNodes.size();++i) { if(i) o<<','; quote(o,result.pathNodes[i]); }
    o << "],\"pathEdges\":[";
    for (std::size_t i=0;i<result.pathEdges.size();++i) { if(i) o<<','; quote(o,result.pathEdges[i]); }
    o << "],\"events\":[";
    for (std::size_t i=0;i<result.events.size();++i) {
        const auto& e=result.events[i]; if(i) o<<',';
        o << "{\"type\":"; quote(o,e.type);
        o << ",\"algorithm\":"; quote(o,e.algorithm);
        o << ",\"step\":" << e.step;
        o << ",\"nodeId\":"; nullable(o,e.nodeId);
        o << ",\"edgeId\":"; nullable(o,e.edgeId);
        o << ",\"parentNodeId\":"; nullable(o,e.parentNodeId);
        o << ",\"queueSize\":" << e.queueSize;
        o << ",\"stackSize\":" << e.stackSize;
        o << ",\"visitedCount\":" << e.visitedCount;
        o << ",\"size\":" << e.size;
        o << ",\"bucket\":" << e.bucket;
        o << ",\"collisionCount\":" << e.collisionCount;
        o << ",\"key\":"; nullable(o,e.key);
        o << ",\"value\":"; nullable(o,e.value);
        o << ",\"message\":"; quote(o,e.message);
        o << ",\"priority\":" << e.priority;
        o << ",\"value1\":" << e.value1;
        o << ",\"value2\":" << e.value2;
        o << ",\"responderId\":"; nullable(o,e.responderId);
        o << ",\"status\":"; nullable(o,e.status);
        o << ",\"pathNodes\":[";
        for (std::size_t j=0;j<e.pathNodes.size();++j) { if(j)o<<','; quote(o,e.pathNodes[j]); }
        o << "],\"pathEdges\":[";
        for (std::size_t j=0;j<e.pathEdges.size();++j) { if(j)o<<','; quote(o,e.pathEdges[j]); }
        o << "]";
        o << "}";
    }
    o << "]}";
    return o.str();
}
} // namespace crisismesh
