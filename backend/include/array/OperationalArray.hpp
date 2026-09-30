#pragma once

#include <cstddef>
#include <stdexcept>

namespace crisismesh {

// DSA: Array
// Operational role: bounded contiguous storage for responder candidates during dispatch.
// Why it matters: dispatch evaluates a known maximum without hidden container growth.
// Time complexity: indexed access and append O(1).
// Space complexity: O(Capacity).
template <typename T, std::size_t Capacity>
class OperationalArray {
public:
    bool pushBack(const T& value) {
        if (size_ == Capacity) return false;
        data_[size_++] = value;
        return true;
    }

    T& operator[](std::size_t index) { return data_[index]; }
    const T& operator[](std::size_t index) const { return data_[index]; }
    T& at(std::size_t index) {
        if (index >= size_) throw std::out_of_range("OperationalArray index out of range");
        return data_[index];
    }
    const T& at(std::size_t index) const {
        if (index >= size_) throw std::out_of_range("OperationalArray index out of range");
        return data_[index];
    }
    std::size_t size() const { return size_; }
    constexpr std::size_t capacity() const { return Capacity; }
    bool empty() const { return size_ == 0; }
    void clear() { size_ = 0; }

private:
    T data_[Capacity == 0 ? 1 : Capacity]{};
    std::size_t size_{0};
};

} // namespace crisismesh
