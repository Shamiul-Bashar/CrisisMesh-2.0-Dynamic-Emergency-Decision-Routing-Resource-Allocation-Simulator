#pragma once
#include <string>
namespace crisismesh {
enum class ResponderAvailability { Available, Assigned, Busy, Offline };
struct Responder {
    std::string responderId;
    std::string type; // AMBULANCE, FIRE_TRUCK, POLICE_UNIT, RESCUE_TEAM
    std::string currentLocation;
    ResponderAvailability availability{ResponderAvailability::Available};
    int capacity{1};
    bool capabilityVerified{true};
    std::string baseFacilityId{};
    std::string assignedIncidentId{};
};
const char* toString(ResponderAvailability value);
} // namespace crisismesh
