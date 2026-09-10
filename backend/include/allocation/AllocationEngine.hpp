#pragma once
#include "dijkstra/Dijkstra.hpp"
#include "domain/Incident.hpp"
#include "domain/Shelter.hpp"
#include "domain/Supply.hpp"
#include "graph/Graph.hpp"
#include <string>
#include <vector>

namespace crisismesh {

struct ShelterDecision {
    bool allocated{false};
    Shelter shelter{};
    DijkstraResult route{};
    std::string message;
};

class AllocationEngine {
public:
    AllocationEngine();
    void reset();

    ShelterDecision selectShelter(const Graph& graph, const Incident& incident,
                                  const Dijkstra& dijkstra);
    std::vector<ResourceAllocation> allocateResources(const Incident& incident);

    const std::vector<Shelter>& shelters() const { return shelters_; }
    const std::vector<SupplyResource>& resources() const { return resources_; }
    const std::vector<ResourceAllocation>& allocations() const { return allocations_; }

private:
    std::vector<Shelter> shelters_;
    std::vector<SupplyResource> resources_;
    std::vector<ResourceAllocation> allocations_;
};

} // namespace crisismesh
