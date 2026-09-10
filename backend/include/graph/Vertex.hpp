#pragma once

#include "core/Types.hpp"
#include <string>

namespace crisismesh {

struct Vertex {
    std::string id;
    std::string name;
    LocationType type{LocationType::Intersection};
    Coordinate coordinate{};
    std::string status{"OPERATIONAL"};
};

} // namespace crisismesh
