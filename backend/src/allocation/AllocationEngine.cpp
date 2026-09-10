#include "allocation/AllocationEngine.hpp"
#include <limits>

namespace crisismesh {

AllocationEngine::AllocationEngine() { reset(); }

void AllocationEngine::reset() {
    shelters_ = {
        {"SHELTER-01", "LOC-012", 180, 24, true},
        {"SHELTER-02", "LOC-013", 140, 18, true}
    };
    resources_ = {
        {"MEDICAL_KIT", 40, "Central Supply Depot"},
        {"WATER", 240, "Municipal Water Reserve"},
        {"FOOD", 180, "Municipal Food Reserve"},
        {"RESCUE_EQUIPMENT", 12, "Emergency Logistics Depot"}
    };
    allocations_.clear();
}

ShelterDecision AllocationEngine::selectShelter(const Graph& graph, const Incident& incident,
                                                 const Dijkstra& dijkstra) {
    ShelterDecision best;
    if (incident.victimCount <= 0) {
        best.message = "Shelter placement not required for zero reported victims";
        return best;
    }

    double bestCost = std::numeric_limits<double>::infinity();
    for (auto& shelter : shelters_) {
        if (!shelter.operational || shelter.availableCapacity() < incident.victimCount) continue;
        const auto route = dijkstra.run(graph, incident.locationId, shelter.locationId);
        if (!route.reachable || route.totalCost >= bestCost) continue;
        bestCost = route.totalCost;
        best.allocated = true;
        best.shelter = shelter;
        best.route = route;
    }

    if (!best.allocated) {
        best.message = "No operational shelter has sufficient capacity and reachability";
        return best;
    }

    for (auto& shelter : shelters_) {
        if (shelter.shelterId == best.shelter.shelterId) {
            shelter.occupancy += incident.victimCount;
            best.shelter = shelter;
            break;
        }
    }
    best.message = "Shelter selected by C++ allocation engine using capacity and Dijkstra route cost";
    return best;
}

std::vector<ResourceAllocation> AllocationEngine::allocateResources(const Incident& incident) {
    std::vector<ResourceAllocation> result;
    const int requested = incident.victimCount > 0 ? incident.victimCount : 1;
    std::string resourceType;
    int units = 0;
    if (incident.type == IncidentType::Medical || incident.type == IncidentType::Accident) {
        resourceType = "MEDICAL_KIT"; units = (requested + 1) / 2;
    } else if (incident.type == IncidentType::Flood) {
        resourceType = "WATER"; units = requested * 2;
    } else if (incident.type == IncidentType::Rescue || incident.type == IncidentType::Structural) {
        resourceType = "RESCUE_EQUIPMENT"; units = 1;
    } else {
        return result;
    }

    for (auto& resource : resources_) {
        if (resource.resourceType != resourceType || resource.quantity < units) continue;
        resource.quantity -= units;
        ResourceAllocation allocation{resourceType, units, resource.source, incident.incidentId, "ALLOCATED"};
        allocations_.push_back(allocation);
        result.push_back(allocation);
        return result;
    }
    return result;
}

} // namespace crisismesh
