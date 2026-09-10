#include "linkedlist/LinkedList.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){LinkedList l;l.insertBack("REPORTED");l.insertBack("TRIAGED");l.insertFront("NEW");l.insertAt(2,"QUEUED");assert(l.size()==4);assert(l.contains("QUEUED"));assert(l.find("TRIAGED"));assert(l.removeAt(1));assert(l.removeBack());assert(l.removeFront());assert(l.size()==1);assert(l.removeFront());assert(l.isEmpty());assert(!l.removeFront());std::cout<<"LinkedList tests: PASSED\n";}
