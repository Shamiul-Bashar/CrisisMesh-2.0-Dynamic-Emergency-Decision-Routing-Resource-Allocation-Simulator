#pragma once
#include <string>

namespace crisismesh {

enum class IncidentType { Medical, Fire, Police, Rescue, Accident, Flood, Structural };
enum class IncidentStatus {
    Reported, Queued, Triaged, Prioritized, Assigned, EnRoute,
    RerouteRequired, Resolved, Closed, WaitingForResource, Unreachable,
    Escalated, Cancelled
};

struct Incident {
    std::string incidentId;
    IncidentType type{IncidentType::Rescue};
    std::string locationId;
    int severity{1};       // 1..5
    int urgency{1};        // 1..5
    int victimCount{0};
    int priorityScore{0};
    IncidentStatus status{IncidentStatus::Reported};
    long long reportedSequence{0};
    std::string requiredResponderType;
    std::string assignedResponderId;
    std::string description;
    std::string shelterId;
    std::string allocatedResourceType;
    int allocatedResourceQuantity{0};

    static int calculatePriority(int severity, int urgency, int victimCount, IncidentType type);
    static bool validLocationId(const std::string& id);
    static bool validSeverity(int value);
    static bool validUrgency(int value);
};

const char* toString(IncidentType type);
const char* toString(IncidentStatus status);
IncidentType incidentTypeFromString(const std::string& value);
bool responderTypeMatches(IncidentType incidentType, const std::string& responderType);

} // namespace crisismesh
