import type { SimulationResponse } from './types';

const BRIDGE_TIMEOUT_MS = 10_000;

export async function simulationRequest<T extends SimulationResponse = SimulationResponse>(
  payload: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

  try {
    const response = await fetch('/api/simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: T;
    try {
      data = (await response.json()) as T;
    } catch {
      throw new Error('The C++ Simulation Development Bridge returned invalid JSON.');
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || data.message || 'C++ Simulation Development Bridge unavailable.');
    }

    return data;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('C++ Simulation Development Bridge request timed out.');
    }
    if (error instanceof TypeError) {
      throw new Error('C++ Simulation Development Bridge is offline or unreachable.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
