#include "dijkstra/MinHeap.hpp"
#include <stdexcept>

namespace crisismesh {

bool MinHeap::less(const Item& a, const Item& b) {
    if (a.priority != b.priority) return a.priority < b.priority;
    return a.nodeId < b.nodeId;
}

void MinHeap::push(const Item& item) {
    heap_.push_back(item);
    siftUp(heap_.size() - 1);
}

MinHeap::Item MinHeap::pop() {
    if (heap_.empty()) {
        throw std::out_of_range("Cannot pop an empty MinHeap");
    }
    Item result = heap_.front();
    heap_.front() = heap_.back();
    heap_.pop_back();
    if (!heap_.empty()) siftDown(0);
    return result;
}

void MinHeap::siftUp(std::size_t index) {
    while (index > 0) {
        const std::size_t parent = (index - 1) / 2;
        if (!less(heap_[index], heap_[parent])) break;
        std::swap(heap_[index], heap_[parent]);
        index = parent;
    }
}

void MinHeap::siftDown(std::size_t index) {
    while (true) {
        const std::size_t left = index * 2 + 1;
        const std::size_t right = left + 1;
        std::size_t smallest = index;
        if (left < heap_.size() && less(heap_[left], heap_[smallest])) smallest = left;
        if (right < heap_.size() && less(heap_[right], heap_[smallest])) smallest = right;
        if (smallest == index) break;
        std::swap(heap_[index], heap_[smallest]);
        index = smallest;
    }
}

} // namespace crisismesh
