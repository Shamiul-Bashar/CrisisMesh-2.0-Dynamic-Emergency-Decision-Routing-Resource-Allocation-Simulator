#pragma once

#include "stack/Stack.hpp"
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

namespace crisismesh {

struct LabEvent {
    std::size_t step{0};
    std::string type;
    std::string structure;
    std::string message;
    std::vector<int> values;
    std::string value;
    int scalar{0};
};

struct SortTrace {
    std::string algorithm;
    std::vector<int> input;
    std::vector<int> output;
    std::vector<LabEvent> events;
};

struct TreeNodeView {
    int key;
    int parent;
    std::size_t depth;
};

struct SearchTrace {
    std::string algorithm;
    std::vector<int> input;
    int target{0};
    int foundIndex{-1};
    std::vector<LabEvent> events;
};

// BST: manual binary search tree for ordered incident/archive indexing.
// Why: demonstrates ordered lookup without an STL tree container.
// Time: average insert/search/delete O(log n), worst O(n); inorder O(n).
// Space: O(n) nodes, O(h) recursive call stack.
class BST {
public:
    BST() = default;
    ~BST();
    BST(const BST&) = delete;
    BST& operator=(const BST&) = delete;
    bool insert(int key);
    bool search(int key) const;
    bool remove(int key);
    std::vector<int> inorder() const;
    std::vector<TreeNodeView> structure() const;
    const std::vector<LabEvent>& events() const { return events_; }
    void clear();
private:
    struct Node { int key; Node* left{nullptr}; Node* right{nullptr}; explicit Node(int k):key(k){} };
    Node* root_{nullptr};
    mutable std::vector<LabEvent> events_;
    mutable std::size_t step_{0};
    static void destroy(Node* node);
    static bool searchNode(Node* node, int key);
    static Node* insertNode(Node* node, int key, bool& inserted);
    static Node* removeNode(Node* node, int key, bool& removed);
    static Node* minNode(Node* node);
    static void inorderNode(Node* node, std::vector<int>& out);
    static void structureNode(Node* node, int parent, std::size_t depth, std::vector<TreeNodeView>& out);
    void emit(const std::string& type, const std::string& message, int scalar=0) const;
};

// AVL: manual self-balancing BST for predictable ordered indexing.
// Why: keeps lookup depth bounded for an archive/index demonstration.
// Time: insert/search O(log n); inorder O(n).
// Space: O(n) nodes, O(log n) recursive stack.
class AVL {
public:
    AVL() = default;
    ~AVL();
    AVL(const AVL&) = delete;
    AVL& operator=(const AVL&) = delete;
    bool insert(int key);
    bool search(int key) const;
    bool remove(int key);
    std::vector<int> inorder() const;
    std::vector<TreeNodeView> structure() const;
    const std::vector<LabEvent>& events() const { return events_; }
    void clear();
private:
    struct Node { int key; int height{1}; Node* left{nullptr}; Node* right{nullptr}; explicit Node(int k):key(k){} };
    Node* root_{nullptr};
    mutable std::vector<LabEvent> events_;
    mutable std::size_t step_{0};
    static void destroy(Node* node);
    static int height(Node* node);
    static int balance(Node* node);
    static Node* rotateLeft(Node* x);
    static Node* rotateRight(Node* y);
    Node* insertNode(Node* node, int key, bool& inserted);
    Node* removeNode(Node* node, int key, bool& removed);
    static Node* minNode(Node* node);
    static bool searchNode(Node* node, int key);
    static void inorderNode(Node* node, std::vector<int>& out);
    static void structureNode(Node* node, int parent, std::size_t depth, std::vector<TreeNodeView>& out);
    void emit(const std::string& type, const std::string& message, int scalar=0) const;
};

// Sorting suite: real manual algorithms used for DSA demonstration/ranking traces.
// Bubble/Selection/Insertion: O(n^2) time, O(1) auxiliary space.
// Merge: O(n log n) time, O(n) auxiliary space.
// Quick: average O(n log n), worst O(n^2), O(log n) average recursion stack.
// Heap: O(n log n) time, O(1) auxiliary space.
SortTrace bubbleSortTrace(const std::vector<int>& input);
SortTrace selectionSortTrace(const std::vector<int>& input);
SortTrace insertionSortTrace(const std::vector<int>& input);
SortTrace mergeSortTrace(const std::vector<int>& input);
SortTrace quickSortTrace(const std::vector<int>& input);
SortTrace heapSortTrace(const std::vector<int>& input);
// Searching suite: manual linear and binary search traces.
// Linear: O(n) time, O(1) auxiliary space.
// Binary: O(log n) time on sorted input, O(1) auxiliary space.
SearchTrace linearSearchTrace(const std::vector<int>& input, int target);
SearchTrace binarySearchTrace(const std::vector<int>& sortedInput, int target);

// Sparse Matrix: coordinate/triplet storage of only non-zero city-risk cells.
// Why: represents a mostly-zero risk/relationship matrix compactly.
// Time: lookup/update is O(k) in this educational vector representation; space O(k).
class SparseMatrix {
public:
    struct Entry { std::size_t row; std::size_t col; int value; };
    SparseMatrix(std::size_t rows, std::size_t cols);
    bool set(std::size_t row, std::size_t col, int value);
    int get(std::size_t row, std::size_t col) const;
    std::size_t rows() const { return rows_; }
    std::size_t cols() const { return cols_; }
    std::size_t nonZeroCount() const { return entries_.size(); }
    const std::vector<Entry>& entries() const { return entries_; }
    const std::vector<LabEvent>& events() const { return events_; }
private:
    std::size_t rows_{0}, cols_{0};
    std::vector<Entry> entries_;
    std::vector<LabEvent> events_;
    mutable std::size_t step_{0};
    void emit(const std::string& type, const std::string& message, std::size_t row, std::size_t col, int value);
};

struct ExpressionTrace {
    std::string infix;
    std::string postfix;
    double result{0.0};
    bool valid{false};
    std::vector<LabEvent> events;
};

// Expression Processing: stack-based infix -> postfix -> evaluation.
// Why: demonstrates the assessed Stack in a meaningful expression problem.
// Time: O(n), Space: O(n).
ExpressionTrace processExpression(const std::string& expression);

} // namespace crisismesh
