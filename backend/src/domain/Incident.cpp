#include "domain/Incident.hpp"

#include <algorithm>
#include <cctype>
#include <stdexcept>

namespace crisismesh {

int Incident::calculatePriority(
    int severity,
    int urgency,
    int victimCount,
    IncidentType type
) {
    const int victimScore =
        std::min(victimCount, 10) * 3;

    int typeScore = 0;

    switch (type) {
        case IncidentType::Fire:
            typeScore = 8;
            break;

        case IncidentType::Medical:
            typeScore = 7;
            break;

        case IncidentType::Police:
            typeScore = 6;
            break;

        case IncidentType::Structural:
            typeScore = 7;
            break;

        case IncidentType::Flood:
            typeScore = 5;
            break;

        case IncidentType::Accident:
            typeScore = 6;
            break;

        case IncidentType::Rescue:
            typeScore = 5;
            break;
    }

    return
        severity * 12 +
        urgency * 10 +
        victimScore +
        typeScore;
}


bool Incident::validLocationId(
    const std::string& id
) {
    if (
        id.size() != 7 ||
        id.rfind("LOC-", 0) != 0
    ) {
        return false;
    }

    for (
        std::size_t i = 4;
        i < 7;
        ++i
    ) {
        if (
            !std::isdigit(
                static_cast<unsigned char>(
                    id[i]
                )
            )
        ) {
            return false;
        }
    }

    const int n =
        std::stoi(
            id.substr(4)
        );

    return
        n >= 1 &&
        n <= 24;
}


bool Incident::validSeverity(
    int value
) {
    return
        value >= 1 &&
        value <= 5;
}


bool Incident::validUrgency(
    int value
) {
    return
        value >= 1 &&
        value <= 5;
}


/* =========================================================
   INCIDENT TYPE → STRING
   ========================================================= */

const char* toString(
    IncidentType type
) {
    switch (type) {
        case IncidentType::Medical:
            return "MEDICAL";

        case IncidentType::Fire:
            return "FIRE";

        case IncidentType::Police:
            return "POLICE";

        case IncidentType::Rescue:
            return "RESCUE";

        case IncidentType::Accident:
            return "ACCIDENT";

        case IncidentType::Flood:
            return "FLOOD";

        case IncidentType::Structural:
            return "STRUCTURAL";
    }

    return "RESCUE";
}


/* =========================================================
   INCIDENT STATUS → STRING
   ========================================================= */

const char* toString(
    IncidentStatus status
) {
    switch (status) {
        case IncidentStatus::Reported:
            return "REPORTED";

        case IncidentStatus::Queued:
            return "QUEUED";

        case IncidentStatus::Triaged:
            return "TRIAGED";

        case IncidentStatus::Prioritized:
            return "PRIORITIZED";

        case IncidentStatus::Assigned:
            return "ASSIGNED";

        case IncidentStatus::EnRoute:
            return "EN_ROUTE";

        case IncidentStatus::RerouteRequired:
            return "REROUTE_REQUIRED";


        /*
         * New lifecycle state:
         *
         * Responder/author has completed the operation,
         * but user confirmation has not yet happened.
         */
        case IncidentStatus::ResponseCompleted:
            return "RESPONSE_COMPLETED";


        /*
         * User must now confirm whether the emergency
         * has actually been solved.
         */
        case IncidentStatus::AwaitingUserConfirmation:
            return "AWAITING_USER_CONFIRMATION";


        case IncidentStatus::Resolved:
            return "RESOLVED";

        case IncidentStatus::Closed:
            return "CLOSED";

        case IncidentStatus::WaitingForResource:
            return "WAITING_FOR_RESOURCE";

        case IncidentStatus::Unreachable:
            return "UNREACHABLE";

        case IncidentStatus::Escalated:
            return "ESCALATED";

        case IncidentStatus::Cancelled:
            return "CANCELLED";
    }

    return "CANCELLED";
}


/* =========================================================
   STRING → INCIDENT TYPE
   ========================================================= */

IncidentType incidentTypeFromString(
    const std::string& value
) {
    if (value == "MEDICAL") {
        return IncidentType::Medical;
    }

    if (value == "FIRE") {
        return IncidentType::Fire;
    }

    if (value == "POLICE") {
        return IncidentType::Police;
    }

    if (value == "ACCIDENT") {
        return IncidentType::Accident;
    }

    if (value == "FLOOD") {
        return IncidentType::Flood;
    }

    if (value == "STRUCTURAL") {
        return IncidentType::Structural;
    }

    return IncidentType::Rescue;
}


/* =========================================================
   INCIDENT TYPE ↔ RESPONDER TYPE MATCHING
   ========================================================= */

bool responderTypeMatches(
    IncidentType incidentType,
    const std::string& responderType
) {
    if (
        (
            incidentType ==
                IncidentType::Medical ||
            incidentType ==
                IncidentType::Accident
        ) &&
        responderType == "AMBULANCE"
    ) {
        return true;
    }


    if (
        incidentType ==
            IncidentType::Fire &&
        responderType ==
            "FIRE_TRUCK"
    ) {
        return true;
    }


    if (
        incidentType ==
            IncidentType::Police &&
        responderType ==
            "POLICE_UNIT"
    ) {
        return true;
    }


    if (
        (
            incidentType ==
                IncidentType::Rescue ||
            incidentType ==
                IncidentType::Flood ||
            incidentType ==
                IncidentType::Structural
        ) &&
        responderType ==
            "RESCUE_TEAM"
    ) {
        return true;
    }


    return false;
}

} // namespace crisismesh