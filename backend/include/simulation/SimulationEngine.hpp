#pragma once
#include "core/AlgorithmEvent.hpp"
#include "domain/Incident.hpp"
#include "domain/Responder.hpp"
#include "dijkstra/Dijkstra.hpp"
#include "graph/Graph.hpp"
#include "hashtable/HashTable.hpp"
#include "linkedlist/LinkedList.hpp"
#include "queue/Queue.hpp"
#include "heap/MaxHeap.hpp"
#include "allocation/AllocationEngine.hpp"
#include "stack/Stack.hpp"
#include <string>
#include <vector>

namespace crisismesh {

struct DispatchResult {
    bool success{false};
    Incident incident{};
    Responder responder{};
    DijkstraResult route{};
    std::string message;
};

class SimulationEngine {
public:
    SimulationEngine();

    const Graph& graph() const { return graph_; }
    Graph& graph() { return graph_; }
    const std::vector<Responder>& responders() const { return responders_; }
    const std::vector<Incident>& incidents() const { return incidents_; }
    const std::vector<AlgorithmEvent>& events() const { return events_; }
    const MaxHeap& priorityHeap() const { return maxHeap_; }
    const AllocationEngine& allocationEngine() const { return allocationEngine_; }

    Incident reportEmergency(IncidentType type, const std::string& locationId,
                             int severity, int urgency, int victimCount,
                             const std::string& description = {});
    DispatchResult processNextIncident();
    DispatchResult dispatchIncident(const std::string& incidentId);
    bool blockRoad(const std::string& edgeId);
    bool unblockRoad(const std::string& edgeId);
    bool undoLastRoadBlock();
    std::size_t roadUndoDepth() const { return roadUndoStack_.size(); }
    DispatchResult rerouteAssignedIncident(const std::string& incidentId);
    bool resolveIncident(const std::string& incidentId);
    bool setResponderAvailability(const std::string& responderId, ResponderAvailability availability);
    const Shelter* findShelter(const std::string& shelterId) const;
    void reset();
    const Incident* findIncident(const std::string& incidentId) const;

    static std::string eventsToJson(const std::vector<AlgorithmEvent>& events,
                                    const DispatchResult* result = nullptr);
    static std::string incidentToJson(const Incident& incident);
    std::string stateToJson() const;

private:
    Graph graph_;
    Dijkstra dijkstra_;
    Queue<Incident> intakeQueue_;
    MaxHeap maxHeap_;
    AllocationEngine allocationEngine_;
    HashTable incidentTable_;
    LinkedList history_;
    std::vector<Incident> incidents_;
    std::vector<Responder> responders_;
    std::vector<AlgorithmEvent> events_;
    long long sequence_{0};
    int nextIncidentNumber_{201};
    Stack<std::string> roadUndoStack_;

    void emit(const std::string& type, const Incident* incident,
              const std::string& node = {}, const std::string& edge = {},
              const std::string& message = {}, int value = 0);
    Incident& mutableIncident(const std::string& id);
    Responder* chooseResponder(const Incident& incident, DijkstraResult& bestRoute);
    static std::string escape(const std::string& value);
};

} // namespace crisismesh
