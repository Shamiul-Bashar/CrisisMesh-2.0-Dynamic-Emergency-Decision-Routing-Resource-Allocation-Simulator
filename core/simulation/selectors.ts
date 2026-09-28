import type { SimulationIncident } from './types';

export function isActiveOperationalIncident(incident: SimulationIncident): boolean {
  return incident.status !== 'CLOSED';
}
