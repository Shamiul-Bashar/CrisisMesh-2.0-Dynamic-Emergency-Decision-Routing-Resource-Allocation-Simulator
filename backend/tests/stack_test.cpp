#include "stack/Stack.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){ Stack<int> s;assert(s.isEmpty());s.push(1);s.push(2);assert(s.top()==2);assert(s.pop()==2);assert(s.pop()==1);assert(s.isEmpty());bool threw=false;try{s.pop();}catch(...){threw=true;}assert(threw);std::cout<<"Stack tests: PASSED\n"; }
