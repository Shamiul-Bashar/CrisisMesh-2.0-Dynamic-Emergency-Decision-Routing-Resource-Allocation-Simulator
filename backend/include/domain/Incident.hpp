#pragma once
#include <string>

namespace crisismesh {

enum class IncidentType {
    Medical,
    Fire,
    Police,
    Rescue,
    Accident,
    Flood,
    Structural
};

enum class IncidentStatus {
    Reported,
    Queued,
    Triaged,
    Prioritized,
    Assigned,
    EnRoute,
    RerouteRequired,

    // New lifecycle states
    ResponseCompleted,
    AwaitingUserConfirmation,

    Resolved,
    Closed,
    WaitingForResource,
    Unreachable,
    Escalated,
    Cancelled
};

struct Incident {
    std::string incidentId;

    IncidentType type{
        IncidentType::Rescue
    };

    std::string locationId;

    int severity{1};       // 1..5
    int urgency{1};        // 1..5
    int victimCount{0};

    int priorityScore{0};

    IncidentStatus status{
        IncidentStatus::Reported
    };

    long long reportedSequence{0};

    std::string requiredResponderType;
    std::string assignedResponderId;

    std::string description;

    std::string shelterId;

    std::string allocatedResourceType;
    int allocatedResourceQuantity{0};


    /*
     * =====================================================
     * INCIDENT OWNERSHIP / REPORTER INFORMATION
     * =====================================================
     *
     * The user who originally reported this emergency.
     *
     * This is required so that only the reporting user
     * can confirm whether the emergency has actually
     * been resolved.
     *
     * For legacy/demo incidents this may remain empty.
     */
    std::string reportedByUserId;


    /*
     * =====================================================
     * USER RESOLUTION CONFIRMATION
     * =====================================================
     *
     * true  -> user confirmed the emergency was solved
     * false -> no final confirmation yet
     */
    bool userConfirmedResolved{false};


    /*
     * Optional reason supplied when the user says that
     * the problem is NOT solved.
     *
     * Examples:
     * - responder did not arrive
     * - additional ambulance required
     * - situation became worse
     * - fire still active
     */
    std::string escalationReason;


    static int calculatePriority(
        int severity,
        int urgency,
        int victimCount,
        IncidentType type
    );

    static bool validLocationId(
        const std::string& id
    );

    static bool validSeverity(
        int value
    );

    static bool validUrgency(
        int value
    );
};


const char* toString(
    IncidentType type
);

const char* toString(
    IncidentStatus status
);

IncidentType incidentTypeFromString(
    const std::string& value
);

bool responderTypeMatches(
    IncidentType incidentType,
    const std::string& responderType
);

} // namespace crisismesh