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
#include "search/LocationDirectory.hpp"
#include "sort/CandidateMergeSort.hpp"
#include "tree/IncidentArchiveIndex.hpp"
#include "simulation/DispatchRecord.hpp"

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

    const Graph& graph() const {
        return graph_;
    }

    Graph& graph() {
        return graph_;
    }

    const std::vector<Responder>& responders() const {
        return responders_;
    }

    const std::vector<Incident>& incidents() const {
        return incidents_;
    }

    const std::vector<AlgorithmEvent>& events() const {
        return events_;
    }

    const MaxHeap& priorityHeap() const {
        return maxHeap_;
    }

    const AllocationEngine& allocationEngine() const {
        return allocationEngine_;
    }

    const IncidentArchiveIndex& archiveIndex() const { return archiveIndex_; }
    const std::vector<Facility>& facilities() const { return facilities_; }
    const std::vector<DispatchRecord>& dispatches() const { return dispatches_; }
    std::string analyze(const std::string& algorithm, const std::string& source, const std::string& destination) const;
    const LocationDirectory& locationDirectory() const { return locationDirectory_; }
    const std::vector<ResponderCandidateSummary>& lastCandidateSummaries() const { return lastCandidateSummaries_; }
    std::vector<std::string> intakeIncidentIds() const;
    std::vector<std::string> historyEntries() const { return history_.values(); }


    /* =====================================================
       INCIDENT REPORTING
       ===================================================== */

    Incident reportEmergency(
        IncidentType type,
        const std::string& locationId,
        int severity,
        int urgency,
        int victimCount,
        const std::string& description = {},
        const std::string& reportedByUserId = {}
    );


    /* =====================================================
       INCIDENT PROCESSING / DISPATCH
       ===================================================== */

    DispatchResult processNextIncident();

    DispatchResult dispatchIncident(
        const std::string& incidentId
    );


    /* =====================================================
       ROAD OPERATIONS
       ===================================================== */

    bool blockRoad(
        const std::string& edgeId
    );

    bool unblockRoad(
        const std::string& edgeId
    );

    bool undoLastRoadBlock();

    std::size_t roadUndoDepth() const {
        return roadUndoStack_.size();
    }


    /* =====================================================
       ROUTING
       ===================================================== */

    DispatchResult rerouteAssignedIncident(
        const std::string& incidentId
    );


    /* =====================================================
       INCIDENT RESOLUTION WORKFLOW
       ===================================================== */

    /*
     * Legacy/direct resolution method.
     *
     * Kept for compatibility with existing tests/code.
     */
    bool resolveIncident(
        const std::string& incidentId
    );


    /*
     * Author/responder reports that field operation
     * has been completed.
     *
     * Incident then waits for confirmation from
     * the user who originally reported it.
     */
    bool markResponseCompleted(
        const std::string& incidentId
    );


    /*
     * Reporting user confirms:
     * "Yes, my problem has been solved."
     *
     * Incident becomes RESOLVED and then CLOSED.
     */
    bool confirmIncidentResolved(
        const std::string& incidentId,
        const std::string& userId
    );


    /*
     * Reporting user says:
     * "No, I still need help."
     *
     * Incident becomes ESCALATED and returns
     * to the emergency workflow.
     */
    bool escalateIncident(
        const std::string& incidentId,
        const std::string& userId,
        const std::string& reason
    );


    /* =====================================================
       RESPONDER OPERATIONS
       ===================================================== */

    bool setResponderAvailability(
        const std::string& responderId,
        ResponderAvailability availability
    );


    /* =====================================================
       LOOKUPS / STATE
       ===================================================== */

    const Shelter* findShelter(
        const std::string& shelterId
    ) const;

    const Incident* findIncident(
        const std::string& incidentId
    ) const;

    void reset();


    /* =====================================================
       JSON EXPORT
       ===================================================== */

    static std::string eventsToJson(
        const std::vector<AlgorithmEvent>& events,
        const DispatchResult* result = nullptr
    );

    static std::string incidentToJson(
        const Incident& incident
    );

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

    struct RoadUndoAction { std::string edgeId; bool wasBlocked{false}; };
    Stack<RoadUndoAction> roadUndoStack_;

    IncidentArchiveIndex archiveIndex_;
    LocationDirectory locationDirectory_;
    std::vector<ResponderCandidateSummary> lastCandidateSummaries_;
    std::vector<Facility> facilities_;
    std::vector<DispatchRecord> dispatches_;
    long long dispatchSequence_{0};
    void initializeFacilities();
    void saveDispatch(const Incident&, const Responder&, const DijkstraResult&, bool reroute = false);
    void releaseResponder(const Incident&);
    void retryWaiting();
    void recoverRoads();
    std::string networkJson() const;
    std::string dispatchesJson() const;


    /* =====================================================
       INTERNAL HELPERS
       ===================================================== */

    void emit(
        const std::string& type,
        const Incident* incident,
        const std::string& node = {},
        const std::string& edge = {},
        const std::string& message = {},
        int value = 0
    );


    Incident& mutableIncident(
        const std::string& id
    );

    void rebuildLocationDirectory();
    void refreshIncidentIndex(const Incident& incident);
    void archiveClosedIncident(const Incident& incident);


    Responder* chooseResponder(
        const Incident& incident,
        DijkstraResult& bestRoute
    );


    static std::string escape(
        const std::string& value
    );
};

} // namespace crisismesh
