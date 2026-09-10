#pragma once
#include "domain/Incident.hpp"
#include <cstddef>
#include <vector>
#include <stdexcept>

namespace crisismesh {

class MaxHeap {
public:
    enum class EventType { INSERT, COMPARE, SWAP, EXTRACT_MAX, PEEK_MAX, HEAPIFY, CLEAR };
    struct Event {
        EventType type;
        std::size_t index{0};
        std::size_t otherIndex{0};
        int priority{0};
        std::string incidentId;
        std::size_t size{0};
        std::string message;
    };

    bool insert(const Incident& incident);
    Incident extractMax();
    const Incident& peekMax() const;
    bool isEmpty() const { return heap_.empty(); }
    std::size_t size() const { return heap_.size(); }
    void clear();
    const std::vector<Incident>& values() const { return heap_; }
    const std::vector<Event>& events() const { return events_; }

private:
    std::vector<Incident> heap_;
    mutable std::vector<Event> events_;

    static bool higher(const Incident& a, const Incident& b);
    void siftUp(std::size_t index);
    void siftDown(std::size_t index);
};

} // namespace crisismesh
