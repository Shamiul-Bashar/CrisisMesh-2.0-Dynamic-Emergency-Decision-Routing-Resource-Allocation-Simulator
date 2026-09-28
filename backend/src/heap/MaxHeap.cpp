#include "heap/MaxHeap.hpp"
#include <utility>
namespace crisismesh {
bool MaxHeap::higher(const Incident&a,const Incident&b){
    if(a.priorityScore!=b.priorityScore)return a.priorityScore>b.priorityScore;
    return a.reportedSequence<b.reportedSequence;
}
bool MaxHeap::insert(const Incident&i){
    heap_.push_back(i); events_.push_back({EventType::INSERT,heap_.size()-1,0,i.priorityScore,i.incidentId,heap_.size(),"Incident inserted into manual max heap"}); siftUp(heap_.size()-1); return true;
}
void MaxHeap::siftUp(std::size_t i){
    while(i>0){std::size_t p=(i-1)/2;events_.push_back({EventType::COMPARE,i,p,heap_[i].priorityScore,heap_[i].incidentId,heap_.size(),"Compare child with parent"});if(!higher(heap_[i],heap_[p]))break;std::swap(heap_[i],heap_[p]);events_.push_back({EventType::SWAP,p,i,heap_[p].priorityScore,heap_[p].incidentId,heap_.size(),"Heap swap during sift-up"});i=p;}
}
void MaxHeap::siftDown(std::size_t i){
    while(true){std::size_t l=2*i+1,r=l+1,b=i;if(l<heap_.size()){events_.push_back({EventType::COMPARE,i,l,heap_[l].priorityScore,heap_[l].incidentId,heap_.size(),"Compare left child"});if(higher(heap_[l],heap_[b]))b=l;}if(r<heap_.size()){events_.push_back({EventType::COMPARE,i,r,heap_[r].priorityScore,heap_[r].incidentId,heap_.size(),"Compare right child"});if(higher(heap_[r],heap_[b]))b=r;}if(b==i)break;std::swap(heap_[i],heap_[b]);events_.push_back({EventType::SWAP,i,b,heap_[i].priorityScore,heap_[i].incidentId,heap_.size(),"Heap swap during sift-down"});i=b;}
}
Incident MaxHeap::extractMax(){if(heap_.empty())throw std::underflow_error("MaxHeap is empty");Incident top=heap_.front();heap_.front()=heap_.back();heap_.pop_back();events_.push_back({EventType::EXTRACT_MAX,0,0,top.priorityScore,top.incidentId,heap_.size(),"Highest-priority incident extracted"});if(!heap_.empty())siftDown(0);return top;}
const Incident& MaxHeap::peekMax() const {if(heap_.empty())throw std::underflow_error("MaxHeap is empty");events_.push_back({EventType::PEEK_MAX,0,0,heap_.front().priorityScore,heap_.front().incidentId,heap_.size(),"Current maximum priority incident"});return heap_.front();}
void MaxHeap::clear(){heap_.clear();events_.push_back({EventType::CLEAR,0,0,0,"",0,"Max heap cleared"});}
} // namespace
