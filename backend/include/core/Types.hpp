#pragma once

#include <string>
#include <vector>

namespace crisismesh {

enum class LocationType {
    Hospital, Fire, Police, School, Market, Shelter,
    Residential, Intersection, Civic, Transport, Industrial
};

enum class RiskLevel { Low = 1, Medium = 2, High = 3 };

struct Coordinate {
    double x{0.0};
    double y{0.0};
};

} // namespace crisismesh
