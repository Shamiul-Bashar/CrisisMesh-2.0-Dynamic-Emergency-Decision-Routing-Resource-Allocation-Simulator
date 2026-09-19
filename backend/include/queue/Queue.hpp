#pragma once
#include <cstddef>
#include <stdexcept>
#include <vector>

namespace crisismesh {

// ================================================================
// DSA: Queue (FIFO)
// CrisisMesh role:
// New emergency reports are first inserted into a manual FIFO queue before the
// system evaluates triage, priority, and dispatch order. This preserves the
// chronological intake sequence that the academic workflow expects.
//
// Why it matters:
// The queue provides a predictable report intake pipeline. It ensures that
// incoming incidents are not processed out of arrival order before priority is
// applied.
// Time complexity: enqueue O(1) amortized, dequeue O(1), size O(1)
// Space complexity: O(n)
// ================================================================
template <typename T>
class Queue {
public:
    enum class EventType { ENQUEUE, DEQUEUE, FRONT, EMPTY, SIZE_CHANGED };
    struct Event { EventType type; std::size_t size; };

    explicit Queue(std::size_t capacity = 128) : capacity_(capacity), data_(new T[capacity]) {
        if (capacity == 0) throw std::invalid_argument("Queue capacity must be positive");
    }
    ~Queue() { delete[] data_; }
    Queue(const Queue&) = delete;
    Queue& operator=(const Queue&) = delete;

    void enqueue(const T& value) {
        if (size_ == capacity_) resize();
        data_[tail_] = value;
        tail_ = (tail_ + 1) % capacity_;
        ++size_;
        events_.push_back({EventType::ENQUEUE, size_});
        events_.push_back({EventType::SIZE_CHANGED, size_});
    }
    T dequeue() {
        if (isEmpty()) throw std::underflow_error("Queue is empty");
        T value = data_[head_];
        head_ = (head_ + 1) % capacity_;
        --size_;
        events_.push_back({EventType::DEQUEUE, size_});
        events_.push_back({EventType::SIZE_CHANGED, size_});
        return value;
    }
    const T& front() const {
        if (isEmpty()) throw std::underflow_error("Queue is empty");
        const_cast<Queue*>(this)->events_.push_back({EventType::FRONT, size_});
        return data_[head_];
    }
    bool isEmpty() const { return size_ == 0; }
    std::size_t size() const { return size_; }
    void clear() { head_=tail_=size_=0; events_.clear(); events_.push_back({EventType::EMPTY,0}); }
    const std::vector<Event>& events() const { return events_; }

    // Read-only FIFO snapshot for operational state export. The queue remains the
    // authoritative manual circular-array implementation; this does not mutate it.
    std::vector<T> values() const {
        std::vector<T> out;
        out.reserve(size_);
        for (std::size_t i = 0; i < size_; ++i) out.push_back(data_[(head_ + i) % capacity_]);
        return out;
    }

private:
    void resize() {
        const std::size_t nextCapacity = capacity_ * 2;
        T* next = new T[nextCapacity];
        for (std::size_t i=0;i<size_;++i) next[i] = data_[(head_+i)%capacity_];
        delete[] data_;
        data_ = next;
        capacity_ = nextCapacity;
        head_ = 0;
        tail_ = size_;
    }
    std::size_t capacity_{0}, head_{0}, tail_{0}, size_{0};
    T* data_{nullptr};
    std::vector<Event> events_;
};
} // namespace crisismesh
