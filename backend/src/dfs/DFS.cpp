#include "dfs/DFS.hpp"
#include "stack/Stack.hpp"
#include <algorithm>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>
namespace crisismesh {
TraversalResult DFS::run(const Graph& graph,const std::string& source,const std::string& destination) const {
 if(!graph.vertexExists(source)||!graph.vertexExists(destination)) throw std::invalid_argument("DFS source or destination does not exist");
 TraversalResult r;std::size_t step=0;auto add=[&](const std::string&t,const std::string&node="",const std::string&edge="",const std::string&parent="",std::size_t s=0,std::size_t v=0,const std::string&m=""){r.events.push_back({t,"DFS",++step,node,edge,parent,0,s,v,0,0,0,"","",m,0,0.0,0.0,"","",{},{} });};
 add("DFS_START","","","",0,0,"DFS execution started");add("DFS_SOURCE_SELECTED",source,"","",0,0,"Source selected");
 if(source==destination){r.reachable=r.sourceEqualsDestination=true;r.visitOrder={source};r.pathNodes={source};add("DFS_PUSH",source,"","",1,0,"Source pushed");add("DFS_POP",source,"","",0,1,"Source popped");add("DFS_CURRENT_NODE",source,"","",0,1,"Current node");add("DFS_DESTINATION_REACHED",source,"","",0,1,"Source equals destination");add("DFS_COMPLETE",source,"","",0,1,"DFS complete");return r;}
 Stack<std::string> s;std::unordered_set<std::string> discovered{source},visited;std::unordered_map<std::string,std::string> parents;s.push(source);add("DFS_PUSH",source,"","",s.size(),0,"Source pushed");
 while(!s.isEmpty()){auto cur=s.pop();add("DFS_POP",cur,"","",s.size(),visited.size(),"Node popped");if(!visited.insert(cur).second){add("DFS_NODE_ALREADY_VISITED",cur,"","",s.size(),visited.size(),"Node already visited");continue;}r.visitOrder.push_back(cur);add("DFS_CURRENT_NODE",cur,"","",s.size(),visited.size(),"Current node");if(cur==destination){r.reachable=true;add("DFS_DESTINATION_REACHED",cur,"","",s.size(),visited.size(),"Destination reached");break;}
 bool advanced=false;auto edges=graph.getIncidentEdges(cur);std::reverse(edges.begin(),edges.end());for(const auto&e:edges){if(e.blocked)continue;const std::string n=e.from==cur?e.to:e.from;add("DFS_EDGE_EXAMINED",cur,e.id,"",s.size(),visited.size(),"Examining road");if(!discovered.insert(n).second){add("DFS_NODE_ALREADY_VISITED",n,e.id,cur,s.size(),visited.size(),"Node already discovered");continue;}advanced=true;parents[n]=cur;s.push(n);add("DFS_NODE_DISCOVERED",n,e.id,cur,s.size(),visited.size(),"Node discovered and pushed");add("DFS_PUSH",n,e.id,cur,s.size(),visited.size(),"Node pushed onto stack");}if(!advanced)add("DFS_BACKTRACK",cur,"","",s.size(),visited.size(),"Dead end reached; traversal backtracks");}
 if(!r.reachable){add("DFS_UNREACHABLE",destination,"","",s.size(),visited.size(),"Destination unreachable");add("DFS_COMPLETE",destination,"","",s.size(),visited.size(),"DFS complete");return r;}
 std::string cur=destination;r.pathNodes.push_back(cur);while(cur!=source){auto it=parents.find(cur);if(it==parents.end()){r.reachable=false;break;}r.pathNodes.push_back(it->second);cur=it->second;}std::reverse(r.pathNodes.begin(),r.pathNodes.end());for(std::size_t i=1;i<r.pathNodes.size();++i){for(const auto&e:graph.getIncidentEdges(r.pathNodes[i-1]))if(!e.blocked&&((e.from==r.pathNodes[i-1]&&e.to==r.pathNodes[i])||(e.to==r.pathNodes[i-1]&&e.from==r.pathNodes[i]))){r.pathEdges.push_back(e.id);break;}}
 add("DFS_COMPLETE",destination,"","",s.size(),visited.size(),"DFS complete");return r;
}
}
