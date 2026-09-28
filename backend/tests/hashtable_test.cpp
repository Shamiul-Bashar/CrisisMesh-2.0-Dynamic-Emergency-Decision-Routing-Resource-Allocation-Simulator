#include "hashtable/HashTable.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){HashTable h(5);assert(h.insert({"INC-104","FIRE","REPORTED",94}));assert(h.insert({"INC-118","MEDICAL","QUEUED",88}));assert(h.insert({"INC-121","POLICE","ASSIGNED",72}));assert(h.size()==3);assert(h.contains("INC-118"));assert(h.search("INC-999")==nullptr);assert(h.remove("INC-118"));assert(!h.contains("INC-118"));assert(!h.remove("INC-999"));std::cout<<"HashTable tests: PASSED\n";}
