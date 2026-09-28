#include "dfs/DFS.hpp"
#include "graph/CityData.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){Graph g=createCrisisMeshCity();DFS dfs;auto r=dfs.run(g,"LOC-003","LOC-007");assert(r.reachable);assert(r.visitOrder.front()=="LOC-003");assert(r.pathNodes.front()=="LOC-003"&&r.pathNodes.back()=="LOC-007");assert(!r.events.empty());auto same=dfs.run(g,"LOC-003","LOC-003");assert(same.sourceEqualsDestination);for(const auto&e:g.getIncidentEdges("LOC-007"))g.blockEdge(e.id);auto u=dfs.run(g,"LOC-003","LOC-007");assert(!u.reachable);std::cout<<"DFS tests: PASSED\n";}
