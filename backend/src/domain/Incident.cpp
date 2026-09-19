#include "domain/Incident.hpp"
#include <algorithm>
#include <cctype>
#include <stdexcept>

namespace crisismesh {
int Incident::calculatePriority(int severity,int urgency,int victimCount,IncidentType type) {
    const int victimScore = std::min(victimCount, 10) * 3;
    int typeScore = 0;
    switch(type) {
        case IncidentType::Fire: typeScore=8; break;
        case IncidentType::Medical: typeScore=7; break;
        case IncidentType::Police: typeScore=6; break;
        case IncidentType::Structural: typeScore=7; break;
        case IncidentType::Flood: typeScore=5; break;
        case IncidentType::Accident: typeScore=6; break;
        case IncidentType::Rescue: typeScore=5; break;
    }
    return severity*12 + urgency*10 + victimScore + typeScore;
}
bool Incident::validLocationId(const std::string& id) {
    if(id.size()!=7 || id.rfind("LOC-",0)!=0) return false;
    for(size_t i=4;i<7;++i) if(!std::isdigit(static_cast<unsigned char>(id[i]))) return false;
    int n=std::stoi(id.substr(4)); return n>=1 && n<=24;
}
bool Incident::validSeverity(int v){return v>=1&&v<=5;}
bool Incident::validUrgency(int v){return v>=1&&v<=5;}
const char* toString(IncidentType t){switch(t){case IncidentType::Medical:return "MEDICAL";case IncidentType::Fire:return "FIRE";case IncidentType::Police:return "POLICE";case IncidentType::Rescue:return "RESCUE";case IncidentType::Accident:return "ACCIDENT";case IncidentType::Flood:return "FLOOD";default:return "STRUCTURAL";}}
const char* toString(IncidentStatus s){switch(s){case IncidentStatus::Reported:return "REPORTED";case IncidentStatus::Queued:return "QUEUED";case IncidentStatus::Triaged:return "TRIAGED";case IncidentStatus::Prioritized:return "PRIORITIZED";case IncidentStatus::Assigned:return "ASSIGNED";case IncidentStatus::EnRoute:return "EN_ROUTE";case IncidentStatus::RerouteRequired:return "REROUTE_REQUIRED";case IncidentStatus::Resolved:return "RESOLVED";case IncidentStatus::Closed:return "CLOSED";case IncidentStatus::WaitingForResource:return "WAITING_FOR_RESOURCE";case IncidentStatus::Unreachable:return "UNREACHABLE";case IncidentStatus::Escalated:return "ESCALATED";default:return "CANCELLED";}}
IncidentType incidentTypeFromString(const std::string& v){if(v=="MEDICAL")return IncidentType::Medical;if(v=="FIRE")return IncidentType::Fire;if(v=="POLICE")return IncidentType::Police;if(v=="ACCIDENT")return IncidentType::Accident;if(v=="FLOOD")return IncidentType::Flood;if(v=="STRUCTURAL")return IncidentType::Structural;return IncidentType::Rescue;}
bool responderTypeMatches(IncidentType t,const std::string& r){
    if((t==IncidentType::Medical||t==IncidentType::Accident)&&r=="AMBULANCE")return true;
    if(t==IncidentType::Fire&&r=="FIRE_TRUCK")return true;
    if(t==IncidentType::Police&&r=="POLICE_UNIT")return true;
    if((t==IncidentType::Rescue||t==IncidentType::Flood||t==IncidentType::Structural)&&r=="RESCUE_TEAM")return true;
    return false;
}
} // namespace
