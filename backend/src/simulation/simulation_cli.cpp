#include "simulation/SimulationEngine.hpp"
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace crisismesh;

namespace {
std::vector<std::string> split(const std::string&s,char d){
    std::vector<std::string> out;std::string cur;bool esc=false;
    for(char c:s){if(esc){cur.push_back(c);esc=false;}else if(c=='\\')esc=true;else if(c==d){out.push_back(cur);cur.clear();}else cur.push_back(c);}out.push_back(cur);return out;
}
std::string reportResponse(SimulationEngine&engine,const std::vector<std::string>&p){
    if(p.size()<7) throw std::invalid_argument("REPORT requires type|location|severity|urgency|victims|description");
    auto i=engine.reportEmergency(incidentTypeFromString(p[1]),p[2],std::stoi(p[3]),std::stoi(p[4]),std::stoi(p[5]),p[6]);
    auto d=engine.processNextIncident();
    return SimulationEngine::eventsToJson(engine.events(),&d);
}
void server(){
    SimulationEngine engine;
    std::string line;
    while(std::getline(std::cin,line)){
        try{
            auto p=split(line,'|'); if(p.empty())continue;
            if(p[0]=="REPORT") {
                if(p.size()<7) throw std::invalid_argument("REPORT requires type|location|severity|urgency|victims|description");
                auto i=engine.reportEmergency(incidentTypeFromString(p[1]),p[2],std::stoi(p[3]),std::stoi(p[4]),std::stoi(p[5]),p[6]);
                std::cout << "{\"ok\":true,\"message\":\"Incident queued for coordinator processing\",\"incident\":"
                          << SimulationEngine::incidentToJson(i) << ",\"events\":" << SimulationEngine::eventsToJson(engine.events())
                          << ",\"state\":" << engine.stateToJson() << "}\n";
            } else if(p[0]=="PROCESS_NEXT") {
                auto d=engine.processNextIncident();
                auto payload=SimulationEngine::eventsToJson(engine.events(),&d);
                if(!payload.empty() && payload.back()=='}') payload.pop_back();
                std::cout << payload << ",\"state\":" << engine.stateToJson() << "}\n";
            } else if(p[0]=="BLOCK") {
                if(p.size()<2)throw std::invalid_argument("BLOCK requires edge id");
                bool ok=engine.blockRoad(p[1]);
                std::cout<<"{\"ok\":"<<(ok?"true":"false")<<",\"events\":"+SimulationEngine::eventsToJson(engine.events())<<",\"state\":"+engine.stateToJson()+"}\n";
            } else if(p[0]=="UNDO_BLOCK") {
                bool ok=engine.undoLastRoadBlock();
                std::cout<<"{\"ok\":"<<(ok?"true":"false")<<",\"state\":"+engine.stateToJson()+"}\n";
            } else if(p[0]=="UNBLOCK") {
                if(p.size()<2)throw std::invalid_argument("UNBLOCK requires edge id");
                bool ok=engine.unblockRoad(p[1]);
                std::cout<<"{\"ok\":"<<(ok?"true":"false")<<",\"events\":"+SimulationEngine::eventsToJson(engine.events())<<",\"state\":"+engine.stateToJson()+"}\n";
            } else if(p[0]=="SET_RESPONDER") {
                if(p.size()<3) throw std::invalid_argument("SET_RESPONDER requires responder id|availability");
                ResponderAvailability a=ResponderAvailability::Offline;
                if(p[2]=="AVAILABLE") a=ResponderAvailability::Available;
                else if(p[2]=="ASSIGNED") a=ResponderAvailability::Assigned;
                else if(p[2]=="BUSY") a=ResponderAvailability::Busy;
                else if(p[2]!="OFFLINE") throw std::invalid_argument("Unknown responder availability");
                bool ok=engine.setResponderAvailability(p[1],a);
                std::cout<<"{\"ok\":"<<(ok?"true":"false")<<",\"state\":"<<engine.stateToJson()<<"}\n";
            } else if(p[0]=="RESOLVE") {
                if(p.size()<2)throw std::invalid_argument("RESOLVE requires incident id");
                bool ok=engine.resolveIncident(p[1]);
                std::cout<<"{\"ok\":"<<(ok?"true":"false")<<",\"events\":"+SimulationEngine::eventsToJson(engine.events())<<",\"state\":"+engine.stateToJson()+"}\n";
            } else if(p[0]=="RESET") {
                engine.reset();
                std::cout<<"{\"ok\":true,\"message\":\"Simulation reset\",\"state\":"+engine.stateToJson()+"}\n";
            } else if(p[0]=="STATE") {
                std::cout<<engine.stateToJson()<<"\n";
            } else throw std::invalid_argument("Unknown command");
        }catch(const std::exception&e){
            std::cout<<"{\"ok\":false,\"error\":\""<<e.what()<<"\"}\n";
        }
        std::cout.flush();
    }
}
}
int main(int argc,char**argv){
    try{
        if(argc>1 && std::string(argv[1])=="--server"){server();return 0;}
        SimulationEngine engine;
        auto i=engine.reportEmergency(IncidentType::Fire,"LOC-007",5,5,8,"Demo fire emergency");
        auto d=engine.processNextIncident();
        std::cout<<SimulationEngine::eventsToJson(engine.events(),&d)<<"\n";
        return d.success?0:1;
    }catch(const std::exception&e){std::cerr<<"SIMULATION ERROR: "<<e.what()<<"\n";return 1;}
}
