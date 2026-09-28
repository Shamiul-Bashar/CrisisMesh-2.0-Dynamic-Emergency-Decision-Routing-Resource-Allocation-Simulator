#include "simulation/SimulationEngine.hpp"

#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace crisismesh;

namespace {

/* =========================================================
   SIMPLE PIPE-SEPARATED COMMAND SPLITTER
   ========================================================= */

std::vector<std::string> split(
    const std::string& s,
    char delimiter
) {
    std::vector<std::string> out;

    std::string current;

    bool escaped = false;

    for (char c : s) {

        if (escaped) {
            current.push_back(c);
            escaped = false;
        }

        else if (c == '\\') {
            escaped = true;
        }

        else if (c == delimiter) {
            out.push_back(current);
            current.clear();
        }

        else {
            current.push_back(c);
        }
    }

    out.push_back(current);

    return out;
}


/* =========================================================
   LEGACY REPORT RESPONSE HELPER
   ========================================================= */

std::string reportResponse(
    SimulationEngine& engine,
    const std::vector<std::string>& p
) {
    if (p.size() < 7) {
        throw std::invalid_argument(
            "REPORT requires type|location|severity|urgency|victims|description"
        );
    }

    /*
     * New optional argument:
     *
     * p[7] = reportedByUserId
     *
     * Old REPORT commands with only 7 fields
     * remain compatible.
     */
    const std::string reportedByUserId =
        p.size() >= 8
            ? p[7]
            : "";

    auto incident =
        engine.reportEmergency(
            incidentTypeFromString(p[1]),
            p[2],
            std::stoi(p[3]),
            std::stoi(p[4]),
            std::stoi(p[5]),
            p[6],
            reportedByUserId
        );

    auto dispatch =
        engine.processNextIncident();

    return SimulationEngine::eventsToJson(
        engine.events(),
        &dispatch
    );
}


/* =========================================================
   SERVER MODE
   ========================================================= */

void server() {

    SimulationEngine engine;

    std::string line;

    while (
        std::getline(
            std::cin,
            line
        )
    ) {

        try {

            auto p =
                split(
                    line,
                    '|'
                );

            if (p.empty()) {
                continue;
            }


            /* =================================================
               REPORT EMERGENCY

               OLD:
               REPORT|TYPE|LOCATION|SEVERITY|URGENCY|VICTIMS|DESCRIPTION

               NEW:
               REPORT|TYPE|LOCATION|SEVERITY|URGENCY|VICTIMS|DESCRIPTION|USER_ID
               ================================================= */

            if (p[0] == "REPORT") {

                if (p.size() < 7) {
                    throw std::invalid_argument(
                        "REPORT requires type|location|severity|urgency|victims|description"
                    );
                }

                const std::string reportedByUserId =
                    p.size() >= 8
                        ? p[7]
                        : "";

                auto incident =
                    engine.reportEmergency(
                        incidentTypeFromString(
                            p[1]
                        ),
                        p[2],
                        std::stoi(p[3]),
                        std::stoi(p[4]),
                        std::stoi(p[5]),
                        p[6],
                        reportedByUserId
                    );

                std::cout
                    << "{"
                    << "\"ok\":true,"
                    << "\"message\":\"Incident queued for coordinator processing\","
                    << "\"incident\":"
                    << SimulationEngine::incidentToJson(
                        incident
                    )
                    << ",\"events\":"
                    << SimulationEngine::eventsToJson(
                        engine.events()
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               PROCESS NEXT INCIDENT
               ================================================= */

            else if (
                p[0] ==
                "PROCESS_NEXT"
            ) {

                auto dispatch =
                    engine.processNextIncident();

                auto payload =
                    SimulationEngine::eventsToJson(
                        engine.events(),
                        &dispatch
                    );

                if (
                    !payload.empty() &&
                    payload.back() == '}'
                ) {
                    payload.pop_back();
                }

                std::cout
                    << payload
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               BLOCK ROAD
               ================================================= */

            else if (
                p[0] ==
                "BLOCK"
            ) {

                if (p.size() < 2) {
                    throw std::invalid_argument(
                        "BLOCK requires edge id"
                    );
                }

                bool ok =
                    engine.blockRoad(
                        p[1]
                    );

                std::cout
                    << "{\"ok\":"
                    << (
                        ok
                            ? "true"
                            : "false"
                    )
                    << ",\"events\":"
                    << SimulationEngine::eventsToJson(
                        engine.events()
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               UNDO LAST ROAD BLOCK
               ================================================= */

            else if (
                p[0] ==
                "UNDO_BLOCK"
            ) {

                bool ok =
                    engine.undoLastRoadBlock();

                std::cout
                    << "{\"ok\":"
                    << (
                        ok
                            ? "true"
                            : "false"
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               UNBLOCK ROAD
               ================================================= */

            else if (
                p[0] ==
                "UNBLOCK"
            ) {

                if (p.size() < 2) {
                    throw std::invalid_argument(
                        "UNBLOCK requires edge id"
                    );
                }

                bool ok =
                    engine.unblockRoad(
                        p[1]
                    );

                std::cout
                    << "{\"ok\":"
                    << (
                        ok
                            ? "true"
                            : "false"
                    )
                    << ",\"events\":"
                    << SimulationEngine::eventsToJson(
                        engine.events()
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               SET RESPONDER AVAILABILITY
               ================================================= */

            else if (
                p[0] ==
                "SET_RESPONDER"
            ) {

                if (p.size() < 3) {
                    throw std::invalid_argument(
                        "SET_RESPONDER requires responder id|availability"
                    );
                }

                ResponderAvailability availability =
                    ResponderAvailability::Offline;

                if (
                    p[2] ==
                    "AVAILABLE"
                ) {
                    availability =
                        ResponderAvailability::Available;
                }

                else if (
                    p[2] ==
                    "ASSIGNED"
                ) {
                    availability =
                        ResponderAvailability::Assigned;
                }

                else if (
                    p[2] ==
                    "BUSY"
                ) {
                    availability =
                        ResponderAvailability::Busy;
                }

                else if (
                    p[2] !=
                    "OFFLINE"
                ) {
                    throw std::invalid_argument(
                        "Unknown responder availability"
                    );
                }

                bool ok =
                    engine.setResponderAvailability(
                        p[1],
                        availability
                    );

                std::cout
                    << "{\"ok\":"
                    << (
                        ok
                            ? "true"
                            : "false"
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               LEGACY DIRECT RESOLVE

               Kept so old tests/frontend behavior
               remains compatible.
               ================================================= */

            else if (
                p[0] ==
                "RESOLVE"
            ) {

                if (p.size() < 2) {
                    throw std::invalid_argument(
                        "RESOLVE requires incident id"
                    );
                }

                bool ok =
                    engine.resolveIncident(
                        p[1]
                    );

                std::cout
                    << "{\"ok\":"
                    << (
                        ok
                            ? "true"
                            : "false"
                    )
                    << ",\"events\":"
                    << SimulationEngine::eventsToJson(
                        engine.events()
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               NEW:
               AUTHOR COMPLETES FIELD RESPONSE

               RESPONSE_COMPLETED|INCIDENT_ID

               Result:
               RESPONSE_COMPLETED
                    ↓
               AWAITING_USER_CONFIRMATION
               ================================================= */

            else if (
                p[0] ==
                "RESPONSE_COMPLETED"
            ) {

                if (p.size() < 2) {
                    throw std::invalid_argument(
                        "RESPONSE_COMPLETED requires incident id"
                    );
                }

                bool ok =
                    engine.markResponseCompleted(
                        p[1]
                    );

                std::cout
                    << "{\"ok\":"
                    << (
                        ok
                            ? "true"
                            : "false"
                    )
                    << ",\"message\":\""
                    << (
                        ok
                            ? "Response completed; waiting for user confirmation"
                            : "Unable to complete response for this incident"
                    )
                    << "\",\"events\":"
                    << SimulationEngine::eventsToJson(
                        engine.events()
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               NEW:
               USER CONFIRMS PROBLEM RESOLVED

               CONFIRM_RESOLVED|INCIDENT_ID|USER_ID

               Result:
               AWAITING_USER_CONFIRMATION
                    ↓
               RESOLVED
                    ↓
               CLOSED
               ================================================= */

            else if (
                p[0] ==
                "CONFIRM_RESOLVED"
            ) {

                if (p.size() < 3) {
                    throw std::invalid_argument(
                        "CONFIRM_RESOLVED requires incident id|user id"
                    );
                }

                bool ok =
                    engine.confirmIncidentResolved(
                        p[1],
                        p[2]
                    );

                std::cout
                    << "{\"ok\":"
                    << (
                        ok
                            ? "true"
                            : "false"
                    )
                    << ",\"message\":\""
                    << (
                        ok
                            ? "Incident resolution confirmed by reporting user"
                            : "Unable to confirm incident resolution"
                    )
                    << "\",\"events\":"
                    << SimulationEngine::eventsToJson(
                        engine.events()
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               NEW:
               USER STILL NEEDS HELP

               ESCALATE|INCIDENT_ID|USER_ID|REASON

               Result:
               AWAITING_USER_CONFIRMATION
                    ↓
               ESCALATED
                    ↓
               QUEUED
                    ↓
               DSA pipeline again
               ================================================= */

            else if (
                p[0] ==
                "ESCALATE"
            ) {

                if (p.size() < 3) {
                    throw std::invalid_argument(
                        "ESCALATE requires incident id|user id|reason"
                    );
                }

                const std::string reason =
                    p.size() >= 4
                        ? p[3]
                        : "User requested additional emergency assistance";

                bool ok =
                    engine.escalateIncident(
                        p[1],
                        p[2],
                        reason
                    );

                std::cout
                    << "{\"ok\":"
                    << (
                        ok
                            ? "true"
                            : "false"
                    )
                    << ",\"message\":\""
                    << (
                        ok
                            ? "Incident escalated and returned to emergency queue"
                            : "Unable to escalate incident"
                    )
                    << "\",\"events\":"
                    << SimulationEngine::eventsToJson(
                        engine.events()
                    )
                    << ",\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               RESET
               ================================================= */

            else if (
                p[0] ==
                "RESET"
            ) {

                engine.reset();

                std::cout
                    << "{\"ok\":true,"
                    << "\"message\":\"Simulation reset\","
                    << "\"state\":"
                    << engine.stateToJson()
                    << "}\n";
            }


            /* =================================================
               STATE
               ================================================= */

            else if (
                p[0] ==
                "STATE"
            ) {

                std::cout
                    << engine.stateToJson()
                    << "\n";
            }


            /* =================================================
               UNKNOWN COMMAND
               ================================================= */

            else {

                throw std::invalid_argument(
                    "Unknown command"
                );
            }

        }

        catch (
            const std::exception& e
        ) {

            std::cout
                << "{\"ok\":false,"
                << "\"error\":\""
                << e.what()
                << "\"}\n";
        }


        std::cout.flush();
    }
}

} // namespace


/* =========================================================
   MAIN
   ========================================================= */

int main(
    int argc,
    char** argv
) {

    try {

        /*
         * Persistent server mode used by
         * the Vite development middleware.
         */
        if (
            argc > 1 &&
            std::string(argv[1]) ==
                "--server"
        ) {

            server();

            return 0;
        }


        /*
         * Standalone CLI demo.
         */
        SimulationEngine engine;

        auto incident =
            engine.reportEmergency(
                IncidentType::Fire,
                "LOC-007",
                5,
                5,
                8,
                "Demo fire emergency"
            );

        auto dispatch =
            engine.processNextIncident();

        std::cout
            << SimulationEngine::eventsToJson(
                engine.events(),
                &dispatch
            )
            << "\n";

        return
            dispatch.success
                ? 0
                : 1;
    }

    catch (
        const std::exception& e
    ) {

        std::cerr
            << "SIMULATION ERROR: "
            << e.what()
            << "\n";

        return 1;
    }
}