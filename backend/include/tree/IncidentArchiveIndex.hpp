#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace crisismesh {

struct IncidentArchiveEntry {
    long long reportedSequence{0};
    std::string incidentId;
    std::string status;
};

// DSA: AVL Tree
// Operational role: indexes closed incidents by their stable report sequence.
// Why it matters: archival insertion and lookup stay balanced as history grows.
// Time complexity: insert/search O(log n); inorder traversal O(n).
// Space complexity: O(n).
class IncidentArchiveIndex {
public:
    IncidentArchiveIndex() = default;
    ~IncidentArchiveIndex();
    IncidentArchiveIndex(const IncidentArchiveIndex&) = delete;
    IncidentArchiveIndex& operator=(const IncidentArchiveIndex&) = delete;
    bool insert(IncidentArchiveEntry entry);
    const IncidentArchiveEntry* search(long long reportedSequence) const;
    std::vector<IncidentArchiveEntry> inorder() const;
    bool isBalanced() const;
    std::size_t size() const { return size_; }
    void clear();
private:
    struct Node {
        IncidentArchiveEntry entry;
        Node* left{nullptr};
        Node* right{nullptr};
        int height{1};
        explicit Node(IncidentArchiveEntry value) : entry(std::move(value)) {}
    };
    Node* root_{nullptr};
    std::size_t size_{0};
    static int height(Node* node);
    static int balance(Node* node);
    static void updateHeight(Node* node);
    static Node* rotateLeft(Node* node);
    static Node* rotateRight(Node* node);
    static Node* insertNode(Node* node, IncidentArchiveEntry entry, bool& inserted);
    static void collect(Node* node, std::vector<IncidentArchiveEntry>& output);
    static int verify(Node* node);
    static void destroy(Node* node);
};

} // namespace crisismesh
