import { ArrowRight, Binary, Boxes, Braces, GitBranch, List, Network, Search, SortAsc, Workflow } from 'lucide-react';

const architecture = [
  ['Array','Responder candidate buffer','Keeps compatible units together while C++ evaluates routes.',Boxes],
  ['Linked List','Incident history','Appends resolved incident records in operational order.',List],
  ['Stack','Road undo and DFS','Restores road operations and supports depth-first traversal.',Braces],
  ['Queue','Incident intake and BFS','Preserves report order and minimum-hop exploration.',Workflow],
  ['AVL Tree','Closed incident archive','Maintains balanced searchable lifecycle history.',GitBranch],
  ['Binary Search','Directory lookup','Finds sorted operational records efficiently.',Search],
  ['Merge Sort','Candidate ordering','Produces deterministic responder comparisons.',SortAsc],
  ['Max Heap','Emergency scheduling','Surfaces the highest C++ priority incident.',Binary],
  ['Min Heap','Dijkstra frontier','Extracts the lowest weighted route candidate.',Network],
  ['Hash Table','Incident lookup','Provides direct incident identity access.',Braces],
] as const;

export default function DsaArchitecturePanel({onOpenInspector}:{onOpenInspector:()=>void}) {
  return <main className="eoc-architecture">
    <header><div><span>System / DSA inspection</span><h1>Operational data architecture</h1><p>A concise map of the manual C++ data structures behind CrisisMesh decisions. The production interface consumes their results; it does not reproduce their logic in React.</p></div><button onClick={onOpenInspector}>Open implementation inspector <ArrowRight size={15}/></button></header>
    <div className="eoc-authority-flow"><span>Citizen report</span><ArrowRight/><span>Queue</span><ArrowRight/><span>Max Heap</span><ArrowRight/><span>Candidate buffer</span><ArrowRight/><span>Dijkstra</span><ArrowRight/><span>Dispatch</span></div>
    <section className="eoc-architecture-grid">{architecture.map(([structure,role,description,Icon])=><article key={structure}><Icon size={18}/><div><span>{structure}</span><h2>{role}</h2><p>{description}</p></div></article>)}</section>
    <aside><b>Viva note</b><p>Graph algorithms, sorting, heaps, queues, stacks, linked lists, AVL trees and hash tables remain implemented in C++17. Live algorithm playback displays emitted engine events.</p></aside>
  </main>;
}
