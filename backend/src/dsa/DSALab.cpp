#include "dsa/DSALab.hpp"
#include <algorithm>
#include <cctype>
#include <cmath>
#include <sstream>
#include <stdexcept>

namespace crisismesh {
namespace {
void addEvent(std::vector<LabEvent>& events, std::size_t& step, const std::string& structure, const std::string& type, const std::string& message, const std::vector<int>& values={}, const std::string& value={}, int scalar=0) {
    events.push_back({++step,type,structure,message,values,value,scalar});
}
void mergeParts(std::vector<int>& a, std::vector<int>& temp, std::size_t left, std::size_t mid, std::size_t right, SortTrace& trace, std::size_t& step) {
    std::size_t i=left,j=mid+1,k=left;
    while(i<=mid && j<=right) temp[k++]=(a[i]<=a[j])?a[i++]:a[j++];
    while(i<=mid) temp[k++]=a[i++];
    while(j<=right) temp[k++]=a[j++];
    for(std::size_t p=left;p<=right;++p)a[p]=temp[p];
    addEvent(trace.events,step,"MERGE_SORT","MERGE","Merged range",a);
}
void mergeRec(std::vector<int>& a,std::vector<int>& temp,std::size_t l,std::size_t r,SortTrace& t,std::size_t& step){
    if(l>=r) return;
    const std::size_t m=l+(r-l)/2; mergeRec(a,temp,l,m,t,step); mergeRec(a,temp,m+1,r,t,step); mergeParts(a,temp,l,m,r,t,step);
}
int partition(std::vector<int>& a,int l,int r,SortTrace& t,std::size_t& step){
    const int pivot=a[static_cast<std::size_t>(r)]; int i=l;
    for(int j=l;j<r;++j) if(a[static_cast<std::size_t>(j)]<pivot){std::swap(a[static_cast<std::size_t>(i)],a[static_cast<std::size_t>(j)]);++i;addEvent(t.events,step,"QUICK_SORT","SWAP","Partition swap",a);}
    std::swap(a[static_cast<std::size_t>(i)],a[static_cast<std::size_t>(r)]); addEvent(t.events,step,"QUICK_SORT","PIVOT","Pivot placed",a,{},pivot); return i;
}
void quickRec(std::vector<int>& a,int l,int r,SortTrace& t,std::size_t& step){if(l>=r)return;int p=partition(a,l,r,t,step);quickRec(a,l,p-1,t,step);quickRec(a,p+1,r,t,step);}
void heapify(std::vector<int>& a,std::size_t n,std::size_t i,SortTrace& t,std::size_t& step){std::size_t largest=i,l=2*i+1,r=2*i+2;if(l<n&&a[l]>a[largest])largest=l;if(r<n&&a[r]>a[largest])largest=r;if(largest!=i){std::swap(a[i],a[largest]);addEvent(t.events,step,"HEAP_SORT","SWAP","Heapify swap",a);heapify(a,n,largest,t,step);}}
std::string trim(const std::string& s){std::size_t a=0,b=s.size();while(a<b&&std::isspace(static_cast<unsigned char>(s[a])))++a;while(b>a&&std::isspace(static_cast<unsigned char>(s[b-1])))--b;return s.substr(a,b-a);}
int precedence(char op){return op=='+'||op=='-'?1:op=='*'||op=='/'?2:op=='^'?3:0;}
bool rightAssoc(char op){return op=='^';}
}

BST::~BST(){destroy(root_);} void BST::destroy(Node* n){if(!n)return;destroy(n->left);destroy(n->right);delete n;}
void BST::emit(const std::string& type,const std::string& message,int scalar) const{events_.push_back({++step_,type,"BST",message,{}, {},scalar});}
BST::Node* BST::insertNode(Node* n,int key,bool& inserted){if(!n){inserted=true;return new Node(key);}if(key<n->key)n->left=insertNode(n->left,key,inserted);else if(key>n->key)n->right=insertNode(n->right,key,inserted);return n;}
bool BST::insert(int key){bool inserted=false;root_=insertNode(root_,key,inserted);emit(inserted?"INSERT":"DUPLICATE",inserted?"Inserted key":"Duplicate key ignored",key);return inserted;}
bool BST::searchNode(Node* n,int key){if(!n)return false;if(key==n->key)return true;return searchNode(key<n->key?n->left:n->right,key);} bool BST::search(int key) const{bool found=searchNode(root_,key);emit(found?"FOUND":"NOT_FOUND",found?"Key found":"Key not found",key);return found;}
BST::Node* BST::minNode(Node* n){while(n&&n->left)n=n->left;return n;} BST::Node* BST::removeNode(Node* n,int key,bool& removed){if(!n)return nullptr;if(key<n->key)n->left=removeNode(n->left,key,removed);else if(key>n->key)n->right=removeNode(n->right,key,removed);else{removed=true;if(!n->left){Node*r=n->right;delete n;return r;}if(!n->right){Node*l=n->left;delete n;return l;}Node*s=minNode(n->right);n->key=s->key;n->right=removeNode(n->right,s->key,removed);}return n;}
bool BST::remove(int key){bool removed=false;root_=removeNode(root_,key,removed);emit(removed?"DELETE":"DELETE_MISS",removed?"Deleted key":"Delete target not found",key);return removed;}
void BST::inorderNode(Node*n,std::vector<int>&out){if(!n)return;inorderNode(n->left,out);out.push_back(n->key);inorderNode(n->right,out);} void BST::structureNode(Node*n,int parent,std::size_t depth,std::vector<TreeNodeView>&out){if(!n)return;out.push_back({n->key,parent,depth});structureNode(n->left,n->key,depth+1,out);structureNode(n->right,n->key,depth+1,out);} std::vector<int> BST::inorder() const{std::vector<int> out;inorderNode(root_,out);emit("INORDER","Recursive inorder traversal",static_cast<int>(out.size()));return out;} std::vector<TreeNodeView> BST::structure() const{std::vector<TreeNodeView> out;structureNode(root_,-1,0,out);return out;} void BST::clear(){destroy(root_);root_=nullptr;events_.clear();step_=0;}

AVL::~AVL(){destroy(root_);} void AVL::destroy(Node*n){if(!n)return;destroy(n->left);destroy(n->right);delete n;} int AVL::height(Node*n){return n?n->height:0;} int AVL::balance(Node*n){return n?height(n->left)-height(n->right):0;}
AVL::Node* AVL::rotateRight(Node*y){Node*x=y->left;Node*t=x->right;x->right=y;y->left=t;y->height=1+std::max(height(y->left),height(y->right));x->height=1+std::max(height(x->left),height(x->right));return x;} AVL::Node* AVL::rotateLeft(Node*x){Node*y=x->right;Node*t=y->left;y->left=x;x->right=t;x->height=1+std::max(height(x->left),height(x->right));y->height=1+std::max(height(y->left),height(y->right));return y;}
void AVL::emit(const std::string&type,const std::string&message,int scalar) const{events_.push_back({++step_,type,"AVL",message,{}, {},scalar});}
AVL::Node* AVL::insertNode(Node*n,int key,bool&inserted){if(!n){inserted=true;return new Node(key);}if(key<n->key)n->left=insertNode(n->left,key,inserted);else if(key>n->key)n->right=insertNode(n->right,key,inserted);else return n;n->height=1+std::max(height(n->left),height(n->right));int b=balance(n);if(b>1&&key<n->left->key){emit("ROTATE_RIGHT","LL imbalance corrected",n->key);return rotateRight(n);}if(b<-1&&key>n->right->key){emit("ROTATE_LEFT","RR imbalance corrected",n->key);return rotateLeft(n);}if(b>1&&key>n->left->key){emit("ROTATE_LEFT_RIGHT","LR imbalance corrected",n->key);n->left=rotateLeft(n->left);return rotateRight(n);}if(b<-1&&key<n->right->key){emit("ROTATE_RIGHT_LEFT","RL imbalance corrected",n->key);n->right=rotateRight(n->right);return rotateLeft(n);}return n;}
bool AVL::insert(int key){bool inserted=false;root_=insertNode(root_,key,inserted);emit(inserted?"INSERT":"DUPLICATE",inserted?"Inserted and balanced key":"Duplicate key ignored",key);return inserted;}
AVL::Node* AVL::minNode(Node*n){while(n&&n->left)n=n->left;return n;}
AVL::Node* AVL::removeNode(Node*n,int key,bool&removed){
    if(!n)return nullptr;
    if(key<n->key)n->left=removeNode(n->left,key,removed);
    else if(key>n->key)n->right=removeNode(n->right,key,removed);
    else{
        removed=true;
        if(!n->left||!n->right){Node* child=n->left?n->left:n->right;if(!child){delete n;return nullptr;}Node* old=n; n=child; delete old;}
        else{Node*s=minNode(n->right);n->key=s->key;bool ignored=false;n->right=removeNode(n->right,s->key,ignored);}
    }
    if(!n)return nullptr;
    n->height=1+std::max(height(n->left),height(n->right));
    const int b=balance(n);
    if(b>1&&balance(n->left)>=0){emit("ROTATE_RIGHT","LL imbalance corrected after deletion",n->key);return rotateRight(n);}
    if(b>1&&balance(n->left)<0){emit("ROTATE_LEFT_RIGHT","LR imbalance corrected after deletion",n->key);n->left=rotateLeft(n->left);return rotateRight(n);}
    if(b<-1&&balance(n->right)<=0){emit("ROTATE_LEFT","RR imbalance corrected after deletion",n->key);return rotateLeft(n);}
    if(b<-1&&balance(n->right)>0){emit("ROTATE_RIGHT_LEFT","RL imbalance corrected after deletion",n->key);n->right=rotateRight(n->right);return rotateLeft(n);}
    return n;
}
bool AVL::remove(int key){bool removed=false;root_=removeNode(root_,key,removed);emit(removed?"DELETE":"DELETE_MISS",removed?"Deleted and rebalanced key":"Delete target not found",key);return removed;}
bool AVL::searchNode(Node*n,int key){if(!n)return false;if(key==n->key)return true;return searchNode(key<n->key?n->left:n->right,key);} bool AVL::search(int key)const{bool found=searchNode(root_,key);emit(found?"FOUND":"NOT_FOUND",found?"Key found":"Key not found",key);return found;} void AVL::inorderNode(Node*n,std::vector<int>&out){if(!n)return;inorderNode(n->left,out);out.push_back(n->key);inorderNode(n->right,out);} void AVL::structureNode(Node*n,int parent,std::size_t depth,std::vector<TreeNodeView>&out){if(!n)return;out.push_back({n->key,parent,depth});structureNode(n->left,n->key,depth+1,out);structureNode(n->right,n->key,depth+1,out);} std::vector<int> AVL::inorder()const{std::vector<int>out;inorderNode(root_,out);emit("INORDER","Recursive balanced inorder traversal",static_cast<int>(out.size()));return out;} std::vector<TreeNodeView> AVL::structure()const{std::vector<TreeNodeView> out;structureNode(root_,-1,0,out);return out;} void AVL::clear(){destroy(root_);root_=nullptr;events_.clear();step_=0;}

SortTrace bubbleSortTrace(const std::vector<int>& input){SortTrace t{"Bubble Sort",input,input,{}};std::size_t s=0;for(std::size_t n=t.output.size();n>1;--n){bool swapped=false;for(std::size_t i=1;i<n;++i){addEvent(t.events,s,"BUBBLE_SORT","COMPARE","Compared adjacent values",t.output);if(t.output[i-1]>t.output[i]){std::swap(t.output[i-1],t.output[i]);swapped=true;addEvent(t.events,s,"BUBBLE_SORT","SWAP","Swapped adjacent values",t.output);}}if(!swapped)break;}return t;}
SortTrace selectionSortTrace(const std::vector<int>& input){SortTrace t{"Selection Sort",input,input,{}};std::size_t s=0;for(std::size_t i=0;i<t.output.size();++i){std::size_t m=i;for(std::size_t j=i+1;j<t.output.size();++j){addEvent(t.events,s,"SELECTION_SORT","COMPARE","Compared candidate minimum",t.output);if(t.output[j]<t.output[m])m=j;}if(m!=i){std::swap(t.output[i],t.output[m]);addEvent(t.events,s,"SELECTION_SORT","SWAP","Placed next minimum",t.output);}}return t;}
SortTrace insertionSortTrace(const std::vector<int>& input){SortTrace t{"Insertion Sort",input,input,{}};std::size_t s=0;for(std::size_t i=1;i<t.output.size();++i){int key=t.output[i];std::size_t j=i;while(j>0&&t.output[j-1]>key){t.output[j]=t.output[j-1];--j;addEvent(t.events,s,"INSERTION_SORT","SHIFT","Shifted larger value",t.output);}t.output[j]=key;addEvent(t.events,s,"INSERTION_SORT","INSERT","Inserted next value",t.output);}return t;}
SortTrace mergeSortTrace(const std::vector<int>& input){SortTrace t{"Merge Sort",input,input,{}};if(!t.output.empty()){std::vector<int> temp=t.output;std::size_t s=0;mergeRec(t.output,temp,0,t.output.size()-1,t,s);}return t;}
SortTrace quickSortTrace(const std::vector<int>& input){SortTrace t{"Quick Sort",input,input,{}};std::size_t s=0;if(!t.output.empty())quickRec(t.output,0,static_cast<int>(t.output.size()-1),t,s);return t;}
SortTrace heapSortTrace(const std::vector<int>& input){SortTrace t{"Heap Sort",input,input,{}};std::size_t s=0;for(std::size_t i=t.output.size()/2;i>0;--i)heapify(t.output,t.output.size(),i-1,t,s);for(std::size_t n=t.output.size();n>1;--n){std::swap(t.output[0],t.output[n-1]);addEvent(t.events,s,"HEAP_SORT","EXTRACT_MAX","Moved maximum to sorted suffix",t.output);heapify(t.output,n-1,0,t,s);}return t;}
SearchTrace linearSearchTrace(const std::vector<int>& input,int target){SearchTrace t{"Linear Search",input,target,-1,{}};std::size_t s=0;for(std::size_t i=0;i<input.size();++i){addEvent(t.events,s,"LINEAR_SEARCH","COMPARE","Compared current element",input,{},static_cast<int>(i));if(input[i]==target){t.foundIndex=static_cast<int>(i);addEvent(t.events,s,"LINEAR_SEARCH","FOUND","Target found",input,{},static_cast<int>(i));return t;}}addEvent(t.events,s,"LINEAR_SEARCH","NOT_FOUND","Target not found",input);return t;}
SearchTrace binarySearchTrace(const std::vector<int>& input,int target){SearchTrace t{"Binary Search",input,target,-1,{}};std::size_t s=0;int l=0,r=static_cast<int>(input.size())-1;while(l<=r){int m=l+(r-l)/2;addEvent(t.events,s,"BINARY_SEARCH","COMPARE","Compared middle element",input,{},m);if(input[static_cast<std::size_t>(m)]==target){t.foundIndex=m;addEvent(t.events,s,"BINARY_SEARCH","FOUND","Target found",input,{},m);return t;}if(input[static_cast<std::size_t>(m)]<target)l=m+1;else r=m-1;}addEvent(t.events,s,"BINARY_SEARCH","NOT_FOUND","Target not found",input);return t;}

SparseMatrix::SparseMatrix(std::size_t rows,std::size_t cols):rows_(rows),cols_(cols){}
void SparseMatrix::emit(const std::string&type,const std::string&message,std::size_t row,std::size_t col,int value){events_.push_back({++step_,type,"SPARSE_MATRIX",message,{},std::to_string(row)+","+std::to_string(col),value});}
bool SparseMatrix::set(std::size_t row,std::size_t col,int value){if(row>=rows_||col>=cols_)return false;for(auto it=entries_.begin();it!=entries_.end();++it)if(it->row==row&&it->col==col){if(value==0){entries_.erase(it);emit("REMOVE","Removed zero entry",row,col,value);}else{it->value=value;emit("UPDATE","Updated non-zero entry",row,col,value);}return true;}if(value!=0){entries_.push_back({row,col,value});emit("INSERT","Stored non-zero entry",row,col,value);}return true;}
int SparseMatrix::get(std::size_t row,std::size_t col)const{for(const auto&e:entries_)if(e.row==row&&e.col==col)return e.value;return 0;}

ExpressionTrace processExpression(const std::string& expression){ExpressionTrace t; t.infix=expression;std::size_t step=0;Stack<char> ops;std::string out;std::size_t i=0;try{while(i<expression.size()){if(std::isspace(static_cast<unsigned char>(expression[i]))){++i;continue;}if(std::isdigit(static_cast<unsigned char>(expression[i]))||expression[i]=='.'){std::string n;while(i<expression.size()&&(std::isdigit(static_cast<unsigned char>(expression[i]))||expression[i]=='.'))n+=expression[i++];out+=n+' ';addEvent(t.events,step,"EXPRESSION","OUTPUT","Read operand",{},n);continue;}char c=expression[i++];if(c=='('){ops.push(c);addEvent(t.events,step,"EXPRESSION","PUSH","Push opening parenthesis",{},"(");continue;}if(c==')'){bool matched=false;while(!ops.isEmpty()){char top=ops.pop();if(top=='('){matched=true;break;}out+=top;out+=' ';addEvent(t.events,step,"EXPRESSION","POP","Pop operator to postfix",{},std::string(1,top));}if(!matched)throw std::invalid_argument("Mismatched parentheses");continue;}if(precedence(c)==0)throw std::invalid_argument("Unsupported expression token");while(!ops.isEmpty()&&ops.top()!='('&&(precedence(ops.top())>precedence(c)||(precedence(ops.top())==precedence(c)&&!rightAssoc(c)))){char top=ops.pop();out+=top;out+=' ';addEvent(t.events,step,"EXPRESSION","POP","Pop higher-precedence operator",{},std::string(1,top));}ops.push(c);addEvent(t.events,step,"EXPRESSION","PUSH","Push operator",{},std::string(1,c));}while(!ops.isEmpty()){char top=ops.pop();if(top=='(')throw std::invalid_argument("Mismatched parentheses");out+=top;out+=' ';addEvent(t.events,step,"EXPRESSION","POP","Drain operator stack",{},std::string(1,top));}t.postfix=trim(out);Stack<double> values;std::istringstream in(t.postfix);std::string token;while(in>>token){if(std::isdigit(static_cast<unsigned char>(token[0]))||token[0]=='.'){values.push(std::stod(token));addEvent(t.events,step,"EXPRESSION","EVAL_PUSH","Push operand",{},token);continue;}if(token.size()!=1||values.size()<2)throw std::invalid_argument("Invalid postfix expression");double b=values.pop(),a=values.pop(),v=0;switch(token[0]){case '+':v=a+b;break;case '-':v=a-b;break;case '*':v=a*b;break;case '/':if(std::fabs(b)<1e-12)throw std::invalid_argument("Division by zero");v=a/b;break;case '^':v=std::pow(a,b);break;default:throw std::invalid_argument("Invalid operator");}values.push(v);addEvent(t.events,step,"EXPRESSION","EVAL","Evaluated operator",{},token,v);}if(values.size()!=1)throw std::invalid_argument("Invalid expression");t.result=values.pop();t.valid=true;addEvent(t.events,step,"EXPRESSION","COMPLETE","Expression evaluated",{},"",static_cast<int>(t.result));}catch(const std::exception&e){t.valid=false;addEvent(t.events,step,"EXPRESSION","ERROR",e.what());}return t;}

} // namespace crisismesh
