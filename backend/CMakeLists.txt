cmake_minimum_required(VERSION 3.16)
project(CrisisMeshDSAEngine VERSION 8.0 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(crisismesh_engine
    src/core/AlgorithmEvent.cpp
    src/graph/Graph.cpp
    src/graph/CityData.cpp
    src/dijkstra/MinHeap.cpp
    src/dijkstra/Dijkstra.cpp
    src/dijkstra/JsonTrace.cpp
    src/bfs/BFS.cpp
    src/dfs/DFS.cpp
    src/linkedlist/LinkedList.cpp
    src/hashtable/HashTable.cpp
    src/domain/Incident.cpp
    src/domain/Responder.cpp
    src/heap/MaxHeap.cpp
    src/simulation/SimulationEngine.cpp
    src/allocation/AllocationEngine.cpp
    src/dsa/DSALab.cpp
)
target_include_directories(crisismesh_engine PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
if(MSVC)
  target_compile_options(crisismesh_engine PRIVATE /W4)
else()
  target_compile_options(crisismesh_engine PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_executable(crisismesh_engine_demo src/main.cpp)
target_link_libraries(crisismesh_engine_demo PRIVATE crisismesh_engine)
add_executable(crisismesh_graph_test tests/graph_test.cpp)
target_link_libraries(crisismesh_graph_test PRIVATE crisismesh_engine)
add_executable(crisismesh_dijkstra_test tests/dijkstra_test.cpp)
target_link_libraries(crisismesh_dijkstra_test PRIVATE crisismesh_engine)
add_executable(crisismesh_bfs_test tests/bfs_test.cpp)
target_link_libraries(crisismesh_bfs_test PRIVATE crisismesh_engine)
add_executable(crisismesh_dfs_test tests/dfs_test.cpp)
target_link_libraries(crisismesh_dfs_test PRIVATE crisismesh_engine)
add_executable(crisismesh_queue_test tests/queue_test.cpp)
target_link_libraries(crisismesh_queue_test PRIVATE crisismesh_engine)
add_executable(crisismesh_stack_test tests/stack_test.cpp)
target_link_libraries(crisismesh_stack_test PRIVATE crisismesh_engine)
add_executable(crisismesh_linkedlist_test tests/linkedlist_test.cpp)
target_link_libraries(crisismesh_linkedlist_test PRIVATE crisismesh_engine)
add_executable(crisismesh_hashtable_test tests/hashtable_test.cpp)
target_link_libraries(crisismesh_hashtable_test PRIVATE crisismesh_engine)
add_executable(crisismesh_trace_exporter src/trace_exporter.cpp)
target_link_libraries(crisismesh_trace_exporter PRIVATE crisismesh_engine)

add_executable(crisismesh_maxheap_test tests/maxheap_test.cpp)
target_link_libraries(crisismesh_maxheap_test PRIVATE crisismesh_engine)
add_executable(crisismesh_incident_test tests/incident_test.cpp)
target_link_libraries(crisismesh_incident_test PRIVATE crisismesh_engine)
add_executable(crisismesh_dispatch_test tests/dispatch_test.cpp)
target_link_libraries(crisismesh_dispatch_test PRIVATE crisismesh_engine)
add_executable(crisismesh_simulation_test tests/simulation_test.cpp)
target_link_libraries(crisismesh_simulation_test PRIVATE crisismesh_engine)
add_executable(crisismesh_simulation_state_test tests/simulation_state_test.cpp)
target_link_libraries(crisismesh_simulation_state_test PRIVATE crisismesh_engine)
add_executable(crisismesh_simulation_reroute_test tests/simulation_reroute_test.cpp)
target_link_libraries(crisismesh_simulation_reroute_test PRIVATE crisismesh_engine)
add_executable(crisismesh_simulation_cli src/simulation/simulation_cli.cpp)
target_link_libraries(crisismesh_simulation_cli PRIVATE crisismesh_engine)

add_executable(crisismesh_phase8_multiincident_test tests/phase8_multiincident_test.cpp)
target_link_libraries(crisismesh_phase8_multiincident_test PRIVATE crisismesh_engine)

add_executable(crisismesh_phase8_allocation_test tests/phase8_allocation_test.cpp)
target_link_libraries(crisismesh_phase8_allocation_test PRIVATE crisismesh_engine)

add_executable(crisismesh_phase8_shortage_test tests/phase8_shortage_test.cpp)
target_link_libraries(crisismesh_phase8_shortage_test PRIVATE crisismesh_engine)
add_executable(crisismesh_phase9_end_to_end_test tests/phase9_end_to_end_test.cpp)
target_link_libraries(crisismesh_phase9_end_to_end_test PRIVATE crisismesh_engine)

add_executable(crisismesh_phase10_final_integration_test tests/phase10_final_integration_test.cpp)
target_link_libraries(crisismesh_phase10_final_integration_test PRIVATE crisismesh_engine)

add_executable(crisismesh_dsa_lab_test tests/dsa_lab_test.cpp)
target_link_libraries(crisismesh_dsa_lab_test PRIVATE crisismesh_engine)

add_executable(crisismesh_final_master_integration_test tests/final_master_integration_test.cpp)
target_link_libraries(crisismesh_final_master_integration_test PRIVATE crisismesh_engine)
