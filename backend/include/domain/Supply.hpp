#pragma once
#include <string>

namespace crisismesh {

struct SupplyResource {
    std::string resourceType;
    int quantity{0};
    std::string source;
};

struct ResourceAllocation {
    std::string resourceType;
    int quantity{0};
    std::string source;
    std::string destination;
    std::string status;
};

} // namespace crisismesh
