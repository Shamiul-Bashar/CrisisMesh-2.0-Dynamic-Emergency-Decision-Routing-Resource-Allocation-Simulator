#include "search/LocationDirectory.hpp"

namespace crisismesh {

void LocationDirectory::insert(LocationDirectoryEntry entry) {
    std::size_t position = 0;
    while (position < entries_.size() && entries_[position].id < entry.id) ++position;
    if (position < entries_.size() && entries_[position].id == entry.id) {
        entries_[position] = std::move(entry);
        return;
    }
    entries_.insert(entries_.begin() + static_cast<std::ptrdiff_t>(position), std::move(entry));
}

const LocationDirectoryEntry* LocationDirectory::find(const std::string& id) const {
    std::size_t low = 0;
    std::size_t high = entries_.size();
    while (low < high) {
        const std::size_t middle = low + (high - low) / 2;
        if (entries_[middle].id == id) return &entries_[middle];
        if (entries_[middle].id < id) low = middle + 1;
        else high = middle;
    }
    return nullptr;
}

} // namespace crisismesh
