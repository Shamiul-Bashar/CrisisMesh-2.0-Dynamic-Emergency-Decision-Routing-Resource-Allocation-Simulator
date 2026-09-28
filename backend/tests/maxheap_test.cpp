#include "heap/MaxHeap.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){MaxHeap h;Incident a,b,c;a.incidentId="INC-A";a.priorityScore=60;a.reportedSequence=1;b.incidentId="INC-B";b.priorityScore=90;b.reportedSequence=2;c.incidentId="INC-C";c.priorityScore=75;c.reportedSequence=3;assert(h.isEmpty());h.insert(a);h.insert(b);h.insert(c);assert(h.peekMax().incidentId=="INC-B");assert(h.extractMax().incidentId=="INC-B");assert(h.extractMax().incidentId=="INC-C");assert(h.extractMax().incidentId=="INC-A");assert(h.isEmpty());h.insert(a);h.clear();assert(h.isEmpty());std::cout<<"MaxHeap test: PASS\n";}
