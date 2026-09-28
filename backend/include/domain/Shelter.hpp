#pragma once
#include <string>

namespace crisismesh {

struct Shelter {
    std::string shelterId;
    std::string locationId;
    int capacity{0};
    int occupancy{0};
    bool operational{true};

    int availableCapacity() const { return capacity - occupancy; }
};

} // namespace crisismesh
