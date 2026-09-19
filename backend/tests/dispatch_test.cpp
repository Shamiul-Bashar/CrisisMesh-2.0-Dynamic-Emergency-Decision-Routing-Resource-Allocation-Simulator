#include "simulation/SimulationEngine.hpp"
#include <cassert>
#include <iostream>
using namespace crisismesh;
int main(){SimulationEngine e;auto i=e.reportEmergency(IncidentType::Fire,"LOC-007",5,5,8,"Fire");auto d=e.processNextIncident();assert(d.success);assert(d.incident.incidentId==i.incidentId);assert(!d.responder.responderId.empty());assert(!d.route.pathNodes.empty());assert(d.incident.status==IncidentStatus::EnRoute);std::cout<<"Dispatch selection test: PASS ("<<d.responder.responderId<<")\n";}
