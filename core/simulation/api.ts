import type { SimulationResponse, AnalysisResponse } from './types';
import { apiUrl } from '../apiBase';

const BRIDGE_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function analyzeNetwork(algorithm: 'BFS' | 'DFS' | 'DIJKSTRA', source: string, destination: string): Promise<AnalysisResponse> {
  return await simulationRequest({ action: `ANALYZE_${algorithm}`, source, destination }) as unknown as AnalysisResponse;
}

export function isSimulationResponse(value: unknown): value is SimulationResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean' || !Array.isArray(value.events)) {
    return false;
  }
  if (!('state' in value) || !('result' in value)) return false;
  if (!value.ok) {
    return value.state === null && typeof value.error === 'string';
  }
  if (!isRecord(value.state)) return false;
  const state = value.state;
  return state.ok === true && state.engine === 'ONLINE' &&
    isRecord(state.graph) && Array.isArray(state.incidents) &&
    Array.isArray(state.responders) && Array.isArray(state.activeDispatches);
}

export async function simulationRequest<T extends SimulationResponse = SimulationResponse>(
  payload: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl('/api/simulation'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error('The C++ Simulation Bridge returned invalid JSON.');
    }

    if (!isSimulationResponse(data)) {
      throw new Error('The C++ Simulation Bridge returned an invalid response contract.');
    }

    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.message || 'C++ Simulation Bridge unavailable.');
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('C++ Simulation Bridge request timed out.');
    }
    if (error instanceof TypeError) {
      throw new Error('C++ Simulation Bridge is offline or unreachable.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
