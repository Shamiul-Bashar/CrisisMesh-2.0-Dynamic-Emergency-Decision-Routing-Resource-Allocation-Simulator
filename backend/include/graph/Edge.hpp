#pragma once

#include <string>

namespace crisismesh {

struct Edge {
    std::string id;
    std::string from;
    std::string to;
    double distance{0.0};
    double travelTime{0.0};
    int riskLevel{1};
    int congestionLevel{1};
    int capacity{100};
    bool blocked{false};
};

} // namespace crisismesh
