#include "sort/CandidateMergeSort.hpp"

namespace crisismesh {
namespace {
bool before(const ResponderCandidateSummary& a, const ResponderCandidateSummary& b) {
    if (a.reachable != b.reachable) return a.reachable;
    if (a.weightedCost != b.weightedCost) return a.weightedCost < b.weightedCost;
    if (a.travelTime != b.travelTime) return a.travelTime < b.travelTime;
    if (a.distance != b.distance) return a.distance < b.distance;
    return a.responderId < b.responderId;
}
void sortRange(std::vector<ResponderCandidateSummary>& values,
               std::vector<ResponderCandidateSummary>& buffer,
               std::size_t begin, std::size_t end) {
    if (end - begin < 2) return;
    const std::size_t middle = begin + (end - begin) / 2;
    sortRange(values, buffer, begin, middle);
    sortRange(values, buffer, middle, end);
    std::size_t left = begin, right = middle, output = begin;
    while (left < middle && right < end)
        buffer[output++] = before(values[right], values[left]) ? values[right++] : values[left++];
    while (left < middle) buffer[output++] = values[left++];
    while (right < end) buffer[output++] = values[right++];
    for (std::size_t i = begin; i < end; ++i) values[i] = buffer[i];
}
}

void mergeSortCandidates(std::vector<ResponderCandidateSummary>& candidates) {
    std::vector<ResponderCandidateSummary> buffer(candidates.size());
    sortRange(candidates, buffer, 0, candidates.size());
}

} // namespace crisismesh
