#include "domain/Incident.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){assert(Incident::validSeverity(5)&&!Incident::validSeverity(0));assert(Incident::validUrgency(4));assert(Incident::validLocationId("LOC-024"));assert(!Incident::validLocationId("LOC-999"));int fire=Incident::calculatePriority(5,5,8,IncidentType::Fire);int low=Incident::calculatePriority(1,1,0,IncidentType::Flood);assert(fire>low);assert(responderTypeMatches(IncidentType::Medical,"AMBULANCE"));assert(!responderTypeMatches(IncidentType::Fire,"POLICE_UNIT"));std::cout<<"Incident model test: PASS\n";}
