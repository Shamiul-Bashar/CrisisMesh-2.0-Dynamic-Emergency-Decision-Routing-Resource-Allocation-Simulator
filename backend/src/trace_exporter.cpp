#include "bfs/BFS.hpp"
#include "dfs/DFS.hpp"
#include "dijkstra/Dijkstra.hpp"
#include "dijkstra/JsonTrace.hpp"
#include "dsa/DSALab.hpp"
#include "graph/CityData.hpp"
#include "hashtable/HashTable.hpp"
#include "linkedlist/LinkedList.hpp"
#include "queue/Queue.hpp"
#include "stack/Stack.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace crisismesh;

namespace {
std::string quote(const std::string& s){std::string o="\"";for(char c:s){if(c=='\\')o+="\\\\";else if(c=='\"')o+="\\\"";else o+=c;}return o+"\"";}
std::string structureJson(const std::string& algorithm,const std::vector<AlgorithmEvent>& events){std::ostringstream o;o<<"{\"algorithm\":"<<quote(algorithm)<<",\"events\":[";for(size_t i=0;i<events.size();++i){if(i)o<<',';const auto&e=events[i];o<<"{\"type\":"<<quote(e.type)<<",\"step\":"<<e.step<<",\"size\":"<<e.size<<",\"bucket\":"<<e.bucket<<",\"collisionCount\":"<<e.collisionCount<<",\"key\":"<<quote(e.key)<<",\"message\":"<<quote(e.message)<<"}";}o<<"]}";return o.str();}
std::filesystem::path outputDir(){auto cwd=std::filesystem::current_path();auto root=cwd.filename()=="build"?cwd.parent_path():cwd;auto dir=root.parent_path()/"public"/"data";std::filesystem::create_directories(dir);return dir;}

std::string intArray(const std::vector<int>& v){std::ostringstream o;o<<"[";for(std::size_t i=0;i<v.size();++i){if(i)o<<',';o<<v[i];}return o.str()+"]";}
std::string labEventsJson(const std::vector<LabEvent>& events){std::ostringstream o;o<<"[";for(std::size_t i=0;i<events.size();++i){if(i)o<<',';const auto&e=events[i];o<<"{\"step\":"<<e.step<<",\"type\":"<<quote(e.type)<<",\"structure\":"<<quote(e.structure)<<",\"message\":"<<quote(e.message)<<",\"values\":"<<intArray(e.values)<<",\"value\":"<<quote(e.value)<<",\"scalar\":"<<e.scalar<<"}";}return o.str()+"]";}
std::string sortJson(const SortTrace& t){std::ostringstream o;o<<"{\"algorithm\":"<<quote(t.algorithm)<<",\"input\":"<<intArray(t.input)<<",\"output\":"<<intArray(t.output)<<",\"events\":"<<labEventsJson(t.events)<<"}";return o.str();}
std::string searchJson(const SearchTrace& t){std::ostringstream o;o<<"{\"algorithm\":"<<quote(t.algorithm)<<",\"input\":"<<intArray(t.input)<<",\"target\":"<<t.target<<",\"foundIndex\":"<<t.foundIndex<<",\"events\":"<<labEventsJson(t.events)<<"}";return o.str();}
std::string treeJson(const std::string& algorithm,const std::vector<int>& inorder,const std::vector<TreeNodeView>& nodes,const std::vector<LabEvent>& events){std::ostringstream o;o<<"{\"algorithm\":"<<quote(algorithm)<<",\"inorder\":"<<intArray(inorder)<<",\"nodes\":[";for(std::size_t i=0;i<nodes.size();++i){if(i)o<<',';const auto&n=nodes[i];o<<"{\"key\":"<<n.key<<",\"parent\":"<<n.parent<<",\"depth\":"<<n.depth<<"}";}o<<"],\"events\":"<<labEventsJson(events)<<"}";return o.str();}
std::string sparseJson(const SparseMatrix& m){std::ostringstream o;o<<"{\"algorithm\":\"Sparse Matrix\",\"rows\":"<<m.rows()<<",\"cols\":"<<m.cols()<<",\"nonZeroCount\":"<<m.nonZeroCount()<<",\"entries\":[";for(std::size_t i=0;i<m.entries().size();++i){if(i)o<<',';const auto&e=m.entries()[i];o<<"{\"row\":"<<e.row<<",\"col\":"<<e.col<<",\"value\":"<<e.value<<"}";}o<<"],\"events\":"<<labEventsJson(m.events())<<"}";return o.str();}
std::string expressionJson(const ExpressionTrace& t){std::ostringstream o;o<<"{\"algorithm\":\"Expression Processing\",\"infix\":"<<quote(t.infix)<<",\"postfix\":"<<quote(t.postfix)<<",\"result\":"<<t.result<<",\"valid\":"<<(t.valid?"true":"false")<<",\"events\":"<<labEventsJson(t.events)<<"}";return o.str();}

void write(const std::filesystem::path&p,const std::string&s){std::ofstream out(p);if(!out)throw std::runtime_error("Cannot write "+p.string());out<<s<<'\n';}
}

