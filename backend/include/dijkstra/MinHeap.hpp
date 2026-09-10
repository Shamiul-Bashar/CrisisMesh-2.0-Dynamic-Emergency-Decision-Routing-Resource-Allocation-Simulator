#pragma once

#include <cstddef>
#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace crisismesh {

/** Minimal binary heap for Dijkstra's frontier. No std::priority_queue is used. */
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
