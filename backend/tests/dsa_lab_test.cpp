#include "dsa/DSALab.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){
    BST bst; assert(bst.insert(50)); assert(bst.insert(30)); assert(bst.insert(70)); assert(bst.search(30)); assert(!bst.search(99)); assert(bst.remove(30)); assert(!bst.search(30)); auto bs=bst.structure(); assert(!bs.empty() && bs.front().parent==-1 && bs.front().depth==0);
    AVL avl; avl.insert(30); avl.insert(20); avl.insert(10); avl.insert(25); avl.insert(28); assert(avl.search(28)); assert(avl.remove(25)); auto ai=avl.inorder(); assert((ai==std::vector<int>{10,20,28,30})); auto as=avl.structure(); assert(!as.empty() && as.front().parent==-1 && as.front().depth==0);
    const std::vector<int> input{7,2,9,1,5,3}; for(auto t:{bubbleSortTrace(input),selectionSortTrace(input),insertionSortTrace(input),mergeSortTrace(input),quickSortTrace(input),heapSortTrace(input)}) assert((t.output==std::vector<int>{1,2,3,5,7,9})&&!t.events.empty());
    auto l=linearSearchTrace(input,5); assert(l.foundIndex==4); auto b=binarySearchTrace({1,2,3,5,7,9},7); assert(b.foundIndex==4);
    SparseMatrix m(4,4); m.set(0,1,5);m.set(2,3,9); assert(m.get(0,1)==5&&m.nonZeroCount()==2);m.set(0,1,0);assert(m.get(0,1)==0&&m.nonZeroCount()==1);
    auto e=processExpression("(2+3)*4-6/2"); assert(e.valid&&e.result==17.0&&!e.postfix.empty());
    std::cout<<"DSA Lab tests: PASS\n"; return 0;
}
