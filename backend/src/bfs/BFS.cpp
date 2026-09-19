#include "bfs/BFS.hpp"
#include "queue/Queue.hpp"
#include <algorithm>
#include <stdexcept>
#include <vector>
namespace crisismesh {
namespace { bool has(const std::vector<std::string>& v,const std::string& x){return std::find(v.begin(),v.end(),x)!=v.end();} }
TraversalResult BFS::run(const Graph& graph,const std::string& source,const std::string& destination) const {
    if(!graph.vertexExists(source)||!graph.vertexExists(destination)) throw std::invalid_argument("BFS source or destination does not exist");
    TraversalResult r; std::size_t step=0; auto add=[&](const std::string&t,const std::string&node="",const std::string&edge="",const std::string&parent="",std::size_t q=0,std::size_t v=0,const std::string&m=""){r.events.push_back({t,"BFS",++step,node,edge,parent,q,0,v,0,0,0,"","",m,0,0.0,0.0,"","",{},{} });};
    add("BFS_START","","","",0,0,"BFS execution started"); add("BFS_SOURCE_SELECTED",source,"","",0,0,"Source selected");
    if(source==destination){r.reachable=r.sourceEqualsDestination=true;r.visitOrder={source};r.pathNodes={source};add("BFS_DESTINATION_REACHED",source,"","",0,1,"Source equals destination");add("BFS_COMPLETE",source,"","",0,1,"BFS complete");return r;}
    Queue<std::string> q; std::vector<std::string> discovered{source}; std::vector<std::string> visited; std::vector<std::string> parent(0);
    struct Parent{std::string node;std::string p;}; std::vector<Parent> parents;
    q.enqueue(source); add("BFS_ENQUEUE",source,"","",q.size(),0,"Source enqueued");
    while(!q.isEmpty()){
        const auto cur=q.dequeue(); add("BFS_DEQUEUE",cur,"","",q.size(),visited.size(),"Node dequeued");
        if(!has(visited,cur)){visited.push_back(cur);r.visitOrder.push_back(cur);} add("BFS_CURRENT_NODE",cur,"","",q.size(),visited.size(),"Current node");
        if(cur==destination){r.reachable=true;add("BFS_DESTINATION_REACHED",cur,"","",q.size(),visited.size(),"Destination reached");break;}
        for(const auto&e:graph.getIncidentEdges(cur)){ if(e.blocked) continue; const std::string n=e.from==cur?e.to:e.from; add("BFS_EDGE_EXAMINED",cur,e.id,"",q.size(),visited.size(),"Examining road"); if(has(discovered,n)){add("BFS_NODE_ALREADY_VISITED",n,e.id,cur,q.size(),visited.size(),"Node already discovered");continue;} discovered.push_back(n); parents.push_back({n,cur}); q.enqueue(n); add("BFS_NODE_DISCOVERED",n,e.id,cur,q.size(),visited.size(),"Node discovered"); add("BFS_ENQUEUE",n,e.id,cur,q.size(),visited.size(),"Discovered node enqueued"); }
    }
    if(!r.reachable){add("BFS_UNREACHABLE",destination,"","",q.size(),visited.size(),"Destination unreachable");add("BFS_COMPLETE",destination,"","",q.size(),visited.size(),"BFS complete");return r;}
    std::string cur=destination;r.pathNodes.push_back(cur); while(cur!=source){auto it=std::find_if(parents.begin(),parents.end(),[&](const Parent&p){return p.node==cur;});if(it==parents.end()){r.reachable=false;break;}r.pathNodes.push_back(it->p);cur=it->p;} std::reverse(r.pathNodes.begin(),r.pathNodes.end());
    for(std::size_t i=1;i<r.pathNodes.size();++i){for(const auto&e:graph.getIncidentEdges(r.pathNodes[i-1])){if(!e.blocked&&((e.from==r.pathNodes[i-1]&&e.to==r.pathNodes[i])||(e.to==r.pathNodes[i-1]&&e.from==r.pathNodes[i]))){r.pathEdges.push_back(e.id);break;}}}
    add("BFS_COMPLETE",destination,"","",q.size(),visited.size(),"BFS complete");return r;
}
}
