#pragma once
#include "dijkstra/Dijkstra.hpp"
#include "sort/CandidateMergeSort.hpp"
namespace crisismesh {
struct Facility {
    std::string facilityId, category, name, locationId;
};
struct DispatchRecord {
    std::string incidentId, responderId, responderStartLocationId, destinationLocationId;
    DijkstraResult selectedRoute;
    double risk{0}, congestion{0};
    std::size_t graphRevision{0};
    long long dispatchSequence{0};
    std::string selectionReason;
    std::vector<ResponderCandidateSummary> candidateSummaries;
};
} // namespace crisismesh
