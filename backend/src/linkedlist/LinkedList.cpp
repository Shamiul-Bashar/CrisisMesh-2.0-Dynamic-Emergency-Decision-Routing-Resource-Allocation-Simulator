#include "linkedlist/LinkedList.hpp"
#include <utility>
namespace crisismesh {
LinkedList::~LinkedList(){ while(removeFront()){} }
void LinkedList::validateNewValue(const std::string& value) const { if(value.empty()) throw std::invalid_argument("LinkedList value cannot be empty"); if(rejectDuplicates_ && contains(value)) throw std::invalid_argument("Duplicate linked-list value"); }
void LinkedList::insertFront(const std::string& value){ validateNewValue(value); Node* n=new Node(value); n->next=head_; head_=n; if(!tail_) tail_=n; ++size_; events_.push_back({"LIST_INSERT_FRONT",0,size_,value}); }
void LinkedList::insertBack(const std::string& value){ validateNewValue(value); Node* n=new Node(value); if(tail_) tail_->next=n; else head_=n; tail_=n; ++size_; events_.push_back({"LIST_INSERT_BACK",size_-1,size_,value}); }
void LinkedList::insertAt(std::size_t index,const std::string& value){ if(index>size_) throw std::out_of_range("LinkedList index out of range"); if(index==0){insertFront(value);return;} if(index==size_){insertBack(value);return;} validateNewValue(value); Node* prev=head_; for(std::size_t i=1;i<index;++i) prev=prev->next; Node* n=new Node(value); n->next=prev->next; prev->next=n; ++size_; }
bool LinkedList::removeFront(){ if(!head_) return false; Node* old=head_; head_=head_->next; delete old; --size_; if(size_==0) tail_=nullptr; events_.push_back({"LIST_REMOVE_FRONT",0,size_,""}); return true; }
bool LinkedList::removeBack(){ if(!tail_) return false; if(head_==tail_){delete head_;head_=tail_=nullptr;size_=0;return true;} Node* p=head_; while(p->next!=tail_) p=p->next; delete tail_; tail_=p; tail_->next=nullptr; --size_; events_.push_back({"LIST_REMOVE_BACK",size_,size_,""}); return true; }
bool LinkedList::removeAt(std::size_t index){ if(index>=size_) return false; if(index==0) return removeFront(); Node* p=head_; for(std::size_t i=1;i<index;++i) p=p->next; Node* old=p->next; p->next=old->next; if(old==tail_) tail_=p; delete old; --size_; events_.push_back({"LIST_REMOVE_AT",index,size_,""}); return true; }
LinkedList::Node* LinkedList::find(const std::string& value){ for(Node* p=head_;p;p=p->next) if(p->value==value) return p; return nullptr; }
bool LinkedList::contains(const std::string& value) const { for(Node* p=head_;p;p=p->next) if(p->value==value) return true; return false; }
std::vector<std::string> LinkedList::values() const { std::vector<std::string> out; for(Node* p=head_;p;p=p->next) out.push_back(p->value); return out; }
void LinkedList::clear(){while(head_){Node*n=head_;head_=head_->next;delete n;}tail_=nullptr;size_=0;events_.clear();}
} // namespace crisismesh
