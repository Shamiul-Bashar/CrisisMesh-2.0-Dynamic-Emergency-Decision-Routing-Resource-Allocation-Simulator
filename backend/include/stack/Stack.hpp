#pragma once
#include <cstddef>
#include <stdexcept>
#include <vector>

namespace crisismesh {

// ================================================================
// DSA: Stack (LIFO)
// CrisisMesh role:
// The stack implements the last-in, first-out behavior used to undo the most
// recent road-block operation. This gives the simulator an explicit rollback
// action for dynamic network changes.
//
// Why it matters:
// Operational changes such as road blocks are stateful; a stack lets the
// engine reverse the most recent action without losing the prior topology state.
// Time complexity: push O(1) amortized, pop O(1), top O(1)
// Space complexity: O(n)
// ================================================================
template <typename T>
class Stack {
public:
    enum class EventType { PUSH, POP, TOP, EMPTY, SIZE_CHANGED };
    struct Event { EventType type; std::size_t size; };

    Stack() = default;
    ~Stack() { delete[] data_; }
    Stack(const Stack&) = delete;
    Stack& operator=(const Stack&) = delete;

    void push(const T& value) {
        if (size_ == capacity_) resize();
        data_[size_++] = value;
        events_.push_back({EventType::PUSH, size_});
        events_.push_back({EventType::SIZE_CHANGED, size_});
    }
    T pop() {
        if (isEmpty()) throw std::underflow_error("Stack is empty");
        T value = data_[--size_];
        events_.push_back({EventType::POP, size_});
        events_.push_back({EventType::SIZE_CHANGED, size_});
        return value;
    }
    const T& top() const {
        if (isEmpty()) throw std::underflow_error("Stack is empty");
        const_cast<Stack*>(this)->events_.push_back({EventType::TOP, size_});
        return data_[size_-1];
    }
    bool isEmpty() const { return size_ == 0; }
    std::size_t size() const { return size_; }
    void clear() { size_=0; events_.clear(); events_.push_back({EventType::EMPTY,0}); }
    const std::vector<Event>& events() const { return events_; }

private:
    void resize() {
        const std::size_t nextCapacity = capacity_ == 0 ? 8 : capacity_ * 2;
        T* next = new T[nextCapacity];
        for (std::size_t i=0;i<size_;++i) next[i]=data_[i];
        delete[] data_; data_=next; capacity_=nextCapacity;
    }
    std::size_t capacity_{0}, size_{0};
    T* data_{nullptr};
    mutable std::vector<Event> events_;
};
} // namespace crisismesh
