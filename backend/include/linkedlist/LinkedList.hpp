#pragma once
#include <cstddef>
#include <stdexcept>
#include <string>
#include <vector>

namespace crisismesh {

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
