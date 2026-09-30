#pragma once

#include "core/Types.hpp"

#include <string>
#include <vector>

namespace crisismesh {

struct LocationDirectoryEntry { std::string id; std::string name; LocationType type{LocationType::Intersection}; };

// DSA: Binary Search
// Operational role: validates incident locations against a sorted city directory.
// Why it matters: every emergency report performs this lookup before entering intake.
// Time complexity: search O(log n); ordered build insertion O(n).
// Space complexity: O(n).
class LocationDirectory {
public:
    void insert(LocationDirectoryEntry entry);
    const LocationDirectoryEntry* find(const std::string& id) const;
    void clear() { entries_.clear(); }
    const std::vector<LocationDirectoryEntry>& entries() const { return entries_; }
private:
    std::vector<LocationDirectoryEntry> entries_;
};

} // namespace crisismesh
