#include "tree/IncidentArchiveIndex.hpp"

#include <algorithm>
#include <cstdlib>

namespace crisismesh {

IncidentArchiveIndex::~IncidentArchiveIndex() { clear(); }
int IncidentArchiveIndex::height(Node* node) { return node ? node->height : 0; }
int IncidentArchiveIndex::balance(Node* node) { return node ? height(node->left) - height(node->right) : 0; }
void IncidentArchiveIndex::updateHeight(Node* node) { node->height = 1 + std::max(height(node->left), height(node->right)); }
IncidentArchiveIndex::Node* IncidentArchiveIndex::rotateRight(Node* node) {
    Node* pivot = node->left;
    node->left = pivot->right;
    pivot->right = node;
    updateHeight(node); updateHeight(pivot);
    return pivot;
}
IncidentArchiveIndex::Node* IncidentArchiveIndex::rotateLeft(Node* node) {
    Node* pivot = node->right;
    node->right = pivot->left;
    pivot->left = node;
    updateHeight(node); updateHeight(pivot);
    return pivot;
}
IncidentArchiveIndex::Node* IncidentArchiveIndex::insertNode(Node* node, IncidentArchiveEntry entry, bool& inserted) {
    if (!node) { inserted = true; return new Node(std::move(entry)); }
    if (entry.reportedSequence < node->entry.reportedSequence)
        node->left = insertNode(node->left, std::move(entry), inserted);
    else if (entry.reportedSequence > node->entry.reportedSequence)
        node->right = insertNode(node->right, std::move(entry), inserted);
    else return node;
    updateHeight(node);
    const int factor = balance(node);
    if (factor > 1) {
        if (balance(node->left) < 0) node->left = rotateLeft(node->left);
        return rotateRight(node);
    }
    if (factor < -1) {
        if (balance(node->right) > 0) node->right = rotateRight(node->right);
        return rotateLeft(node);
    }
    return node;
}
bool IncidentArchiveIndex::insert(IncidentArchiveEntry entry) {
    bool inserted = false;
    root_ = insertNode(root_, std::move(entry), inserted);
    if (inserted) ++size_;
    return inserted;
}
const IncidentArchiveEntry* IncidentArchiveIndex::search(long long key) const {
    Node* current = root_;
    while (current) {
        if (key == current->entry.reportedSequence) return &current->entry;
        current = key < current->entry.reportedSequence ? current->left : current->right;
    }
    return nullptr;
}
void IncidentArchiveIndex::collect(Node* node, std::vector<IncidentArchiveEntry>& output) {
    if (!node) return;
    collect(node->left, output); output.push_back(node->entry); collect(node->right, output);
}
std::vector<IncidentArchiveEntry> IncidentArchiveIndex::inorder() const {
    std::vector<IncidentArchiveEntry> output;
    output.reserve(size_);
    collect(root_, output);
    return output;
}
int IncidentArchiveIndex::verify(Node* node) {
    if (!node) return 0;
    const int left = verify(node->left), right = verify(node->right);
    if (left < 0 || right < 0 || std::abs(left - right) > 1 || node->height != 1 + std::max(left, right)) return -1;
    return 1 + std::max(left, right);
}
bool IncidentArchiveIndex::isBalanced() const { return verify(root_) >= 0; }
void IncidentArchiveIndex::destroy(Node* node) { if (node) { destroy(node->left); destroy(node->right); delete node; } }
void IncidentArchiveIndex::clear() { destroy(root_); root_ = nullptr; size_ = 0; }

} // namespace crisismesh
