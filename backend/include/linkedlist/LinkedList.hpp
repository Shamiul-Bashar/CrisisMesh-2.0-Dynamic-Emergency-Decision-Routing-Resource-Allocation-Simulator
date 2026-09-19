#pragma once
#include <cstddef>
#include <stdexcept>
#include <string>
#include <vector>

namespace crisismesh {

// ================================================================
// DSA: Linked List
// CrisisMesh role:
// Resolved incident history is stored in a manual linked-list sequence. Each
// record is appended and traversed in order to preserve a deterministic event
// log.
//
// Why it matters:
// The simulator needs a chronological record of closed or resolved incidents.
// The linked list gives the engine a low-overhead way to append history without
// a large dynamic array reallocation burden.
// Time complexity: insert O(1) at front/back, O(n) in the middle, traverse O(n)
// Space complexity: O(n)
// ================================================================
class LinkedList {
public:
    struct Event { std::string type; std::size_t index{0}; std::size_t size{0}; std::string value; };
    struct Node { std::string value; Node* next{nullptr}; explicit Node(std::string v):value(std::move(v)){} };
    explicit LinkedList(bool rejectDuplicates = false) : rejectDuplicates_(rejectDuplicates) {}
    ~LinkedList();
    LinkedList(const LinkedList&) = delete;
    LinkedList& operator=(const LinkedList&) = delete;
    void insertFront(const std::string& value);
    void insertBack(const std::string& value);
    void insertAt(std::size_t index, const std::string& value);
    bool removeFront();
    bool removeBack();
    bool removeAt(std::size_t index);
    void clear();
    Node* find(const std::string& value);
    bool contains(const std::string& value) const;
    std::size_t size() const { return size_; }
    bool isEmpty() const { return size_ == 0; }
    std::vector<std::string> values() const;
    const std::vector<Event>& events() const { return events_; }
private:
    Node* head_{nullptr};
    Node* tail_{nullptr};
    std::size_t size_{0};
    bool rejectDuplicates_{false};
    std::vector<Event> events_;
    void validateNewValue(const std::string& value) const;
};
} // namespace crisismesh
