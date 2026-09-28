#include "simulation/SimulationEngine.hpp"

#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace crisismesh;

namespace {

std::vector<std::string> split(const std::string& input, char delimiter) {
    std::vector<std::string> parts;
    std::string current;
    bool escaped = false;
    for (char character : input) {
        if (escaped) { current.push_back(character); escaped = false; }
        else if (character == '\\') escaped = true;
        else if (character == delimiter) { parts.push_back(current); current.clear(); }
        else current.push_back(character);
    }
    parts.push_back(current);
    return parts;
}

std::string quote(const std::string& value) {
    std::string output = "\"";
    for (char character : value) {
        if (character == '\\') output += "\\\\";
        else if (character == '"') output += "\\\"";
        else if (character == '\n') output += "\\n";
        else if (character == '\r') output += "\\r";
        else output += character;
    }
    return output + "\"";
}

std::string eventsArrayJson(const SimulationEngine& engine) {
    const std::string document = SimulationEngine::eventsToJson(engine.events());
    const std::string key = "\"events\":";
    const std::size_t keyPosition = document.find(key);
    if (keyPosition == std::string::npos) return "[]";
    const std::size_t start = document.find('[', keyPosition + key.size());
    if (start == std::string::npos) return "[]";

    std::size_t depth = 0;
    bool inString = false;
    bool escaped = false;
    for (std::size_t index = start; index < document.size(); ++index) {
        const char character = document[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (character == '\\') escaped = true;
            else if (character == '"') inString = false;
            continue;
        }
        if (character == '"') inString = true;
        else if (character == '[') ++depth;
        else if (character == ']' && --depth == 0)
            return document.substr(start, index - start + 1);
    }
    return "[]";
}

std::string stringArrayJson(const std::vector<std::string>& values) {
    std::ostringstream output;
    output << '[';
    for (std::size_t index = 0; index < values.size(); ++index) {
        if (index) output << ',';
        output << quote(values[index]);
    }
    return output.str() + "]";
}

std::string routeJson(const DijkstraResult& route) {
    std::ostringstream output;
    output << "{\"reachable\":" << (route.reachable ? "true" : "false")
           << ",\"totalCost\":" << route.totalCost
           << ",\"totalDistance\":" << route.totalDistance
           << ",\"totalTravelTime\":" << route.totalTravelTime
           << ",\"nodesExplored\":" << route.nodesExplored
           << ",\"pathNodes\":" << stringArrayJson(route.pathNodes)
           << ",\"pathEdges\":" << stringArrayJson(route.pathEdges) << '}';
    return output.str();
}

std::string dispatchResultJson(const DispatchResult& dispatch) {
    std::ostringstream output;
    output << "{\"success\":" << (dispatch.success ? "true" : "false")
           << ",\"message\":" << quote(dispatch.message)
           << ",\"incident\":" << SimulationEngine::incidentToJson(dispatch.incident)
           << ",\"responder\":{\"responderId\":" << quote(dispatch.responder.responderId)
           << ",\"type\":" << quote(dispatch.responder.type)
           << ",\"locationId\":" << quote(dispatch.responder.currentLocation) << "}"
           << ",\"route\":" << routeJson(dispatch.route) << '}';
    return output.str();
}

void success(const SimulationEngine& engine,
             const std::string& result = "null",
             const std::string& message = {}) {
    std::cout << "{\"ok\":true,\"state\":" << engine.stateToJson()
              << ",\"events\":" << eventsArrayJson(engine)
              << ",\"result\":" << result;
    if (!message.empty()) std::cout << ",\"message\":" << quote(message);
    std::cout << "}\n";
}

void failure(const std::string& error) {
    std::cout << "{\"ok\":false,\"error\":" << quote(error)
              << ",\"state\":null,\"events\":[],\"result\":null}\n";
}

void require(bool condition, const std::string& message) {
    if (!condition) throw std::invalid_argument(message);
}

ResponderAvailability responderAvailability(const std::string& value) {
    if (value == "AVAILABLE") return ResponderAvailability::Available;
    if (value == "ASSIGNED") return ResponderAvailability::Assigned;
    if (value == "BUSY") return ResponderAvailability::Busy;
    if (value == "OFFLINE") return ResponderAvailability::Offline;
    throw std::invalid_argument("Unknown responder availability");
}

void server() {
    SimulationEngine engine;
    std::string line;
    while (std::getline(std::cin, line)) {
        try {
            const auto parts = split(line, '|');
            require(!parts.empty() && !parts[0].empty(), "Command is required");
            const std::string& command = parts[0];

            if (command == "STATE") {
                success(engine);
            } else if (command == "REPORT") {
                require(parts.size() >= 7,
                        "REPORT requires type|location|severity|urgency|victims|description");
                const Incident incident = engine.reportEmergency(
                    incidentTypeFromString(parts[1]), parts[2], std::stoi(parts[3]),
                    std::stoi(parts[4]), std::stoi(parts[5]), parts[6],
                    parts.size() >= 8 ? parts[7] : "");
                success(engine,
                        std::string("{\"incident\":") +
                            SimulationEngine::incidentToJson(incident) + "}",
                        "Incident queued for coordinator processing");
            } else if (command == "PROCESS_NEXT") {
                const DispatchResult dispatch = engine.processNextIncident();
                success(engine, dispatchResultJson(dispatch), dispatch.message);
            } else if (command == "BLOCK") {
                require(parts.size() >= 2, "BLOCK requires edge id");
                require(engine.blockRoad(parts[1]), "Unable to block the requested road");
                success(engine, "null", "Road blocked");
            } else if (command == "UNBLOCK") {
                require(parts.size() >= 2, "UNBLOCK requires edge id");
                require(engine.unblockRoad(parts[1]), "Unable to unblock the requested road");
                success(engine, "null", "Road reopened");
            } else if (command == "UNDO_BLOCK") {
                require(engine.undoLastRoadBlock(), "No road-block operation is available to undo");
                success(engine, "null", "Last road block undone");
            } else if (command == "SET_RESPONDER") {
                require(parts.size() >= 3,
                        "SET_RESPONDER requires responder id|availability");
                require(engine.setResponderAvailability(parts[1], responderAvailability(parts[2])),
                        "Unknown responder id");
                success(engine, "null", "Responder availability updated");
            } else if (command == "RESOLVE") {
                require(parts.size() >= 2, "RESOLVE requires incident id");
                require(engine.resolveIncident(parts[1]), "Unable to resolve this incident");
                success(engine, "null", "Incident resolved");
            } else if (command == "RESPONSE_COMPLETED") {
                require(parts.size() >= 2, "RESPONSE_COMPLETED requires incident id");
                require(engine.markResponseCompleted(parts[1]),
                        "Unable to complete response for this incident");
                success(engine, "null", "Response completed; waiting for user confirmation");
            } else if (command == "CONFIRM_RESOLVED") {
                require(parts.size() >= 3,
                        "CONFIRM_RESOLVED requires incident id|user id");
                require(engine.confirmIncidentResolved(parts[1], parts[2]),
                        "Unable to confirm incident resolution");
                success(engine, "null", "Incident resolution confirmed by reporting user");
            } else if (command == "ESCALATE") {
                require(parts.size() >= 3, "ESCALATE requires incident id|user id|reason");
                require(engine.escalateIncident(
                            parts[1], parts[2],
                            parts.size() >= 4 ? parts[3]
                                              : "User requested additional emergency assistance"),
                        "Unable to escalate this incident");
                success(engine, "null", "Incident escalated and returned to emergency queue");
            } else if (command == "RESET") {
                engine.reset();
                success(engine, "null", "Simulation reset");
            } else {
                throw std::invalid_argument("Unknown command");
            }
        } catch (const std::exception& error) {
            failure(error.what());
        }
        std::cout.flush();
    }
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc > 1 && std::string(argv[1]) == "--server") {
            server();
            return 0;
        }
        SimulationEngine engine;
        engine.reportEmergency(IncidentType::Fire, "LOC-007", 5, 5, 8,
                               "Demo fire emergency");
        const auto dispatch = engine.processNextIncident();
        std::cout << SimulationEngine::eventsToJson(engine.events(), &dispatch) << '\n';
        return dispatch.success ? 0 : 1;
    } catch (const std::exception& error) {
        std::cerr << "SIMULATION ERROR: " << error.what() << '\n';
        return 1;
    }
}
