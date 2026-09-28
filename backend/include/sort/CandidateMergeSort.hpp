#pragma once

#include <string>
#include <vector>

namespace crisismesh {

struct ResponderCandidateSummary {
    std::string responderId;
    bool reachable{false};
    double weightedCost{0.0};
    double travelTime{0.0};
    double distance{0.0};
};

// DSA: Merge Sort
// Operational role: ranks real responder route summaries for authoritative dispatch.
// Why it matters: cost, time, distance, then ID provide a stable explicit tie break.
// Time complexity: O(n log n) in best, average, and worst cases.
// Space complexity: O(n).
void mergeSortCandidates(std::vector<ResponderCandidateSummary>& candidates);

} // namespace crisismesh
