#pragma once
#include <cstddef>
#include <stdexcept>
#include <string>
#include <vector>

namespace crisismesh {

// ================================================================
// DSA: Hash Table
// CrisisMesh role:
// The custom hash table stores incident records in buckets keyed by incident ID.
// This provides efficient lookup and update operations during live simulation.
//
// Why it matters:
// The C++ engine frequently asks, "what is the state of this incident?" The
// hash table reduces repeated linear scans and keeps lookup operations fast.
// Time complexity: average insert/search/remove O(1), worst O(n)
// Space complexity: O(n)
// ================================================================
struct IncidentRecord { std::string id; std::string type; std::string status; int priority{0}; };

class HashTable {
public:
    struct Event { std::string type; std::size_t bucket{0}; std::size_t size{0}; std::size_t collisionCount{0}; std::string key; std::string message; };
    explicit HashTable(std::size_t bucketCount = 11);
    ~HashTable();
    HashTable(const HashTable&) = delete;
    HashTable& operator=(const HashTable&) = delete;
    bool insert(const IncidentRecord& record);
    const IncidentRecord* search(const std::string& key) const;
    bool remove(const std::string& key);
    void clear();
    bool contains(const std::string& key) const { return search(key) != nullptr; }
    std::size_t size() const { return size_; }
    std::size_t bucketIndex(const std::string& key) const;
    const std::vector<Event>& events() const { return events_; }
    std::vector<std::vector<std::string>> bucketSnapshot() const;
private:
    struct Node { IncidentRecord record; Node* next{nullptr}; explicit Node(IncidentRecord r):record(std::move(r)){} };
    std::vector<Node*> buckets_;
    std::size_t size_{0};
    std::size_t collisions_{0};
    mutable std::vector<Event> events_;
    std::size_t hash(const std::string& key) const;
};
} // namespace crisismesh
