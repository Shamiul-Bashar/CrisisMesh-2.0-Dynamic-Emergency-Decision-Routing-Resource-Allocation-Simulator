#include "graph/CityData.hpp"

namespace crisismesh {

Graph createCrisisMeshCity() {
    Graph graph;

    const Vertex vertices[] = {
        {"LOC-001","Central Hospital",LocationType::Hospital,{50,48},"OPERATIONAL"},
        {"LOC-002","North Hospital",LocationType::Hospital,{51,14},"OPERATIONAL"},
        {"LOC-003","Main Fire Station",LocationType::Fire,{30,38},"OPERATIONAL"},
        {"LOC-004","East Fire Station",LocationType::Fire,{78,42},"OPERATIONAL"},
        {"LOC-005","Central Police Station",LocationType::Police,{42,63},"OPERATIONAL"},
        {"LOC-006","North Police Station",LocationType::Police,{35,18},"OPERATIONAL"},
        {"LOC-007","City Market",LocationType::Market,{62,67},"LIMITED"},
        {"LOC-008","North Market",LocationType::Market,{70,21},"OPERATIONAL"},
        {"LOC-009","Central School",LocationType::School,{23,57},"OPERATIONAL"},
        {"LOC-010","East School",LocationType::School,{83,61},"OPERATIONAL"},
        {"LOC-011","South School",LocationType::School,{48,88},"OPERATIONAL"},
        {"LOC-012","Emergency Shelter A",LocationType::Shelter,{16,75},"OPERATIONAL"},
        {"LOC-013","Emergency Shelter B",LocationType::Shelter,{76,82},"OPERATIONAL"},
        {"LOC-014","Residential Zone A",LocationType::Residential,{18,30},"OPERATIONAL"},
        {"LOC-015","Residential Zone B",LocationType::Residential,{65,35},"OPERATIONAL"},
        {"LOC-016","Residential Zone C",LocationType::Residential,{87,32},"OPERATIONAL"},
        {"LOC-017","City Hall",LocationType::Civic,{52,60},"OPERATIONAL"},
        {"LOC-018","Bus Terminal",LocationType::Transport,{37,77},"OPERATIONAL"},
        {"LOC-019","Industrial Zone",LocationType::Industrial,{90,75},"LIMITED"},
        {"LOC-020","Central Intersection",LocationType::Intersection,{50,36},"OPERATIONAL"},
        {"LOC-021","North Junction",LocationType::Intersection,{50,23},"OPERATIONAL"},
        {"LOC-022","East Junction",LocationType::Intersection,{68,50},"OPERATIONAL"},
        {"LOC-023","South Junction",LocationType::Intersection,{50,74},"OPERATIONAL"},
        {"LOC-024","West Junction",LocationType::Intersection,{32,50},"OPERATIONAL"}
    };

    for (const auto& vertex : vertices) {
        graph.addVertex(vertex);
    }

    const Edge edges[] = {
        {"R-001","LOC-001","LOC-020",2.1,4,1,2,80,false},
        {"R-002","LOC-001","LOC-017",1.2,3,1,3,75,false},
        {"R-003","LOC-001","LOC-022",2.8,6,2,4,70,false},
        {"R-004","LOC-001","LOC-005",1.7,4,2,2,65,false},
        {"R-005","LOC-002","LOC-021",1.5,3,1,2,80,false},
        {"R-006","LOC-002","LOC-006",2.2,5,1,3,70,false},
        {"R-007","LOC-002","LOC-008",2.6,6,2,4,65,false},
        {"R-008","LOC-003","LOC-024",2,4,1,2,80,false},
        {"R-009","LOC-003","LOC-020",2.4,5,2,3,75,false},
        {"R-010","LOC-003","LOC-014",1.9,4,2,2,70,false},
        {"R-011","LOC-004","LOC-022",1.6,4,1,3,75,false},
        {"R-012","LOC-004","LOC-015",1.7,4,2,5,65,false},
        {"R-013","LOC-004","LOC-016",1.8,4,2,3,70,false},
        {"R-014","LOC-005","LOC-024",1.8,4,1,2,75,false},
        {"R-015","LOC-005","LOC-023",2.1,5,2,4,70,false},
        {"R-016","LOC-005","LOC-009",1.5,3,1,3,60,false},
        {"R-017","LOC-006","LOC-021",1.4,3,1,2,75,false},
        {"R-018","LOC-006","LOC-014",1.8,4,2,3,70,false},
        {"R-019","LOC-007","LOC-017",1.4,3,2,7,55,false},
        {"R-020","LOC-007","LOC-022",1.6,4,2,6,60,false},
        {"R-021","LOC-007","LOC-023",2,5,2,5,60,false},
        {"R-022","LOC-008","LOC-021",1.9,4,1,4,65,false},
        {"R-023","LOC-008","LOC-015",1.7,4,2,5,60,false},
        {"R-024","LOC-009","LOC-024",1.4,3,1,2,70,false},
        {"R-025","LOC-009","LOC-012",2,5,2,3,60,false},
        {"R-026","LOC-010","LOC-022",1.9,4,1,4,65,false},
        {"R-027","LOC-010","LOC-013",2.2,5,2,4,60,false},
        {"R-028","LOC-010","LOC-019",1.8,5,3,6,55,false},
        {"R-029","LOC-011","LOC-023",1.7,4,1,3,70,false},
        {"R-030","LOC-011","LOC-018",1.6,4,2,3,65,false},
        {"R-031","LOC-012","LOC-018",2.3,5,1,2,70,false},
        {"R-032","LOC-013","LOC-023",1.8,4,2,4,65,false},
        {"R-033","LOC-013","LOC-019",2,5,3,5,55,false},
        {"R-034","LOC-014","LOC-024",2.1,5,2,4,65,false},
        {"R-035","LOC-015","LOC-020",1.5,3,1,4,70,false},
        {"R-036","LOC-015","LOC-022",1.4,3,1,5,65,false},
        {"R-037","LOC-016","LOC-022",2,5,2,4,60,false},
        {"R-038","LOC-017","LOC-023",1.9,4,1,4,70,false},
        {"R-039","LOC-018","LOC-023",1.5,4,1,3,70,false},
        {"R-040","LOC-020","LOC-021",1.7,4,1,3,75,false},
        {"R-041","LOC-020","LOC-024",2,4,1,3,75,false},
        {"R-042","LOC-021","LOC-017",1.3,3,1,2,70,false}
    };

    for (const auto& edge : edges) {
        graph.addEdge(edge);
    }

    return graph;
}

} // namespace crisismesh
