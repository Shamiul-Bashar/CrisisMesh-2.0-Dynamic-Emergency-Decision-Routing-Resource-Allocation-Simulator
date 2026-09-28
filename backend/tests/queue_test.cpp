#include "queue/Queue.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){ Queue<int> q; assert(q.isEmpty()); q.enqueue(1);q.enqueue(2);assert(q.front()==1);assert(q.dequeue()==1);assert(q.dequeue()==2);assert(q.isEmpty());bool threw=false;try{q.dequeue();}catch(...){threw=true;}assert(threw);std::cout<<"Queue tests: PASSED\n"; }
