#include "domain/Responder.hpp"
namespace crisismesh { const char* toString(ResponderAvailability v){switch(v){case ResponderAvailability::Available:return "AVAILABLE";case ResponderAvailability::Assigned:return "ASSIGNED";case ResponderAvailability::Busy:return "BUSY";default:return "OFFLINE";}}}
