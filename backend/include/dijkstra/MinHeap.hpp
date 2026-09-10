#pragma once

#include <cstddef>
#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace crisismesh {

// ================================================================
// DSA: Min Heap
// CrisisMesh role:
// This heap maintains the current Dijkstra frontier. The lowest-cost node is
// extracted first so the routing engine can expand the shortest valid path.
//
// Why it matters:
// Dijkstra is only efficient when frontier selection is prioritized correctly.
// The manual heap preserves the deterministic route-cost ordering used by the
// authoritative simulation engine.
// Time complexity: push O(log n), pop O(log n), peek O(1)
// Space complexity: O(n)
// ================================================================
class MinHeap {
public:
    struct Item {
        std::string nodeId;
        double priority{};
    };

    bool empty() const { return heap_.empty(); }
    std::size_t size() const { return heap_.size(); }

    void push(const Item& item);
    Item pop();

private:
    std::vector<Item> heap_;

    static bool less(const Item& a, const Item& b);
    void siftUp(std::size_t index);
    void siftDown(std::size_t index);
};

} // namespace crisismesh
