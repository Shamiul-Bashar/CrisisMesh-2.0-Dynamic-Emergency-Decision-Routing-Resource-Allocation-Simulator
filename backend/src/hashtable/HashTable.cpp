#include "hashtable/HashTable.hpp"
#include <utility>
namespace crisismesh {
HashTable::HashTable(std::size_t bucketCount):buckets_(bucketCount,nullptr){if(bucketCount==0) throw std::invalid_argument("Hash table bucket count must be positive");}
HashTable::~HashTable(){clear();}
std::size_t HashTable::hash(const std::string& key) const { std::size_t h=2166136261u; for(unsigned char c:key){h^=c; h*=16777619u;} return h; }
std::size_t HashTable::bucketIndex(const std::string& key) const { return hash(key)%buckets_.size(); }
bool HashTable::insert(const IncidentRecord& record){ if(record.id.empty()) throw std::invalid_argument("Incident ID cannot be empty"); const auto b=bucketIndex(record.id); Node* p=buckets_[b]; if(p) { ++collisions_; events_.push_back({"HASH_COLLISION",b,size_,collisions_,record.id,"Separate chaining collision"}); } for(Node* n=p;n;n=n->next) if(n->record.id==record.id){return false;} Node* n=new Node(record); n->next=buckets_[b]; buckets_[b]=n; ++size_; events_.push_back({"HASH_COMPUTE",b,size_,collisions_,record.id,"Bucket index computed"}); events_.push_back({"HASH_INSERT",b,size_,collisions_,record.id,"Incident inserted"}); return true; }
const IncidentRecord* HashTable::search(const std::string& key) const { const auto b=bucketIndex(key); events_.push_back({"HASH_SEARCH",b,size_,collisions_,key,"Incident lookup started"}); for(Node* n=buckets_[b];n;n=n->next) if(n->record.id==key){ events_.push_back({"HASH_FOUND",b,size_,collisions_,key,"Incident found"}); return &n->record; } events_.push_back({"HASH_NOT_FOUND",b,size_,collisions_,key,"Incident not found"}); return nullptr; }
bool HashTable::remove(const std::string& key){ const auto b=bucketIndex(key); Node* prev=nullptr; Node* cur=buckets_[b]; while(cur){ if(cur->record.id==key){ if(prev)prev->next=cur->next; else buckets_[b]=cur->next; delete cur; --size_; events_.push_back({"HASH_REMOVE",b,size_,collisions_,key,"Incident removed"}); return true;} prev=cur;cur=cur->next;} events_.push_back({"HASH_NOT_FOUND",b,size_,collisions_,key,"Incident not found for removal"}); return false; }
void HashTable::clear(){ for(Node*& head:buckets_){while(head){Node* n=head;head=head->next;delete n;}} size_=0; }
std::vector<std::vector<std::string>> HashTable::bucketSnapshot() const { std::vector<std::vector<std::string>> out(buckets_.size()); for(std::size_t i=0;i<buckets_.size();++i) for(Node* n=buckets_[i];n;n=n->next) out[i].push_back(n->record.id); return out; }
} // namespace crisismesh