int main(int argc,char**argv){
 std::string algorithm="all",source="LOC-003",destination="LOC-007";for(int i=1;i<argc;++i){std::string a=argv[i];auto pos=a.find('=');if(pos!=std::string::npos){auto k=a.substr(0,pos),v=a.substr(pos+1);if(k=="--algorithm")algorithm=v;else if(k=="--source")source=v;else if(k=="--target"||k=="--destination")destination=v;}}
 try{
  Graph graph=createCrisisMeshCity();auto dir=outputDir();
  if(algorithm=="all"||algorithm=="dijkstra"){Dijkstra d;auto r=d.run(graph,source,destination);write(dir/("dijkstra-events-"+source+"-"+destination+".json"),resultToJson(r,source,destination,graph));std::cout<<"Dijkstra trace generated\n";}
  if(algorithm=="all"||algorithm=="bfs"){BFS b;auto r=b.run(graph,source,destination);write(dir/("bfs-events-"+source+"-"+destination+".json"),algorithmEventsToJson(r,source,destination,"BFS"));std::cout<<"BFS trace generated\n";}
  if(algorithm=="all"||algorithm=="dfs"){DFS d;auto r=d.run(graph,source,destination);write(dir/("dfs-events-"+source+"-"+destination+".json"),algorithmEventsToJson(r,source,destination,"DFS"));std::cout<<"DFS trace generated\n";}
  if(algorithm=="all"||algorithm=="structures"){
   std::vector<AlgorithmEvent> qev;std::size_t step=0;Queue<std::string> q; q.enqueue("LOC-003");q.enqueue("LOC-005");q.enqueue("LOC-009");q.dequeue();for(const auto&e:q.events()){std::string t;switch(e.type){case Queue<std::string>::EventType::ENQUEUE:t="QUEUE_ENQUEUE";break;case Queue<std::string>::EventType::DEQUEUE:t="QUEUE_DEQUEUE";break;case Queue<std::string>::EventType::FRONT:t="QUEUE_FRONT";break;default:t="QUEUE_SIZE_CHANGED";}qev.push_back({t,"QUEUE",++step,"","","",e.size,0,0,e.size,0,0,"","","Manual emergency request queue event"});}
   write(dir/"queue-events.json",structureJson("Queue",qev));
   std::vector<AlgorithmEvent> sev;step=0;Stack<std::string> s;s.push("REPORTED");s.push("TRIAGED");s.push("QUEUED");s.pop();for(const auto&e:s.events()){std::string t;switch(e.type){case Stack<std::string>::EventType::PUSH:t="STACK_PUSH";break;case Stack<std::string>::EventType::POP:t="STACK_POP";break;case Stack<std::string>::EventType::TOP:t="STACK_TOP";break;default:t="STACK_SIZE_CHANGED";}sev.push_back({t,"STACK",++step,"","","",0,e.size,0,e.size,0,0,"","","Incident action-history stack event"});}write(dir/"stack-events.json",structureJson("Stack",sev));
   LinkedList list;list.insertBack("REPORTED");list.insertBack("TRIAGED");list.insertBack("QUEUED");list.insertBack("ASSIGNED");list.removeAt(1);std::vector<AlgorithmEvent> lev;step=0;for(const auto&x:list.events())lev.push_back({x.type,"LINKED_LIST",++step,"","","",0,0,0,x.size,0,0,x.value,"", "Incident history linked-list operation"});for(const auto&v:list.values())lev.push_back({"LIST_TRAVERSE","LINKED_LIST",++step,"","","",0,0,0,list.size(),0,0,v,"","Incident history node traversed"});write(dir/"linkedlist-events.json",structureJson("Linked List",lev));
   HashTable h(5);h.insert({"INC-104","FIRE","REPORTED",94});h.insert({"INC-118","MEDICAL","QUEUED",88});h.insert({"INC-121","POLICE","ASSIGNED",72});h.search("INC-118");h.search("INC-999");h.remove("INC-121");std::vector<AlgorithmEvent> hev;step=0;for(const auto&e:h.events())hev.push_back({e.type,"HASH_TABLE",++step,"","","",0,0,0,e.size,e.bucket,e.collisionCount,e.key,"",e.message});write(dir/"hashtable-events.json",structureJson("Hash Table",hev));
   BST bst; bst.insert(50); bst.insert(30); bst.insert(70); bst.insert(20); bst.insert(40); bst.search(40); bst.remove(30);
   AVL avl; avl.insert(30); avl.insert(20); avl.insert(10); avl.insert(25); avl.insert(28); avl.search(28);
   const auto bstInorder=bst.inorder(); const auto bstNodes=bst.structure();
   const auto avlInorder=avl.inorder(); const auto avlNodes=avl.structure();
   write(dir/"bst-events.json",treeJson("BST",bstInorder,bstNodes,bst.events()));
   write(dir/"avl-events.json",treeJson("AVL",avlInorder,avlNodes,avl.events()));
   const std::vector<int> sample{7,2,9,1,5,3};
   std::ostringstream sorts; sorts<<"{\"algorithm\":\"Sorting Suite\",\"algorithms\":[";
   const std::vector<SortTrace> traces={bubbleSortTrace(sample),selectionSortTrace(sample),insertionSortTrace(sample),mergeSortTrace(sample),quickSortTrace(sample),heapSortTrace(sample)};
   for(std::size_t i=0;i<traces.size();++i){if(i)sorts<<',';sorts<<sortJson(traces[i]);} sorts<<"]}"; write(dir/"sorting-events.json",sorts.str());
   write(dir/"searching-events.json",std::string("{\"algorithm\":\"Searching Suite\",\"algorithms\":[")+searchJson(linearSearchTrace(sample,5))+","+searchJson(binarySearchTrace({1,2,3,5,7,9},7))+" ]}");
   SparseMatrix matrix(6,6); matrix.set(0,1,8); matrix.set(1,4,5); matrix.set(3,2,9); matrix.set(5,5,4); write(dir/"sparse-matrix-events.json",sparseJson(matrix));
   write(dir/"expression-events.json",expressionJson(processExpression("(12+8)*3-6/2")));
   write(dir/"dsa-master-events.json", std::string("{\"bst\":") + treeJson("BST",bstInorder,bstNodes,bst.events()) + ",\"avl\":" + treeJson("AVL",avlInorder,avlNodes,avl.events()) + ",\"sorting\":" + sorts.str() + ",\"searching\":" + (std::string("{\"algorithm\":\"Searching Suite\",\"algorithms\":[") + searchJson(linearSearchTrace(sample,5)) + "," + searchJson(binarySearchTrace({1,2,3,5,7,9},7)) + "]}") + ",\"sparse\":" + sparseJson(matrix) + ",\"expression\":" + expressionJson(processExpression("(12+8)*3-6/2")) + "}");
   std::cout<<"Structure + tree + sorting + searching + sparse-matrix + expression traces generated\n";
  }
 }catch(const std::exception&e){std::cerr<<"Trace export failed: "<<e.what()<<'\n';return 1;}return 0;
}
