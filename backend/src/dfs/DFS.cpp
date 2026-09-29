#include "dfs/DFS.hpp"
#include "stack/Stack.hpp"
#include <algorithm>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>

namespace crisismesh {
TraversalResult DFS::run(const Graph& graph,const std::string& source,const std::string& destination) const {
    if(!graph.vertexExists(source)||!graph.vertexExists(destination))
        throw std::invalid_argument("DFS source or destination does not exist");
    TraversalResult result;
    struct Frame { std::string node; std::size_t next{0}; };
    Stack<Frame> stack;
    std::unordered_map<std::string,std::vector<Edge>> adjacency;
    std::unordered_map<std::string,std::string> parent, parentEdge;
    std::unordered_set<std::string> discovered;
    auto event=[&](const std::string& type,const std::string& node,const std::string& edge="",const std::string& previous="") {
        AlgorithmEvent e;
        e.type=type;e.algorithm="DFS";e.step=result.events.size()+1;e.nodeId=node;e.edgeId=edge;e.parentNodeId=previous;
        e.stackSize=stack.size();e.visitedCount=result.visitOrder.size();e.message=type;
        result.events.push_back(std::move(e));
    };
    auto enter=[&](const std::string& node) {
        discovered.insert(node);adjacency[node]=graph.getIncidentEdges(node);
        stack.push({node,0});result.visitOrder.push_back(node);
        event("DFS_PUSH",node);event("DFS_CURRENT_NODE",node);
    };
    event("DFS_START",source);event("DFS_SOURCE_SELECTED",source);enter(source);
    while(!stack.isEmpty()) {
        Frame frame=stack.pop();
        if(frame.node==destination) {
            result.reachable=true;result.sourceEqualsDestination=source==destination;
            event("DFS_DESTINATION_REACHED",frame.node);break;
        }
        const auto& edges=adjacency.at(frame.node);
        bool advanced=false;
        while(frame.next<edges.size()) {
            const auto& edge=edges[frame.next++];
            if(edge.blocked)continue;
            const auto next=edge.from==frame.node?edge.to:edge.from;
            event("DFS_EDGE_EXAMINED",frame.node,edge.id);
            if(discovered.count(next)) { event("DFS_NODE_ALREADY_VISITED",next,edge.id,frame.node);continue; }
            parent[next]=frame.node;parentEdge[next]=edge.id;
            stack.push(frame);event("DFS_NODE_DISCOVERED",next,edge.id,frame.node);enter(next);
            advanced=true;break;
        }
        if(!advanced) {
            event("DFS_POP",frame.node);
            event("DFS_BACKTRACK",frame.node,"",parent.count(frame.node)?parent.at(frame.node):"");
        }
    }
    if(result.reachable) {
        std::string node=destination;result.pathNodes.push_back(node);
        while(node!=source) {
            result.pathEdges.push_back(parentEdge.at(node));node=parent.at(node);result.pathNodes.push_back(node);
        }
        std::reverse(result.pathNodes.begin(),result.pathNodes.end());
        std::reverse(result.pathEdges.begin(),result.pathEdges.end());
    } else event("DFS_UNREACHABLE",destination);
    event("DFS_COMPLETE",destination);
    return result;
}
} // namespace crisismesh
